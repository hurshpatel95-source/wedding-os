-- Estimator — couple-facing budget tool seeded from planner-provided
-- "estimated initial budget" PDFs. Each row is one full scenario with
-- collapsible sections of line items. Every line carries the planner's
-- baseline price + an optional user override + the verbatim source quote.
--
-- Local-only by design: overrides DO NOT push to the master pricing
-- template or to /pricing scenario inputs. This is the couple's honest-budget
-- view, decoupled from venue-comparison work.

create table budget_estimates (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,

  name text not null,                  -- "Casa + MSL (Sept 11–12)"
  source_label text,                   -- "Astia 06.05.2026"
  scenario_summary text,               -- one-liner shown on cards
  cover_emoji text,                    -- 🏛️ / 🏔️ / 🌊 — hint per scenario
  guest_count integer,                 -- baseline guest count assumed by sections
  start_date date,
  end_date date,

  -- The full structure as one JSONB blob. See estimator-types.ts for shape.
  -- Sections[] -> Lines[] with astha_eur + override_eur + included + evidence.
  sections jsonb not null,

  -- Astha's stated bottom line (sum of section totals from the PDF as printed).
  -- Stored separately from computed totals so we can show the "diff vs baseline".
  baseline_total_eur numeric(12, 2),

  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_estimates_workspace_idx
  on budget_estimates(workspace_id, is_active, sort_order);

create trigger budget_estimates_updated_at before update on budget_estimates
  for each row execute function set_updated_at();

-- RLS: every workspace member (couple OR admin) can read AND write their
-- own estimates. The couple is the primary user of this surface.
alter table budget_estimates enable row level security;

create policy budget_estimates_member_read on budget_estimates for select
  using (workspace_id = auth_workspace_id());

create policy budget_estimates_member_write on budget_estimates for all
  using (workspace_id = auth_workspace_id() and org_id = auth_org_id())
  with check (workspace_id = auth_workspace_id() and org_id = auth_org_id());
