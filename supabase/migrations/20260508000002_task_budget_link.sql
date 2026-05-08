-- Tie each /plan task to a /budget line item.
--
-- Goal: when the couple looks at "Book photographer", they see the
-- estimated cost. When they look at the photographer line in /budget,
-- they see all the tasks blocking that line. The estimator then rolls
-- up "tasks not yet started but money already estimated" into a clearer
-- forecast.
--
-- Design choice: 1 task → 0 or 1 budget line. A line can have many tasks.
-- We keep the column nullable so existing tasks continue to render.
--
-- Auto-create-on-cost: when the couple types an estimated_cost on a task
-- WITHOUT linking it to an existing line, the API auto-creates a leaf
-- line under the matching budget category and back-links it. That keeps
-- /plan and /budget in sync without forcing the couple to think about
-- two places.

alter table planning_tasks
  add column if not exists budget_line_id uuid
    references budget_lines(id) on delete set null,
  add column if not exists estimated_cost numeric(12, 2);

create index if not exists planning_tasks_budget_line_idx
  on planning_tasks(budget_line_id);
