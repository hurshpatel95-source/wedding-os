-- Wave 2 — per-couple plan customization.
--
-- Adds two columns to `planning_tasks` so couples can layer their own custom
-- tasks on top of the playbook the planner pushes into their workspace, and
-- so the row can be linked back to the playbook phase that created it (which
-- enables editor-rename + future re-applies).
--
--   planning_tasks.phase_id       — FK to playbook_phases (nullable for
--                                    backward-compat with the 73 already-seeded
--                                    rows that pre-date the playbook).
--   planning_tasks.is_user_added  — true for ad-hoc tasks the couple added
--                                    via /plan; false for everything that
--                                    came from the playbook or seed.
--
-- The existing `phase` enum column stays — it's how legacy rows are grouped
-- in /plan and how the auto-derive helper segments stats. New rows written
-- by "Apply playbook" carry BOTH `phase` (the closest enum match) and
-- `phase_id` (the precise playbook row). Couples renaming a phase mutate the
-- playbook_phase row's label, which propagates to every task whose phase_id
-- points there.

alter table planning_tasks
  add column phase_id uuid references playbook_phases(id) on delete set null,
  add column is_user_added boolean not null default false;

create index planning_tasks_phase_id_idx on planning_tasks(phase_id);
