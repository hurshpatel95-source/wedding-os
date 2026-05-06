-- Venue date availability marks — track which venues are
-- available / tentative / held / booked / unavailable on specific
-- calendar dates so Hursh can plan venue holds and avoid double-bookings.

create type venue_date_status as enum (
  'available',
  'tentative',
  'held_by_us',
  'booked_by_us',
  'unavailable',
  'unknown'
);

create table venue_date_marks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  date date not null,
  status venue_date_status not null default 'unknown',
  notes text,
  source text,                                -- 'astia_deck' | 'astia_email' | 'manual'
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, date)
);

create index venue_date_marks_workspace_idx on venue_date_marks(workspace_id, date);
create index venue_date_marks_venue_idx on venue_date_marks(venue_id, date);

create trigger venue_date_marks_updated_at before update on venue_date_marks
  for each row execute function set_updated_at();

alter table venue_date_marks enable row level security;

create policy venue_date_marks_read on venue_date_marks for select
  using (workspace_id = auth_workspace_id());
create policy venue_date_marks_admin_write on venue_date_marks for all
  using (workspace_id = auth_workspace_id() and auth_is_admin())
  with check (workspace_id = auth_workspace_id() and auth_is_admin());
