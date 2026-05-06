-- The unified A-Z project tracker. Mixes operational items (auto-derivable
-- from venues / vendors / guests / pricing data) with personal items
-- (outfits, marriage license, vows) and cultural milestones (mehndi, sangeet).

create type task_status as enum ('not_started', 'in_progress', 'blocked', 'done', 'na');

create type task_phase as enum (
  'pre_12_months',     -- 12+ months out
  'months_9_12',
  'months_6_9',
  'months_3_6',
  'months_1_3',
  'final_month',
  'final_week',
  'day_of',
  'post_wedding'
);

create type task_owner as enum ('couple', 'planner', 'groom', 'bride', 'family', 'vendor');

create type task_category as enum (
  'venue',
  'vendor',
  'attire',
  'paperwork',
  'guest',
  'logistics',
  'design',
  'ritual',
  'finance',
  'honeymoon',
  'other'
);

create table planning_tasks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,

  category task_category not null,
  phase task_phase not null,
  sort_order integer not null default 0,

  title text not null,
  description text,

  status task_status not null default 'not_started',
  owner task_owner not null default 'couple',

  -- Anchored timing — months_before_wedding lets the UI compute a due date
  -- relative to workspace.wedding_date when one isn't explicit.
  months_before integer,
  due_date date,

  -- Auto-derive — when set, the row's status is recomputed from live data.
  -- Values: 'venue_decided', 'vendor_booked:photographer', 'all_guests_rsvp',
  -- 'deposits_paid:>0', etc. Implemented in apps/web/lib/plan-auto-derive.ts.
  auto_derive_kind text,

  -- Manual notes the couple/planner adds
  notes text,
  done_at timestamptz,
  done_by uuid references users(id) on delete set null,

  -- Optional link to a related entity for "Open" navigation
  related_kind text,                         -- 'venue', 'vendor', 'guest', 'scenario'
  related_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planning_tasks_workspace_idx
  on planning_tasks(workspace_id, phase, sort_order);
create index planning_tasks_status_idx on planning_tasks(workspace_id, status);
create index planning_tasks_owner_idx on planning_tasks(workspace_id, owner);

create trigger planning_tasks_updated_at before update on planning_tasks
  for each row execute function set_updated_at();

alter table planning_tasks enable row level security;

create policy planning_tasks_read on planning_tasks for select
  using (workspace_id = auth_workspace_id());
create policy planning_tasks_write on planning_tasks for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());
