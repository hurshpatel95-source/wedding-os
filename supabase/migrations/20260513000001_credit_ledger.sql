-- AI Studio — credit ledger.
--
-- QUEUED for T1.1 part 2. Not applied yet. The in-memory stub in
-- apps/web/lib/studio/credits.ts serves Day 1 + Day 2 of the Studio
-- build. When T1.1 part 2 activates, this migration runs, and
-- credits.ts is rewritten to read/write this table instead of the Map.
--
-- Design notes:
--   - Append-only ledger. Every credit movement (spend OR grant) is a
--     row. `delta` is signed: negative for spend, positive for grant /
--     top-up. `balance_after` is denormalized for O(1) reads — query
--     the most-recent row to get the current balance.
--   - `reason` is a stable enum-ish string. Examples:
--       "topup_stripe"           — B2C credit pack purchase
--       "spend_tool_mood_board"  — generation spend, slug-prefixed
--       "grant_planner_tier"     — B2B monthly tier auto-grant
--       "promo"                  — manual planner grant for support
--   - `metadata` is JSON for tool slug, generation_id, Stripe charge
--     id, etc. Free-form so we don't have to migrate every time we
--     add a new spend reason.
--   - RLS: workspace members can read their own rows. Inserts happen
--     through service-role only — the API route writes the ledger
--     atomically with the generation record.

create table if not exists credit_ledger (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  delta integer not null,
  reason text not null,
  metadata jsonb,
  balance_after integer not null,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_workspace_idx
  on credit_ledger(workspace_id, created_at desc);

create index if not exists credit_ledger_org_idx
  on credit_ledger(org_id, created_at desc);

-- Useful sanity check: the balance never goes negative. We enforce in
-- application code (atomic check-then-spend), but a server-side guard
-- is cheap insurance.
alter table credit_ledger
  add constraint credit_ledger_balance_nonneg
  check (balance_after >= 0);

alter table credit_ledger enable row level security;

-- Workspace members can read their own ledger rows. Same pattern as
-- event_details + budget_lines.
create policy credit_ledger_member_read on credit_ledger for select
  using (workspace_id = auth_workspace_id());

-- Org admins (planners) read all rows in their org — for "refund this
-- bad generation" / "show me what credits got burned" review.
create policy credit_ledger_org_admin_read on credit_ledger for select
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Writes are service-role only. We do NOT add an insert policy here —
-- the API route uses the service-role client to write the ledger
-- atomically with the generation record.
