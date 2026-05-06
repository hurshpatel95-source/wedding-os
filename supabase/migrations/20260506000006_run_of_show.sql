-- Run-of-show / day-of timeline. Per Lucia memo §4: the feature most likely to make
-- planners advocate for the tool internally — used daily in the final 6 weeks of every
-- wedding. Items are scoped per event_role (sangeet, ceremony, reception, etc.).

create table timeline_items (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,

  event_role event_role not null,             -- which event this slot belongs to
  occurs_at timestamptz,                      -- absolute time (bias toward this) — null means "TBD"
  duration_minutes integer not null default 30,

  what text not null,                         -- "Bridal entrance", "Cake cutting"
  who_responsible text,                       -- "DJ Krish", "MOH"
  location text,                              -- "Mandap area" / "Front lawn"
  vendor_id uuid,                             -- optional reference; FK declared loose since vendors table is workspace-scoped
  notes text,

  sort_order integer not null default 0,      -- tiebreaker when occurs_at is null or equal

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index timeline_items_workspace_idx on timeline_items(workspace_id, event_role, occurs_at, sort_order);

create trigger timeline_items_updated_at before update on timeline_items
  for each row execute function set_updated_at();

alter table timeline_items enable row level security;

create policy timeline_items_read on timeline_items for select
  using (workspace_id = auth_workspace_id());
create policy timeline_items_admin_write on timeline_items for all
  using (workspace_id = auth_workspace_id() and auth_is_admin())
  with check (workspace_id = auth_workspace_id() and auth_is_admin());
