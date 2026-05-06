-- Vendors are the work-as-relationship entities behind every "vendor & misc" line.
-- Per Lucia memo §1: planner-stable + per-wedding instance. Single table for now,
-- workspace-scoped; promote to org_vendors / workspace_vendors when we hit Stellata-scale.

create type vendor_category as enum (
  'florist',
  'decor',
  'transport',
  'guest_shuttle',
  'bridal_car',
  'photographer',
  'videographer',
  'photo_booth',
  'dj',
  'live_band',
  'dhol',
  'sound_av',
  'lighting',
  'mua_hair',
  'mehndi',
  'baraat_horse',
  'pandit',
  'priest_officiant',
  'stationery',
  'signage',
  'rentals_furniture',
  'lounge_furniture',
  'cake_dessert',
  'bar_mixology',
  'late_night_food',
  'permits_legal',
  'translator_emcee',
  'other'
);

create type vendor_status as enum (
  'researching',
  'rfp_sent',
  'quoted',
  'shortlisted',
  'booked',
  'completed',
  'declined'
);

create table vendors (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,

  category vendor_category not null,
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  instagram text,

  status vendor_status not null default 'researching',
  planner_rating integer check (planner_rating between 1 and 5),

  -- Pricing snapshot (most recent quote — full audit lives in vendor_quotes if we add it)
  quoted_price_eur numeric(12, 2),
  quoted_currency text default 'EUR',
  -- Deposit + final balance schedule
  deposit_amount_eur numeric(12, 2),
  deposit_due_at date,
  deposit_paid_at date,
  final_balance_eur numeric(12, 2),
  final_due_at date,
  final_paid_at date,
  -- Whether to roll into the scenario total (so couples can dry-run "what if we book this florist")
  include_in_pricing boolean not null default true,

  notes text,
  is_couple_visible boolean not null default true,

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendors_workspace_idx on vendors(workspace_id, status);
create index vendors_category_idx on vendors(workspace_id, category);

create trigger vendors_updated_at before update on vendors
  for each row execute function set_updated_at();

create table vendor_tasks (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  due_at date,
  assigned_to uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  notes text,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index vendor_tasks_vendor_idx on vendor_tasks(vendor_id, done, due_at);

create table vendor_attachments (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  kind text not null check (kind in ('contract', 'invoice', 'quote', 'moodboard', 'photo', 'other')),
  url text not null,
  label text,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index vendor_attachments_vendor_idx on vendor_attachments(vendor_id, kind);

-- RLS ----------------------------------------------------------------

alter table vendors enable row level security;
alter table vendor_tasks enable row level security;
alter table vendor_attachments enable row level security;

-- vendors: workspace read, admin write
create policy vendors_read on vendors for select
  using (workspace_id = auth_workspace_id());
create policy vendors_admin_write on vendors for all
  using (workspace_id = auth_workspace_id() and auth_is_admin())
  with check (workspace_id = auth_workspace_id() and auth_is_admin());

-- vendor_tasks: workspace read via vendor, couple+admin write own assignment
create policy vendor_tasks_read on vendor_tasks for select
  using (exists (
    select 1 from vendors v where v.id = vendor_tasks.vendor_id and v.workspace_id = auth_workspace_id()
  ));
create policy vendor_tasks_write on vendor_tasks for all
  using (exists (
    select 1 from vendors v where v.id = vendor_tasks.vendor_id and v.workspace_id = auth_workspace_id()
  ))
  with check (exists (
    select 1 from vendors v where v.id = vendor_tasks.vendor_id and v.workspace_id = auth_workspace_id()
  ));

-- vendor_attachments: workspace read via vendor, admin write
create policy vendor_attachments_read on vendor_attachments for select
  using (exists (
    select 1 from vendors v where v.id = vendor_attachments.vendor_id and v.workspace_id = auth_workspace_id()
  ));
create policy vendor_attachments_admin_write on vendor_attachments for all
  using (exists (
    select 1 from vendors v where v.id = vendor_attachments.vendor_id and v.workspace_id = auth_workspace_id()
  ) and auth_is_admin())
  with check (exists (
    select 1 from vendors v where v.id = vendor_attachments.vendor_id and v.workspace_id = auth_workspace_id()
  ) and auth_is_admin());

-- Storage bucket for vendor files (private — admin only)
insert into storage.buckets (id, name, public) values ('vendor-files', 'vendor-files', false)
  on conflict (id) do nothing;

create policy "vendor-files admin read"
  on storage.objects for select
  using (bucket_id = 'vendor-files' and auth.role() = 'authenticated');

create policy "vendor-files admin insert"
  on storage.objects for insert
  with check (bucket_id = 'vendor-files' and auth_is_admin());

create policy "vendor-files admin delete"
  on storage.objects for delete
  using (bucket_id = 'vendor-files' and auth_is_admin());
