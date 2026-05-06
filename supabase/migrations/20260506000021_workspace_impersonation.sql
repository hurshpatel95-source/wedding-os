-- Workspace impersonation for org_admins. Without this, the "View as
-- workspace" picker is purely cosmetic — RLS gates all couple-shell
-- queries on auth_workspace_id() which only ever returned the org_admin's
-- own workspace_id from the users row.
--
-- Approach: override table keyed on (user_id), only respected when the
-- user is an org_admin AND the impersonated workspace belongs to their
-- org. Switch is one-way: an org_admin sets it via the picker, RLS picks
-- up the new id transparently. Cleared when they exit the view.
--
-- Why a table instead of a JWT claim or HTTP cookie: Supabase RLS
-- helpers run inside Postgres, so they can't read HTTP headers. A JWT
-- claim would require minting our own JWTs (Supabase doesn't let us
-- modify the auth-issued ones). Table is simplest, cleanest, fast.

create table active_workspace_overrides (
  user_id uuid primary key references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  set_at timestamptz not null default now()
);

-- Replace auth_workspace_id() to honor the override when:
--   1. There IS an override row for this user, AND
--   2. The user is org_admin (only org_admins can impersonate), AND
--   3. The override workspace's org matches the user's org (anti-leak).
-- Otherwise fall back to the user's own workspace_id from users.
create or replace function auth_workspace_id() returns uuid
language sql stable security definer set search_path = public as $$
  select
    coalesce(
      (
        select o.workspace_id
        from active_workspace_overrides o
        join users u on u.id = o.user_id
        join workspaces w on w.id = o.workspace_id
        where o.user_id = auth.uid()
          and u.org_role = 'org_admin'
          and w.org_id = u.org_id
      ),
      (select workspace_id from users where id = auth.uid())
    )
$$;

-- RLS on the override table — only the user themselves can read/write
-- their own row.
alter table active_workspace_overrides enable row level security;
create policy own_override_rw on active_workspace_overrides for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
