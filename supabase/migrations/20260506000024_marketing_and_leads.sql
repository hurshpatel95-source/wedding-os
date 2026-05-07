-- ─── Marketing surface for planners + lead capture + booking ─────────
--
-- Three tables + four columns. All org-scoped (the planner owns the
-- public-facing brand) but with anon-readable slices for the public
-- pages (/book/<orgSlug>) and anon-write slice for the inquiry form
-- (insert-only, sanitized at API layer).
--
-- 1. orgs.public_slug — the planner's public marketing slug. /book/<slug>
--    becomes the planner's calendly-style booking page.
-- 2. orgs.public_brand_md / public_hero_storage_path / contact_phone /
--    contact_email — drives the marketing page.
-- 3. booking_windows — recurring availability rules ("Every Tue/Thu
--    10am-2pm", "Wed 4-7pm"). Generates bookable slots on the page.
-- 4. leads — every inquiry submitted from /book/<slug> OR /w/<slug>'s
--    "Book a consult" CTA. Org-scoped roster of prospective couples.
-- 5. wedding_inquiries — couple-of-the-couple form on /w/<slug>
--    ("we'd like to invite friends to use this planner") — also flows to
--    the leads table but with workspace_id set, so the planner sees
--    where the lead came from.
--
-- Lead conversion: an org_admin clicks "Convert to client" on a lead row,
-- which provisions a workspace + invites the couple via magic link, and
-- stamps lead.converted_workspace_id.

-- ─── 1. Org public marketing fields ───────────────────────────────────

alter table organizations
  add column public_slug text unique,
  add column public_tagline text,
  add column public_brand_md text,
  add column public_hero_storage_path text,
  add column contact_phone text,
  add column contact_email text,
  add column booking_buffer_minutes int default 30,
  add column booking_slot_minutes int default 45,
  add column public_published_at timestamptz;

create index orgs_public_slug_idx on organizations(public_slug)
  where public_slug is not null;

-- ─── 2. Booking windows (recurring) ───────────────────────────────────

create table booking_windows (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- 0=Sun … 6=Sat (Postgres extract(dow))
  day_of_week int not null check (day_of_week between 0 and 6),
  start_minute int not null,                              -- 0..1440 from midnight
  end_minute int not null check (end_minute > start_minute),
  timezone text not null default 'Europe/Madrid',
  label text,                                             -- "Morning consults"
  created_at timestamptz not null default now()
);

create index booking_windows_org_idx on booking_windows(org_id);

alter table booking_windows enable row level security;

-- Org_admins manage their windows
create policy booking_windows_org_admin on booking_windows for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Anon can read windows for orgs with a public_slug — needed to compute
-- bookable slots on /book/<slug>.
create policy booking_windows_public_read on booking_windows for select
  to anon
  using (
    org_id in (select id from organizations where public_slug is not null)
  );

-- ─── 3. Leads (inquiries from public pages) ──────────────────────────

create type lead_status as enum (
  'new', 'contacted', 'booked_call', 'qualified', 'converted', 'lost'
);

create type lead_source as enum (
  'booking_page',          -- /book/<orgSlug> consult form
  'public_wedding_site',   -- /w/<slug> "book a consult" CTA
  'manual',                -- planner added by hand
  'referral'
);

create table leads (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- Only set when the lead came from /w/<slug> — tells the planner
  -- which existing client referred this lead.
  referring_workspace_id uuid references workspaces(id) on delete set null,
  source lead_source not null default 'manual',
  status lead_status not null default 'new',
  -- Couple data (always partial — they're prospects)
  couple_names text,
  partner_a_name text,
  partner_b_name text,
  email text,
  phone text,
  wedding_date date,
  guest_count int,
  budget_band text,                                       -- "€20-40k", "€40-80k", "€80k+"
  city_or_region text,
  notes text,
  -- If they booked a call slot, when:
  scheduled_call_at timestamptz,
  scheduled_call_duration_minutes int,
  -- Lead conversion → workspace
  converted_workspace_id uuid references workspaces(id) on delete set null,
  converted_at timestamptz,
  -- Free-form metadata blob: utm params, page they came from, etc.
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_org_status_idx on leads(org_id, status, created_at desc);
create index leads_org_scheduled_idx on leads(org_id, scheduled_call_at)
  where scheduled_call_at is not null;

create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();

alter table leads enable row level security;

-- Org_admins manage all leads in their org
create policy leads_org_admin on leads for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Note: NO anon policy on leads. Lead inserts go through service-role
-- in /api/public/leads with a strict allow-list of fields + rate-limit.

-- ─── 4. Marketing scorecard (cached SEO snapshots from agent) ─────────

create table marketing_scorecards (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  url text not null,
  -- Whole-page summary from the SEO agent
  title_text text,
  meta_description text,
  h1_count int,
  word_count int,
  has_call_to_action boolean,
  has_contact_info boolean,
  has_schema_org boolean,
  page_speed_seconds numeric(6,2),
  -- Claude-summarized scorecard (rendered as markdown on /admin/marketing)
  scorecard_md text,
  -- Top-3 prioritized fixes
  recommendations jsonb default '[]'::jsonb,
  -- Raw HTML head + first 2000 words for re-analysis
  raw_excerpt text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index marketing_scorecards_org_idx
  on marketing_scorecards(org_id, fetched_at desc);

alter table marketing_scorecards enable row level security;

create policy marketing_scorecards_org_admin on marketing_scorecards for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 5. Public-readable subset of organizations ──────────────────────
-- Anon needs to render /book/<orgSlug> and the SaaS /marketing landing.
-- Only published orgs (public_slug is not null) are exposed.

create policy orgs_public_read on organizations for select
  to anon
  using (public_slug is not null);
