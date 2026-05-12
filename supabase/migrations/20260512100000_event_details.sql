-- Move 5 — multi-event orchestration. Day 1 schema.
--
-- Adds a sidecar `event_details` table (per design doc Option A) that
-- stores per-event metadata (display_name, start_at, end_at, venue_id,
-- description, is_active, sort_order) keyed by (workspace_id, event_role).
--
-- The event_role enum + per-event scoping on guest_event_invitations,
-- timeline_items, floor_plans, venues already exists (see migrations
-- 20260505000004 + 20260508000001). This table fills the missing
-- "what does the couple call this event, when is it, where is it"
-- gap so /events can render a card grid and the AI co-pilot can answer
-- per-event questions.
--
-- Also adds budget_lines.event_role for per-event budget allocation.
-- Existing rows stay null = "shared across events" per Hursh's pick.

create table if not exists event_details (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  event_role event_role not null,

  -- Metadata
  display_name text,                    -- couple's custom name, optional
  start_at timestamptz,                 -- when this event starts (null = TBD)
  end_at timestamptz,                   -- when it ends (null = open-ended)
  venue_id uuid references venues(id) on delete set null,
  description text,                     -- short description / notes
  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, event_role)
);

create index if not exists event_details_workspace_idx
  on event_details(workspace_id, is_active, sort_order);

create trigger event_details_updated_at before update on event_details
  for each row execute function set_updated_at();

alter table event_details enable row level security;

-- Workspace members manage their own events. Pattern lifted exactly
-- from budget_lines (20260507000002_wave3_autopilot.sql) so we don't
-- introduce RLS drift across per-workspace tables.
create policy event_details_member_all on event_details for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- Org admins (planners) get read access for oversight / impersonation.
create policy event_details_org_admin_read on event_details for select
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── Per-event budget allocation ────────────────────────────────────
--
-- Existing budget_lines rows have event_role = null which the UI
-- interprets as "shared across events / main wedding" (per Hursh's
-- pick — "shared" framing). New AI-generated baselines can tag lines
-- with their dominant event (e.g., sangeet venue → 'sangeet').

alter table budget_lines
  add column if not exists event_role event_role;

create index if not exists budget_lines_event_role_idx
  on budget_lines(workspace_id, event_role);
