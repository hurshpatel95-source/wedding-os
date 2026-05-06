-- Seating organizer — one floor plan per event/venue combo. Each plan
-- has N tables × M seats. Guests get assigned to a table (and optionally
-- a specific seat) per plan.
--
-- A guest can appear in multiple floor plans (Sangeet at table 3,
-- Wedding at table 12). Floor plans are workspace-scoped.

create table floor_plans (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,                                       -- e.g. "Wedding Day — MSL"
  venue_id uuid references venues(id) on delete set null,
  event_role event_role,                                    -- sangeet, wedding, etc
  table_count integer not null default 22 check (table_count >= 1 and table_count <= 200),
  seats_per_table integer not null default 10 check (seats_per_table >= 1 and seats_per_table <= 50),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index floor_plans_workspace_idx on floor_plans(workspace_id);

create trigger floor_plans_updated_at before update on floor_plans
  for each row execute function set_updated_at();

create table seating_assignments (
  id uuid primary key default uuid_generate_v4(),
  floor_plan_id uuid not null references floor_plans(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  table_number integer not null check (table_number >= 1),
  seat_number integer check (seat_number >= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one guest per floor plan
  unique (floor_plan_id, guest_id)
);

create index seating_assignments_plan_idx
  on seating_assignments(floor_plan_id, table_number);

create trigger seating_assignments_updated_at before update on seating_assignments
  for each row execute function set_updated_at();

-- RLS — workspace members read+write
alter table floor_plans enable row level security;
alter table seating_assignments enable row level security;

create policy floor_plans_member on floor_plans for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id() and org_id = auth_org_id());

create policy seating_assignments_member on seating_assignments for all
  using (
    exists (
      select 1 from floor_plans fp
      where fp.id = floor_plan_id and fp.workspace_id = auth_workspace_id()
    )
  )
  with check (
    exists (
      select 1 from floor_plans fp
      where fp.id = floor_plan_id and fp.workspace_id = auth_workspace_id()
    )
  );
