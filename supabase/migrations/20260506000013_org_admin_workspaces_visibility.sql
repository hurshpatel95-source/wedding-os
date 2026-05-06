-- Wave 1 follow-up: org_admins can read every workspace inside their org.
--
-- The original `workspaces_member_read` policy only matched on
-- `id = auth_workspace_id()` — fine for couples (one workspace each) but
-- too narrow for org_admins who legitimately need every client workspace
-- in their org for the admin shell's "View as workspace" picker, the
-- /admin/clients roster, and any "push library item to workspace" UX.
--
-- Adds an additive policy. The existing member policy stays untouched.

create policy workspaces_org_admin_read on workspaces for select
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin');
