-- ─── Wave 2 foundation — schema for 11 parallel feature streams ──────
--
-- One migration that lays down all schema needed for the polish + week-1
-- features. Each agent owns its own table cluster.
--
-- New tables:
--   email_templates       (planner email-template library)
--   documents             (per-client document cabinet)
--   planner_expenses      (vendor payments + studio overhead)
--   time_entries          (per-client time tracking)
--   lead_routing_rules    (auto-assign leads)
--   testimonials          (post-wedding reviews)
--   calendar_connections  (Google Calendar / iCal sync)
--
-- Columns added:
--   users.team_role               (for TEAM-MEMBERS — invited collaborators)
--   playbook_tasks.recurrence_rule + recurrence_anchor   (RECURRING-TASKS)
--   leads.assigned_to_user_id     (LEAD-ROUTING)
--
-- Storage buckets:
--   documents   (private — per-client document cabinet)

-- ─── 1. Team members ─────────────────────────────────────────────────

alter table users
  add column team_role text
    check (team_role in ('owner', 'planner', 'assistant'));

-- Owner is implicit: the user who originally created the org. We back-fill
-- by promoting org_admins with no existing team_role to 'owner'. Safe to
-- run repeatedly.
update users set team_role = 'owner'
  where org_role = 'org_admin' and team_role is null;

-- ─── 2. Email templates ──────────────────────────────────────────────

