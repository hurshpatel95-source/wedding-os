import { differenceInCalendarDays, parseISO, addMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { applyAutoDerive } from "@/lib/plan-auto-derive";
import { PlanBoard } from "@/components/plan/plan-board";
import {
  BUDGET_CATEGORY_LABEL,
  type BudgetCategory,
} from "@/lib/autopilot-types";
import type { BudgetLineOption } from "@/components/plan/task-edit-drawer";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let workspaceId: string | null = null;
  let orgId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("workspace_id, org_id")
      .eq("id", user.id)
      .maybeSingle();
    workspaceId = profile?.workspace_id ?? null;
    orgId = profile?.org_id ?? null;
  }

  const [{ data: workspace }, { data: rawTasks }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name, wedding_date, base_currency")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("planning_tasks")
      .select("*")
      .order("phase", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  // Pull budget_lines so the task editor can offer "link this task to an
  // existing line". budget_lines isn't in generated types yet.
  const sbBudget = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        order: (col: string, opts?: { ascending?: boolean }) => Promise<{
          data: Array<{
            id: string;
            parent_line_id: string | null;
            category: string;
            label: string;
          }> | null;
        }>;
      };
    };
  };
  let budgetLineOptions: BudgetLineOption[] = [];
  try {
    const { data: lines } = await sbBudget
      .from("budget_lines")
      .select("id, parent_line_id, category, label")
      .order("sort_order", { ascending: true });
    if (lines) {
      const byId = new Map(lines.map((l) => [l.id, l]));
      // Surface parents first, then leaves grouped under their parent label.
      const parents = lines.filter((l) => !l.parent_line_id);
      const leaves = lines.filter((l) => l.parent_line_id);
      budgetLineOptions = [
        ...parents.map((p) => ({
          id: p.id,
          category: p.category,
          label: p.label,
          parent_label: null as string | null,
          is_parent: true,
        })),
        ...leaves.map((l) => {
          const parent = l.parent_line_id ? byId.get(l.parent_line_id) : null;
          return {
            id: l.id,
            category: l.category,
            label: l.label,
            parent_label:
              parent?.label ??
              BUDGET_CATEGORY_LABEL[l.category as BudgetCategory] ??
              l.category,
            is_parent: false,
          };
        }),
      ];
    }
  } catch {
    budgetLineOptions = [];
  }

  const weddingDate = workspace?.wedding_date ?? null;
  const daysUntil = weddingDate
    ? differenceInCalendarDays(parseISO(weddingDate), new Date())
    : null;

  // Compute due dates from months_before + wedding_date when explicit due_date is null
  const tasksWithDue = (rawTasks ?? []).map((t) => {
    if (t.due_date) return t;
    if (t.months_before == null || !weddingDate) return t;
    const d = addMonths(parseISO(weddingDate), -t.months_before);
    return { ...t, due_date: d.toISOString().slice(0, 10) };
  });

  const tasks = workspaceId
    ? await applyAutoDerive(tasksWithDue, workspaceId)
    : tasksWithDue;

  // Stats
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          A–Z project tracker · {total} tasks · {pct}% complete
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Wedding plan
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every task from now to honeymoon. Operations items (venue booked, vendors RFP'd,
          deposits paid) auto-update from your data — personal items (outfits, marriage license,
          vows) you check off manually.
          {daysUntil !== null && daysUntil > 0 && (
            <>
              {" "}
              <span className="text-stone-900">{daysUntil} days to go.</span>
            </>
          )}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total" value={total} />
        <Stat label="Done" value={done} tone="emerald" />
        <Stat label="In progress" value={inProgress} tone="amber" />
        <Stat label="Blocked" value={blocked} tone="rose" />
        <Stat label="Progress" value={`${pct}%`} tone="muted" />
      </section>

      <PlanBoard
        tasks={tasks}
        workspaceId={workspaceId}
        orgId={orgId}
        budgetLineOptions={budgetLineOptions}
        baseCurrency={workspace?.base_currency ?? "USD"}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number | string;
  tone?: "muted" | "emerald" | "amber" | "rose";
}) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : tone === "rose"
      ? "bg-rose-500"
      : "bg-stone-400";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 font-serif text-3xl font-light leading-none">{value}</div>
    </div>
  );
}
