-- Planner-OS Wave 1 — foundation slab for the multi-tenant SaaS pivot.
-- Adds an `org_role` distinct from the existing `role` (admin/couple),
-- introduces org-scoped Library + Playbook tables shared across all of a
-- planner's couple workspaces, and a per-workspace branding row.
--
-- IMPORTANT: existing `users.role` is left UNTOUCHED. `org_role` is the new
-- planner-vs-couple axis. The data migration script flips role='admin' rows
-- to org_role='org_admin' and role='couple' rows to org_role='member'.

-- enums --------------------------------------------------------------

create type org_role as enum ('org_admin', 'member');

-- users gets the new column ------------------------------------------

alter table users
  add column org_role org_role not null default 'member';

-- helper that mirrors the auth_role() / auth_is_admin() pattern
create or replace function auth_org_role()
returns org_role language sql stable security definer set search_path = public as $$
  select org_role from public.users where id = auth.uid()
$$;

-- ===================================================================
-- Library — venues, vendors. Org-scoped, shared across a planner's
-- couple workspaces. Distinct from the per-workspace `venues` and
-- `vendors` tables, which represent the specific shortlist for one
-- couple's wedding.
-- ===================================================================

create table library_venues (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text,
  address text,
  city text,
  region text,
  country text,
  lat numeric,
  lng numeric,
  capacity_seated integer,
  capacity_standing integer,
  hire_fee_eur numeric(12, 2),
  hire_fee_notes text,
  spaces jsonb not null default '[]'::jsonb,
  event_roles event_role[] not null default '{}',
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  description text,
  internal_notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index library_venues_org_idx on library_venues(org_id, name);

create trigger library_venues_updated_at before update on library_venues
  for each row execute function set_updated_at();

create table library_venue_media (
  id uuid primary key default uuid_generate_v4(),
  library_venue_id uuid not null references library_venues(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text,
  sort_order integer not null default 0,
  alt text,
  created_at timestamptz not null default now()
);

create index library_venue_media_venue_idx
  on library_venue_media(library_venue_id, sort_order);

create table library_vendors (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category vendor_category not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  default_quoted_price_eur numeric(12, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index library_vendors_org_idx on library_vendors(org_id, category, name);

create trigger library_vendors_updated_at before update on library_vendors
  for each row execute function set_updated_at();

-- ===================================================================
-- Playbook — phases + tasks. Org-scoped template a planner reuses
-- across every couple workspace. Distinct from per-workspace
-- `planning_tasks`, which are the actual instantiated tasks.
-- ===================================================================

create table playbook_phases (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  anchor_kind text check (anchor_kind in (
    'months_before_wedding',
    'weeks_before_wedding',
    'days_before_wedding',
    'absolute'
  )),
  anchor_value_int integer
);

create index playbook_phases_org_idx on playbook_phases(org_id, sort_order);

create table playbook_tasks (
  id uuid primary key default uuid_generate_v4(),
  playbook_phase_id uuid not null references playbook_phases(id) on delete cascade,
  title text not null,
  description text,
  owner_default text,
  category text,
  sort_order integer not null default 0,
  auto_derive_kind text
);

create index playbook_tasks_phase_idx
  on playbook_tasks(playbook_phase_id, sort_order);

-- ===================================================================
-- Workspace branding — one row per couple workspace. Couples see
-- their planner's accent + display name. Org-admins write.
-- ===================================================================

create table workspace_branding (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  accent_hex text not null default '#9d174d',
  logo_storage_path text,
  planner_display_name text,
  updated_at timestamptz not null default now()
);

create trigger workspace_branding_updated_at before update on workspace_branding
  for each row execute function set_updated_at();

-- ===================================================================
-- RLS — every new table org-admin gated where applicable.
-- ===================================================================

alter table library_venues enable row level security;
alter table library_venue_media enable row level security;
alter table library_vendors enable row level security;
alter table playbook_phases enable row level security;
alter table playbook_tasks enable row level security;
alter table workspace_branding enable row level security;

-- library_venues: org-admins do CRUD inside their org
create policy library_venues_admin on library_venues for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- library_venue_media: scoped via parent venue
create policy library_venue_media_admin on library_venue_media for all
  using (exists (
    select 1 from library_venues lv
    where lv.id = library_venue_media.library_venue_id
      and lv.org_id = auth_org_id()
  ) and auth_org_role() = 'org_admin')
  with check (exists (
    select 1 from library_venues lv
    where lv.id = library_venue_media.library_venue_id
      and lv.org_id = auth_org_id()
  ) and auth_org_role() = 'org_admin');

-- library_vendors
create policy library_vendors_admin on library_vendors for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- playbook_phases
create policy playbook_phases_admin on playbook_phases for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- playbook_tasks: scoped via parent phase
create policy playbook_tasks_admin on playbook_tasks for all
  using (exists (
    select 1 from playbook_phases pp
    where pp.id = playbook_tasks.playbook_phase_id
      and pp.org_id = auth_org_id()
  ) and auth_org_role() = 'org_admin')
  with check (exists (
    select 1 from playbook_phases pp
    where pp.id = playbook_tasks.playbook_phase_id
      and pp.org_id = auth_org_id()
  ) and auth_org_role() = 'org_admin');

-- workspace_branding: members of a workspace can read; org-admins write.
create policy workspace_branding_read on workspace_branding for select
  using (workspace_id = auth_workspace_id());

create policy workspace_branding_admin_insert on workspace_branding for insert
  with check (
    workspace_id in (select id from workspaces where org_id = auth_org_id())
    and auth_org_role() = 'org_admin'
  );

create policy workspace_branding_admin_update on workspace_branding for update
  using (
    workspace_id in (select id from workspaces where org_id = auth_org_id())
    and auth_org_role() = 'org_admin'
  )
  with check (
    workspace_id in (select id from workspaces where org_id = auth_org_id())
    and auth_org_role() = 'org_admin'
  );

create policy workspace_branding_admin_delete on workspace_branding for delete
  using (
    workspace_id in (select id from workspaces where org_id = auth_org_id())
    and auth_org_role() = 'org_admin'
  );

-- ===================================================================
-- Storage bucket for library media (logos, venue photos, etc).
-- Bucket flagged public:false; storage policies gate access to org_admins.
-- ===================================================================

insert into storage.buckets (id, name, public)
  values ('library-media', 'library-media', false)
  on conflict (id) do nothing;

create policy "library-media admin read"
  on storage.objects for select
  using (bucket_id = 'library-media' and auth_org_role() = 'org_admin');

create policy "library-media admin insert"
  on storage.objects for insert
  with check (bucket_id = 'library-media' and auth_org_role() = 'org_admin');

create policy "library-media admin delete"
  on storage.objects for delete
  using (bucket_id = 'library-media' and auth_org_role() = 'org_admin');
