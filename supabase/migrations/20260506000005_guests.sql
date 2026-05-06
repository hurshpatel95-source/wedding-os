-- Guest list — workspace-scoped, with per-event invitation rows.
-- Per Lucia memo §5: "Guest list + per-event invitations" — drives catering counts,
-- seating, and the couple portal's RSVP/dietary breakdown.

create type rsvp_status as enum ('pending', 'yes', 'no', 'maybe');
create type guest_side as enum ('groom', 'bride', 'both');

create table guests (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,

  full_name text not null,
  email text,
  phone text,

  side guest_side,
  relationship text,                          -- "uncle", "college friend", etc.
  household_id uuid references guests(id) on delete set null,
  is_household_head boolean not null default false,

  -- single freetext address (we'll structure later if needed)
  address text,
  city text,
  region text,
  postal_code text,
  country text,

  dietary text,                               -- "vegetarian, no alcohol"
  allergies text,
  notes text,

  -- aggregate RSVP — overrides per-event when set
  overall_rsvp rsvp_status not null default 'pending',

  -- workflow
  added_by uuid references users(id) on delete set null,
  imported_from uuid,                         -- guest_imports.id (FK added below)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guests_workspace_idx on guests(workspace_id);
create index guests_workspace_side_idx on guests(workspace_id, side);
create index guests_workspace_rsvp_idx on guests(workspace_id, overall_rsvp);
create index guests_household_idx on guests(household_id);

create trigger guests_updated_at before update on guests
  for each row execute function set_updated_at();

-- Per-event invitation row. One per (guest, event_role).
create table guest_event_invitations (
  id uuid primary key default uuid_generate_v4(),
  guest_id uuid not null references guests(id) on delete cascade,
  event_role event_role not null,
  is_invited boolean not null default true,
  rsvp rsvp_status not null default 'pending',
  table_assignment text,
  notes text,
  created_at timestamptz not null default now(),
  unique (guest_id, event_role)
);

create index guest_event_invitations_event_idx
  on guest_event_invitations(event_role, rsvp)
  where is_invited = true;

-- Audit row for each Excel/CSV ingest run.
create table guest_imports (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  uploaded_by uuid references users(id) on delete set null,
  source_filename text,
  storage_path text,                          -- private bucket key
  source_kind text not null check (source_kind in ('excel', 'csv', 'paste')),

  rows_total integer,
  rows_imported integer,
  rows_skipped integer,

  -- Claude metadata
  claude_model text,
  claude_mapping jsonb,                       -- { full_name: "A", email: "B", ... }
  claude_confidence numeric(4, 3),
  claude_request jsonb,                       -- redacted preview rows + prompt
  claude_response jsonb,                      -- full structured response
  prompt_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 4),

  status text not null default 'pending',     -- pending | parsed | committed | failed
  error text,

  created_at timestamptz not null default now()
);

create index guest_imports_workspace_idx on guest_imports(workspace_id, created_at desc);

alter table guests
  add constraint guests_imported_from_fk
  foreign key (imported_from) references guest_imports(id) on delete set null;

-- RLS — workspace read for everyone; admin writes
alter table guests enable row level security;
alter table guest_event_invitations enable row level security;
alter table guest_imports enable row level security;

create policy guests_read on guests for select
  using (workspace_id = auth_workspace_id());
create policy guests_admin_write on guests for all
  using (workspace_id = auth_workspace_id() and auth_is_admin())
  with check (workspace_id = auth_workspace_id() and auth_is_admin());

create policy guest_invitations_read on guest_event_invitations for select
  using (exists (
    select 1 from guests g where g.id = guest_event_invitations.guest_id and g.workspace_id = auth_workspace_id()
  ));
create policy guest_invitations_admin_write on guest_event_invitations for all
  using (exists (
    select 1 from guests g where g.id = guest_event_invitations.guest_id and g.workspace_id = auth_workspace_id()
  ) and auth_is_admin())
  with check (exists (
    select 1 from guests g where g.id = guest_event_invitations.guest_id and g.workspace_id = auth_workspace_id()
  ) and auth_is_admin());

create policy guest_imports_admin on guest_imports for all
  using (workspace_id = auth_workspace_id() and auth_is_admin())
  with check (workspace_id = auth_workspace_id() and auth_is_admin());

-- Storage bucket for uploaded guest-list files (private — admin only).
insert into storage.buckets (id, name, public) values ('guest-imports', 'guest-imports', false)
  on conflict (id) do nothing;

create policy "guest-imports admin read"
  on storage.objects for select
  using (bucket_id = 'guest-imports' and auth_is_admin());

create policy "guest-imports admin insert"
  on storage.objects for insert
  with check (bucket_id = 'guest-imports' and auth_is_admin());

create policy "guest-imports admin delete"
  on storage.objects for delete
  using (bucket_id = 'guest-imports' and auth_is_admin());