create table email_templates (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  kind text,                                        -- 'vendor_rfp', 'guest_save_the_date', 'custom'
  subject text not null,
  body text not null,
  is_shared boolean not null default true,          -- visible to whole org
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_templates_org_idx on email_templates(org_id, kind, name);

create trigger email_templates_updated_at before update on email_templates
  for each row execute function set_updated_at();

alter table email_templates enable row level security;

create policy email_templates_org_member_read on email_templates for select
  using (org_id = auth_org_id());

create policy email_templates_org_admin_write on email_templates for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 3. Document cabinet ─────────────────────────────────────────────

create table documents (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  storage_path text not null,
  file_size_bytes bigint,
  mime_type text,
  -- Loose category — UI groups by these on the per-client documents tab
  kind text default 'misc'
    check (kind in ('contract', 'invoice_received', 'vendor_proposal', 'venue_agreement', 'permit', 'photo', 'misc')),
  uploaded_by uuid references users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_workspace_idx on documents(workspace_id, created_at desc) where workspace_id is not null;
create index documents_org_idx on documents(org_id, created_at desc);

create trigger documents_updated_at before update on documents
  for each row execute function set_updated_at();

alter table documents enable row level security;

create policy documents_org_admin on documents for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Workspace members can see documents tied to their workspace
create policy documents_member_read on documents for select
  using (workspace_id is not null and workspace_id = auth_workspace_id());

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ─── 4. Studio P&L — planner_expenses + time_entries ─────────────────

create table planner_expenses (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  label text not null,
  amount_eur numeric(12,2) not null,
  category text not null default 'misc'
    check (category in ('vendor_payment', 'software', 'travel', 'marketing', 'office', 'taxes', 'misc')),
  paid_at timestamptz,
  due_at date,
  notes text,
  external_url text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planner_expenses_org_idx on planner_expenses(org_id, paid_at desc);
create index planner_expenses_workspace_idx on planner_expenses(workspace_id) where workspace_id is not null;

create trigger planner_expenses_updated_at before update on planner_expenses
  for each row execute function set_updated_at();

alter table planner_expenses enable row level security;

create policy planner_expenses_org_admin on planner_expenses for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

create table time_entries (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer,
  label text,
  billable boolean not null default true,
  hourly_rate_eur numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index time_entries_workspace_idx on time_entries(workspace_id, started_at desc);
create index time_entries_user_idx on time_entries(user_id, started_at desc);

create trigger time_entries_updated_at before update on time_entries
  for each row execute function set_updated_at();

alter table time_entries enable row level security;

create policy time_entries_org_admin on time_entries for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 5. Lead routing ─────────────────────────────────────────────────

alter table leads
  add column assigned_to_user_id uuid references users(id) on delete set null;

create index leads_assignee_idx on leads(assigned_to_user_id) where assigned_to_user_id is not null;

create table lead_routing_rules (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  -- Lower number = higher priority. First match wins.
  priority integer not null default 100,
  -- match_conditions is a JSONB blob of optional filter criteria.
  -- Examples:
  --   { "source": ["booking_page"] }
  --   { "budget_band": ["€80–150k", "€150k+"] }
  --   { "city_or_region_contains": ["Barcelona"] }
  --   { "guest_count_min": 150 }
  match_conditions jsonb not null default '{}'::jsonb,
  assignee_user_id uuid not null references users(id) on delete cascade,
  enabled boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_routing_rules_org_idx on lead_routing_rules(org_id, priority);

create trigger lead_routing_rules_updated_at before update on lead_routing_rules
  for each row execute function set_updated_at();

alter table lead_routing_rules enable row level security;

create policy lead_routing_rules_org_admin on lead_routing_rules for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 6. Testimonials ─────────────────────────────────────────────────

create table testimonials (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  -- Pre-fill data from the client/lead
  couple_names text,
  contact_email text,
  -- Submitted content
  quote text,
  rating integer check (rating between 1 and 5),
  photo_storage_path text,
  -- Audit
  status text not null default 'requested'
    check (status in ('requested', 'submitted', 'published', 'declined')),
  public_token uuid not null default uuid_generate_v4(),
  requested_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index testimonials_public_token_idx on testimonials(public_token);
create index testimonials_org_status_idx on testimonials(org_id, status, created_at desc);

create trigger testimonials_updated_at before update on testimonials
  for each row execute function set_updated_at();

alter table testimonials enable row level security;

create policy testimonials_org_admin on testimonials for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Anon read by token — API enforces token match in WHERE
create policy testimonials_anon_token_read on testimonials for select
  to anon
  using (true);

-- Anon read by org public_slug for published testimonials only — drives
-- the /book/<slug> "what couples say" section
create policy testimonials_published_public_read on testimonials for select
  to anon
  using (
    status = 'published'
    and org_id in (select id from organizations where public_slug is not null)
  );

-- ─── 7. Calendar connections ─────────────────────────────────────────

create table calendar_connections (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'apple', 'ical')),
  -- Display label for the connection
  label text,
  -- For Google OAuth (encrypted at app layer when we wire encryption — for
  -- now stored as-is; service is single-tenant). For ical: just the URL.
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  ical_url text,
  external_calendar_id text,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calendar_connections_user_idx on calendar_connections(user_id);
create unique index calendar_connections_user_provider_unique
  on calendar_connections(user_id, provider, coalesce(external_calendar_id, ''));

create trigger calendar_connections_updated_at before update on calendar_connections
  for each row execute function set_updated_at();

alter table calendar_connections enable row level security;

-- A user only sees their own calendar connections
create policy calendar_connections_self on calendar_connections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Cached external busy slots — used by the booking page to dim conflicts.
-- Refreshed by a sync job. Keep narrow: just (start, end) on the org's
-- timezone.
create table calendar_busy_slots (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  connection_id uuid not null references calendar_connections(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  external_event_id text,
  fetched_at timestamptz not null default now()
);

create index calendar_busy_slots_org_window_idx
  on calendar_busy_slots(org_id, starts_at);

alter table calendar_busy_slots enable row level security;

-- Org admins see all busy slots in their org
create policy calendar_busy_slots_org_admin on calendar_busy_slots for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Anon can read busy slots for orgs with a published booking page so
-- /book/<slug> can dim conflicting slots
create policy calendar_busy_slots_anon_read on calendar_busy_slots for select
  to anon
  using (
    org_id in (select id from organizations where public_slug is not null)
  );

-- ─── 8. Recurring tasks ──────────────────────────────────────────────

alter table playbook_tasks
  add column recurrence_rule text,
  add column recurrence_anchor text default 'wedding_date'
    check (recurrence_anchor in ('wedding_date', 'phase_start', 'created_at'));

-- Same on planning_tasks (already-applied per-couple version) so a
-- recurring task expands into N rows OR we mark the source as recurring
-- and lazily expand on read.
alter table planning_tasks
  add column recurrence_rule text,
  add column recurrence_parent_task_id uuid references planning_tasks(id) on delete cascade;

create index planning_tasks_recurrence_parent_idx
  on planning_tasks(recurrence_parent_task_id) where recurrence_parent_task_id is not null;
