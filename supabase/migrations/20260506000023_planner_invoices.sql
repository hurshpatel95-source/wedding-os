-- Planner billing — track what the COUPLE owes the PLANNER (retainers,
-- service fees, milestone invoices). Distinct from /payments which
-- tracks what the couple owes VENDORS.
--
-- v1: manual entry. No Stripe. Planner adds an invoice row, marks it
-- sent / viewed / paid. Couple sees a read-only list at /payments
-- so they can see what's outstanding to the planner.

create table planner_invoices (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  label text not null,                                  -- "Retainer · 50%"
  amount_eur numeric(12, 2) not null,
  due_at date,
  sent_at timestamptz,
  paid_at timestamptz,
  paid_via text,                                        -- "Bank transfer", "Wire", "Stripe link"
  notes text,
  external_url text,                                    -- e.g. Stripe invoice link to share
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planner_invoices_workspace_idx
  on planner_invoices(workspace_id, due_at);
create index planner_invoices_org_idx
  on planner_invoices(org_id, paid_at);

create trigger planner_invoices_updated_at before update on planner_invoices
  for each row execute function set_updated_at();

-- RLS:
-- Workspace members READ — couples see invoices they owe to their planner
-- Org_admins WRITE — only the planner (and the planner's team) can mutate
alter table planner_invoices enable row level security;

create policy planner_invoices_member_read on planner_invoices for select
  using (workspace_id = auth_workspace_id());

create policy planner_invoices_org_admin_write on planner_invoices for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');
