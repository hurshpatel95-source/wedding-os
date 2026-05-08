-- ─── Wave 3 — autopilot foundation ──────────────────────────────────
--
-- Schema for the autopilot wave: AI onboarding intake, intelligent budget
-- tree, Gmail connector, vendor search caching, thread analyzer outputs,
-- in-app alerts feed, AI run trace.
--
-- New tables:
--   intake_sessions       AI chat intake (couple's onboarding interview)
--   budget_lines          Per-couple budget tree (the killer feature)
--   gmail_connections     Per-user Gmail OAuth tokens (separate from calendar)
--   vendor_search_cache   Cached Google Places / Brave Search results
--   vendor_alerts         In-app alerts for couple + planner
--   autopilot_runs        AI trace: every thread-analysis / outreach-draft
--
-- Columns added:
--   vendors.autopilot_status, autopilot_enabled, last_inbound_at,
--     last_outbound_at, quote_eur, quote_summary, ai_summary,
--     gplaces_place_id, gplaces_rating, gplaces_data
--   workspaces.autopilot_enabled, wedding_region, style_tags

-- ─── 1. Onboarding intake sessions ───────────────────────────────────

create table intake_sessions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- The whole conversation transcript: array of { role: 'user'|'assistant'|'system', content, ts }
  chat_messages jsonb not null default '[]'::jsonb,
  -- Structured data the AI has extracted so far. Keys mirror what gets
  -- written to workspaces / venues / budget_lines on completion.
  extracted_data jsonb not null default '{}'::jsonb,
  -- AI cost tracking
  total_cost_usd numeric(8, 4) default 0,
  -- One session per workspace at a time. Old ones get status='abandoned'.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index intake_sessions_workspace_idx
  on intake_sessions(workspace_id, status);

create trigger intake_sessions_updated_at before update on intake_sessions
  for each row execute function set_updated_at();

alter table intake_sessions enable row level security;

create policy intake_sessions_member_all on intake_sessions for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

create policy intake_sessions_org_admin_read on intake_sessions for select
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 2. Budget tree ──────────────────────────────────────────────────

create table budget_lines (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  -- Tree structure: parent_line_id null = top-level category
  parent_line_id uuid references budget_lines(id) on delete cascade,
  -- Top-level category for the bucket (used when parent is null;
  -- children inherit visually from parent's tree)
  category text not null default 'misc',
  label text not null,
  -- Cost shape: total_eur is the "current best estimate".
  -- For leaf items: total_eur = qty * unit_price_eur (when given).
  -- For parent rows: total_eur = sum of children's total_eur (computed in app).
  qty numeric(10, 2) default 1,
  unit_price_eur numeric(12, 2),
  total_eur numeric(14, 2),
  -- Three commitment tiers (always non-negative; can equal):
  --   amount_estimated: what we think we'll spend (planning #)
  --   amount_committed: what's locked in via signed contract / quote accepted
  --   amount_paid     : actually paid out
  amount_estimated numeric(14, 2),
  amount_committed numeric(14, 2),
  amount_paid numeric(14, 2),
  -- When the line is bound to a real vendor row
  vendor_id uuid references vendors(id) on delete set null,
  status text not null default 'placeholder'
    check (status in ('placeholder', 'researching', 'quoted', 'booked', 'paid')),
  source text not null default 'manual'
    check (source in ('ai_baseline', 'industry_avg', 'vendor_quote', 'manual', 'imported')),
  notes text,
  -- Sort order within a parent (stable ordering for the UI)
  sort_order integer not null default 0,
  -- Extra structured payload (for things like "what's included" lists,
  -- per-guest scaling rules, etc.)
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_lines_workspace_idx
  on budget_lines(workspace_id, sort_order);
create index budget_lines_parent_idx
  on budget_lines(parent_line_id) where parent_line_id is not null;
create index budget_lines_vendor_idx
  on budget_lines(vendor_id) where vendor_id is not null;

create trigger budget_lines_updated_at before update on budget_lines
  for each row execute function set_updated_at();

alter table budget_lines enable row level security;

-- Workspace members manage their own budget
create policy budget_lines_member_all on budget_lines for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- Org admins see all (for planner-side oversight)
create policy budget_lines_org_admin_read on budget_lines for select
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 3. Gmail connections ────────────────────────────────────────────

create table gmail_connections (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- The connecting user (couple member or planner who wired their wedding email)
  user_id uuid not null references users(id) on delete cascade,
  -- The wedding-only Gmail address — this is what Hursh has been calling for
  email text not null,
  -- Encrypted at app layer eventually; plain for now (single-tenant)
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  -- Granted scopes (we ask for read + compose + send + modify)
  scopes text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'error')),
  -- Gmail history ID for incremental sync
  last_history_id text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index gmail_connections_email_unique on gmail_connections(email);
create index gmail_connections_workspace_idx on gmail_connections(workspace_id);

create trigger gmail_connections_updated_at before update on gmail_connections
  for each row execute function set_updated_at();

alter table gmail_connections enable row level security;

-- Workspace members see/manage their own Gmail connection
create policy gmail_connections_member_all on gmail_connections for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- Org admins see all (so planners can help couples debug)
create policy gmail_connections_org_admin_read on gmail_connections for select
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 4. Vendor search cache ──────────────────────────────────────────

create table vendor_search_cache (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  -- Search signature
  category text not null,             -- "florist", "photographer", etc.
  region text not null,               -- "Newport, RI"
  query text not null,                -- The actual search string sent
  provider text not null              -- "google_places" | "brave"
    check (provider in ('google_places', 'brave', 'manual')),
  -- Results: array of { name, phone?, email?, website?, address?, rating?, photos?, place_id? }
  results jsonb not null default '[]'::jsonb,
  result_count integer not null default 0,
  -- Cost in USD for the search
  cost_usd numeric(8, 4) default 0,
  fetched_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index vendor_search_cache_lookup_idx
  on vendor_search_cache(workspace_id, category, region, fetched_at desc);

alter table vendor_search_cache enable row level security;

create policy vendor_search_cache_member_all on vendor_search_cache for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- ─── 5. Alerts (in-app + digest) ─────────────────────────────────────

create table alerts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  -- Who this alert is FOR. couple-side alerts: workspace members.
  -- planner-side alerts: org admins.
  audience text not null default 'couple'
    check (audience in ('couple', 'planner', 'both')),
  kind text not null,                 -- 'vendor_quote_received', 'vendor_no_reply', 'task_overdue', 'rsvp_milestone', 'budget_exceeded', etc.
  severity text not null default 'info'
    check (severity in ('info', 'success', 'warn', 'urgent')),
  title text not null,
  body text,
  -- Click target — usually a deep link like /vendors/[id]
  action_url text,
  -- Optional structured payload for the UI (e.g. quote amount, vendor name)
  payload jsonb default '{}'::jsonb,
  -- Linkage for filtering
  related_vendor_id uuid references vendors(id) on delete set null,
  related_lead_id uuid references leads(id) on delete set null,
  related_budget_line_id uuid references budget_lines(id) on delete set null,
  -- Lifecycle
  read_at timestamptz,
  dismissed_at timestamptz,
  -- For digest: was this included in the daily email?
  included_in_digest_at timestamptz,
  created_at timestamptz not null default now()
);

create index alerts_workspace_audience_idx
  on alerts(workspace_id, audience, created_at desc);
create index alerts_workspace_unread_idx
  on alerts(workspace_id, audience, created_at desc)
  where read_at is null and dismissed_at is null;

alter table alerts enable row level security;

create policy alerts_member_read on alerts for select
  using (
    workspace_id = auth_workspace_id()
    and (audience = 'couple' or audience = 'both')
  );

create policy alerts_member_update on alerts for update
  using (
    workspace_id = auth_workspace_id()
    and (audience = 'couple' or audience = 'both')
  );

create policy alerts_org_admin_all on alerts for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 6. Autopilot runs (AI trace) ────────────────────────────────────

create table autopilot_runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null,                 -- 'analyze_thread', 'draft_outreach', 'follow_up', 'budget_baseline', 'intake_extract'
  -- What we ran on
  input_ref jsonb not null default '{}'::jsonb,  -- { gmail_thread_id, vendor_id, lead_id, etc }
  -- What came out
  output jsonb default '{}'::jsonb,
  -- Cost tracking
  model text,                         -- 'claude-sonnet-4-6', 'claude-haiku-4-5'
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(8, 4) default 0,
  status text not null default 'success'
    check (status in ('success', 'failed', 'queued', 'running')),
  error_message text,
  duration_ms integer,
  triggered_by text,                  -- 'webhook', 'cron', 'manual', 'on_send'
  created_at timestamptz not null default now()
);

create index autopilot_runs_workspace_idx
  on autopilot_runs(workspace_id, kind, created_at desc);

alter table autopilot_runs enable row level security;

create policy autopilot_runs_org_admin on autopilot_runs for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

create policy autopilot_runs_member_read on autopilot_runs for select
  using (workspace_id = auth_workspace_id());

-- ─── 7. Vendor extensions ────────────────────────────────────────────

alter table vendors
  add column autopilot_status text default 'none'
    check (autopilot_status in ('none', 'researching', 'contacted', 'quoted', 'booked', 'declined', 'unavailable')),
  add column autopilot_enabled boolean not null default false,
  add column last_inbound_at timestamptz,
  add column last_outbound_at timestamptz,
  add column quote_eur numeric(12, 2),
  add column quote_summary text,
  add column quote_source_email_id uuid references email_messages(id) on delete set null,
  add column ai_summary text,
  add column gplaces_place_id text,
  add column gplaces_rating numeric(3, 2),
  add column gplaces_data jsonb;

create index vendors_autopilot_status_idx on vendors(workspace_id, autopilot_status);
create index vendors_gplaces_idx on vendors(gplaces_place_id) where gplaces_place_id is not null;

-- ─── 8. Workspace extensions ─────────────────────────────────────────

alter table workspaces
  add column autopilot_enabled boolean not null default false,
  add column wedding_region text,
  add column style_tags text[] default '{}',
  add column guest_count_estimate integer,
  add column budget_target_eur numeric(14, 2);
