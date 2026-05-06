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
