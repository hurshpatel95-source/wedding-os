-- wedding-os init schema
-- Multi-tenant from day one: every workspace-scoped table carries org_id + workspace_id.

create extension if not exists "uuid-ossp";

-- enums --------------------------------------------------------------

create type user_role as enum ('admin', 'couple');
create type venue_status as enum ('shortlisted', 'visited', 'quoted', 'decided', 'passed');
create type indoor_outdoor as enum ('indoor', 'outdoor', 'both');
create type pricing_unit as enum ('per_guest', 'per_event', 'flat', 'per_hour', 'per_day');
create type pricing_tier as enum ('basic', 'standard', 'premium');

-- tenancy ------------------------------------------------------------

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  wedding_date date,
  base_currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create index workspaces_org_idx on workspaces(org_id);

-- users mirror auth.users with role + tenancy
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null,
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index users_workspace_idx on users(workspace_id);
create index users_org_idx on users(org_id);

-- venues -------------------------------------------------------------

create table venues (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  geo_lat numeric(10, 7),
  geo_lng numeric(10, 7),
  contact_name text,
  contact_email text,
  contact_phone text,
  hero_photo_url text,
  capacity_min integer,
  capacity_max integer,
  indoor_outdoor indoor_outdoor,
  in_house_catering boolean not null default false,
  has_accommodation boolean not null default false,
  planner_notes text,
  status venue_status not null default 'shortlisted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index venues_workspace_idx on venues(workspace_id);
create index venues_status_idx on venues(workspace_id, status);

create table venue_visits (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  visit_date date not null,
  attendees text[],
  walkthrough_notes text,
  couple_rating integer check (couple_rating between 1 and 5),
  couple_notes text,
  created_at timestamptz not null default now()
);

create index venue_visits_venue_idx on venue_visits(venue_id);

create table venue_photos (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  visit_id uuid references venue_visits(id) on delete set null,
  url text not null,
  caption text,
  uploaded_by uuid references users(id) on delete set null,
  taken_at timestamptz,
  favorited_by uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

create index venue_photos_venue_idx on venue_photos(venue_id);
create index venue_photos_visit_idx on venue_photos(visit_id);

create table venue_notes (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index venue_notes_venue_idx on venue_notes(venue_id, pinned desc, created_at desc);

-- pricing ------------------------------------------------------------

create table pricing_templates (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  currency_default text not null default 'EUR',
  created_at timestamptz not null default now()
);

create index pricing_templates_org_idx on pricing_templates(org_id);

create table pricing_categories (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references pricing_templates(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);

create index pricing_categories_template_idx on pricing_categories(template_id, sort_order);

create table pricing_line_items (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references pricing_categories(id) on delete cascade,
  label text not null,
  description text,
  unit pricing_unit not null,
  default_unit_price numeric(12, 2) not null,
  currency text not null default 'EUR',
  tier pricing_tier,
  sort_order integer not null default 0
);

create index pricing_line_items_category_idx on pricing_line_items(category_id, sort_order);

create table venue_pricing (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  template_id uuid not null references pricing_templates(id) on delete restrict,
  overrides jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  unique (venue_id, template_id)
);

create index venue_pricing_venue_idx on venue_pricing(venue_id);

create table pricing_scenarios (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  inputs jsonb not null,
  calculated_total numeric(12, 2) not null,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create index pricing_scenarios_workspace_idx on pricing_scenarios(workspace_id, venue_id);

-- updated_at trigger -------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger venues_updated_at before update on venues
  for each row execute function set_updated_at();
-- wedding-os RLS — every workspace-scoped table is locked to the caller's workspace.
-- Helpers read the caller's row from public.users; service_role bypasses RLS entirely.

create or replace function auth_workspace_id()
returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.users where id = auth.uid()
$$;

create or replace function auth_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.users where id = auth.uid()
$$;

create or replace function auth_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function auth_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false)
$$;

-- enable RLS ---------------------------------------------------------

alter table organizations enable row level security;
alter table workspaces enable row level security;
alter table users enable row level security;
alter table venues enable row level security;
alter table venue_visits enable row level security;
alter table venue_photos enable row level security;
alter table venue_notes enable row level security;
alter table pricing_templates enable row level security;
alter table pricing_categories enable row level security;
alter table pricing_line_items enable row level security;
alter table venue_pricing enable row level security;
alter table pricing_scenarios enable row level security;

-- organizations: read your own; admin writes
create policy organizations_read on organizations for select
  using (id = auth_org_id());
create policy organizations_admin_write on organizations for all
  using (id = auth_org_id() and auth_is_admin())
  with check (id = auth_org_id() and auth_is_admin());

-- workspaces: read your own; admin writes
create policy workspaces_read on workspaces for select
  using (id = auth_workspace_id());
create policy workspaces_admin_write on workspaces for all
  using (id = auth_workspace_id() and auth_is_admin())
  with check (id = auth_workspace_id() and auth_is_admin());

-- users: read everyone in your workspace; only admin writes
create policy users_read_workspace on users for select
  using (workspace_id = auth_workspace_id());
create policy users_admin_write on users for all
  using (workspace_id = auth_workspace_id() and auth_is_admin())
  with check (workspace_id = auth_workspace_id() and auth_is_admin());

-- venues: workspace read; admin write
create policy venues_read on venues for select
  using (workspace_id = auth_workspace_id());
create policy venues_admin_write on venues for all
  using (workspace_id = auth_workspace_id() and auth_is_admin())
  with check (workspace_id = auth_workspace_id() and auth_is_admin());

-- venue_visits: workspace read via venue; couple+admin can write
create policy venue_visits_read on venue_visits for select
  using (exists (
    select 1 from venues v where v.id = venue_visits.venue_id and v.workspace_id = auth_workspace_id()
  ));
create policy venue_visits_write on venue_visits for all
  using (exists (
    select 1 from venues v where v.id = venue_visits.venue_id and v.workspace_id = auth_workspace_id()
  ))
  with check (exists (
    select 1 from venues v where v.id = venue_visits.venue_id and v.workspace_id = auth_workspace_id()
  ));

-- venue_photos: workspace read; couple+admin write
create policy venue_photos_read on venue_photos for select
  using (exists (
    select 1 from venues v where v.id = venue_photos.venue_id and v.workspace_id = auth_workspace_id()
  ));
create policy venue_photos_write on venue_photos for all
  using (exists (
    select 1 from venues v where v.id = venue_photos.venue_id and v.workspace_id = auth_workspace_id()
  ))
  with check (exists (
    select 1 from venues v where v.id = venue_photos.venue_id and v.workspace_id = auth_workspace_id()
  ));

-- venue_notes: workspace read; couple+admin write
create policy venue_notes_read on venue_notes for select
  using (exists (
    select 1 from venues v where v.id = venue_notes.venue_id and v.workspace_id = auth_workspace_id()
  ));
create policy venue_notes_write on venue_notes for all
  using (exists (
    select 1 from venues v where v.id = venue_notes.venue_id and v.workspace_id = auth_workspace_id()
  ) and (author_id = auth.uid() or auth_is_admin()))
  with check (exists (
    select 1 from venues v where v.id = venue_notes.venue_id and v.workspace_id = auth_workspace_id()
  ) and (author_id = auth.uid() or auth_is_admin()));

-- pricing_templates: org read; admin write
create policy pricing_templates_read on pricing_templates for select
  using (org_id = auth_org_id());
create policy pricing_templates_admin_write on pricing_templates for all
  using (org_id = auth_org_id() and auth_is_admin())
  with check (org_id = auth_org_id() and auth_is_admin());

-- pricing_categories: read via template; admin write
create policy pricing_categories_read on pricing_categories for select
  using (exists (
    select 1 from pricing_templates t where t.id = pricing_categories.template_id and t.org_id = auth_org_id()
  ));
create policy pricing_categories_admin_write on pricing_categories for all
  using (exists (
    select 1 from pricing_templates t where t.id = pricing_categories.template_id and t.org_id = auth_org_id()
  ) and auth_is_admin())
  with check (exists (
    select 1 from pricing_templates t where t.id = pricing_categories.template_id and t.org_id = auth_org_id()
  ) and auth_is_admin());

-- pricing_line_items: read via category→template; admin write
create policy pricing_line_items_read on pricing_line_items for select
  using (exists (
    select 1 from pricing_categories c
    join pricing_templates t on t.id = c.template_id
    where c.id = pricing_line_items.category_id and t.org_id = auth_org_id()
  ));
create policy pricing_line_items_admin_write on pricing_line_items for all
  using (exists (
    select 1 from pricing_categories c
    join pricing_templates t on t.id = c.template_id
    where c.id = pricing_line_items.category_id and t.org_id = auth_org_id()
  ) and auth_is_admin())
  with check (exists (
    select 1 from pricing_categories c
    join pricing_templates t on t.id = c.template_id
    where c.id = pricing_line_items.category_id and t.org_id = auth_org_id()
  ) and auth_is_admin());

-- venue_pricing: workspace read via venue; admin write
create policy venue_pricing_read on venue_pricing for select
  using (exists (
    select 1 from venues v where v.id = venue_pricing.venue_id and v.workspace_id = auth_workspace_id()
  ));
create policy venue_pricing_admin_write on venue_pricing for all
  using (exists (
    select 1 from venues v where v.id = venue_pricing.venue_id and v.workspace_id = auth_workspace_id()
  ) and auth_is_admin())
  with check (exists (
    select 1 from venues v where v.id = venue_pricing.venue_id and v.workspace_id = auth_workspace_id()
  ) and auth_is_admin());

-- pricing_scenarios: workspace read+write
create policy pricing_scenarios_read on pricing_scenarios for select
  using (workspace_id = auth_workspace_id());
create policy pricing_scenarios_write on pricing_scenarios for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());
-- venue-photos bucket: public read (planner OK with public photos), authed write.

insert into storage.buckets (id, name, public)
values ('venue-photos', 'venue-photos', true)
on conflict (id) do update set public = excluded.public;

create policy "venue-photos public read"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

create policy "venue-photos authed insert"
  on storage.objects for insert
  with check (
    bucket_id = 'venue-photos'
    and auth.role() = 'authenticated'
  );

create policy "venue-photos owner update"
  on storage.objects for update
  using (
    bucket_id = 'venue-photos'
    and auth.uid() = owner
  );

create policy "venue-photos admin or owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'venue-photos'
    and (auth.uid() = owner or auth_is_admin())
  );
