import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { NewExpenseDialog } from "@/components/admin-finances/new-expense-dialog";
import { NewTimeEntryDialog } from "@/components/admin-finances/new-time-entry-dialog";
import { ExpensesTable } from "@/components/admin-finances/expenses-table";
import { TimeEntriesTable } from "@/components/admin-finances/time-entries-table";
import {
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
  type PlannerExpenseRow,
  type TimeEntryRow,
} from "@/lib/wave2-types";

export const dynamic = "force-dynamic";

interface InvoiceRow {
  id: string;
  workspace_id: string;
  amount_eur: number;
  paid_at: string | null;
  created_at: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
}

interface VendorRow {
  id: string;
  name: string;
  workspace_id: string;
}

interface UserRow {
  id: string;
  email: string;
}

const CATEGORY_TONE: Record<ExpenseCategory, string> = {
  vendor_payment: "bg-rose-400",
  software: "bg-indigo-400",
  travel: "bg-amber-400",
  marketing: "bg-fuchsia-400",
  office: "bg-stone-400",
  taxes: "bg-slate-500",
  misc: "bg-stone-300",
};

export default async function StudioFinancesPage() {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{
        data: Array<Record<string, unknown>> | null;
      }>;
    };
  };

  const [
    { data: invoicesRaw },
    { data: expensesRaw },
    { data: timeRaw },
    { data: workspacesRaw },
    { data: vendorsRaw },
    { data: usersRaw },
  ] = await Promise.all([
    sb
      .from("planner_invoices")
      .select("id, workspace_id, amount_eur, paid_at, created_at"),
    sb
      .from("planner_expenses")
      .select(
        "id, org_id, workspace_id, vendor_id, label, amount_eur, category, paid_at, due_at, notes, external_url, created_by, created_at, updated_at",
      ),
    sb
      .from("time_entries")
      .select(
        "id, org_id, workspace_id, user_id, started_at, ended_at, duration_minutes, label, billable, hourly_rate_eur, notes, created_at, updated_at",
      ),
    sb.from("workspaces").select("id, name"),
    sb.from("vendors").select("id, name, workspace_id"),
    sb.from("users").select("id, email"),
  ]);

  const invoices = (invoicesRaw ?? []) as unknown as InvoiceRow[];
  const expenses = (expensesRaw ?? []) as unknown as PlannerExpenseRow[];
  const timeEntries = (timeRaw ?? []) as unknown as TimeEntryRow[];
  const workspaces = (workspacesRaw ?? []) as unknown as WorkspaceRow[];
  const vendors = (vendorsRaw ?? []) as unknown as VendorRow[];
  const users = (usersRaw ?? []) as unknown as UserRow[];

  const workspaceById = new Map<string, string>();
  for (const w of workspaces) workspaceById.set(w.id, w.name);
  const userById = new Map<string, string>();
  for (const u of users) userById.set(u.id, u.email);

  // Sort workspaces alphabetically for dropdowns
  const workspacesSorted = [...workspaces].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // ── YTD figures ──────────────────────────────────────────────────────
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let revenueYtd = 0;
  for (const inv of invoices) {
    if (!inv.paid_at) continue;
    if (new Date(inv.paid_at).getTime() >= yearStart) {
      revenueYtd += Number(inv.amount_eur);
    }
  }

  let expensesYtd = 0;
  for (const e of expenses) {
    if (!e.paid_at) continue;
    if (new Date(e.paid_at).getTime() >= yearStart) {
      expensesYtd += Number(e.amount_eur);
    }
  }
  const netYtd = revenueYtd - expensesYtd;

  let billableMinutesThisMonth = 0;
  for (const t of timeEntries) {
    if (!t.billable) continue;
    if (new Date(t.started_at).getTime() < monthStart) continue;
    if (t.duration_minutes != null) {
      billableMinutesThisMonth += Number(t.duration_minutes);
    }
  }
  const billableHoursThisMonth = billableMinutesThisMonth / 60;

  // ── 12-month rolling P&L ─────────────────────────────────────────────
  const months: {
    label: string;
    key: string;
    revenue: number;
    expenses: number;
    net: number;
  }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      key,
      revenue: 0,
      expenses: 0,
      net: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  for (const inv of invoices) {
    if (!inv.paid_at) continue;
    const d = new Date(inv.paid_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(k);
    if (idx != null) months[idx].revenue += Number(inv.amount_eur);
  }
  for (const e of expenses) {
    if (!e.paid_at) continue;
    const d = new Date(e.paid_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(k);
    if (idx != null) months[idx].expenses += Number(e.amount_eur);
  }
  for (const m of months) m.net = m.revenue - m.expenses;
  const maxBar = Math.max(
    1,
    ...months.flatMap((m) => [m.revenue, m.expenses]),
  );
  const netRange = Math.max(
    1,
    ...months.map((m) => Math.abs(m.net)),
  );

  // ── Expenses by category ─────────────────────────────────────────────
  const byCat = new Map<ExpenseCategory, number>();
  let totalExpensesAll = 0;
  for (const e of expenses) {
    const amt = Number(e.amount_eur);
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + amt);
    totalExpensesAll += amt;
  }
  const catList = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ── Recent rows ──────────────────────────────────────────────────────
  const recentExpenses = [...expenses]
    .sort((a, b) => {
      const ad = a.paid_at ?? a.created_at;
      const bd = b.paid_at ?? b.created_at;
      return bd.localeCompare(ad);
    })
    .slice(0, 10);

  const recentTime = [...timeEntries]
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Studio P&amp;L
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Finances
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Revenue from couples vs everything you spend running the studio —
            vendor payments, software, marketing, taxes. Time tracked per client
            rolls up here too.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewExpenseDialog
            workspaces={workspacesSorted}
            vendors={vendors}
            triggerLabel="New expense"
          />
          <NewTimeEntryDialog
            workspaces={workspacesSorted}
            triggerLabel="Log time"
            triggerVariant="outline"
          />
        </div>
      </header>

      {/* Stat row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat
          label="Revenue YTD"
          value={`€${Math.round(revenueYtd).toLocaleString()}`}
          sub={`${new Date().getFullYear()} so far`}
          tone="emerald"
        />
        <BigStat
          label="Expenses YTD"
          value={`€${Math.round(expensesYtd).toLocaleString()}`}
          sub={`${expenses.length} expense${expenses.length === 1 ? "" : "s"} on file`}
          tone="rose"
        />
        <BigStat
          label="Net YTD"
          value={`${netYtd < 0 ? "−" : ""}€${Math.round(Math.abs(netYtd)).toLocaleString()}`}
          sub={netYtd >= 0 ? "Profit" : "Loss"}
          tone={netYtd >= 0 ? "emerald" : "rose"}
        />
        <BigStat
          label="Billable hours · MTD"
          value={
            billableHoursThisMonth > 0
              ? billableHoursThisMonth.toFixed(1)
              : "0"
          }
          sub={`${Math.round(billableMinutesThisMonth)} min logged`}
          tone="stone"
        />
      </section>

      {/* Monthly P&L chart */}
      <Card>
        <CardContent className="py-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-xl">Monthly P&amp;L · last 12</h3>
            <div className="flex items-center gap-3 text-[11px] text-stone-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                Revenue
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-rose-400" />
                Expenses
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-stone-900" />
                Net
              </span>
            </div>
          </div>
          <div className="grid grid-cols-12 items-end gap-2">
            {months.map((m) => {
              const revH = Math.round((m.revenue / maxBar) * 120);
              const expH = Math.round((m.expenses / maxBar) * 120);
              // Net dot vertical position above bars: scale into the top 30px of a 150px column.
              const dotOffset = Math.round(
                15 + ((netRange - m.net) / (2 * netRange)) * 30,
              );
              return (
                <div
                  key={m.key}
                  className="flex flex-col items-center gap-1"
                  title={`${m.label}: rev €${Math.round(m.revenue).toLocaleString()}, exp €${Math.round(m.expenses).toLocaleString()}, net ${m.net >= 0 ? "+" : "−"}€${Math.round(Math.abs(m.net)).toLocaleString()}`}
                >
                  {/* Net dot row */}
                  <div className="relative h-4 w-full">
                    {(m.revenue > 0 || m.expenses > 0) && (
                      <span
                        className={`absolute left-1/2 -translate-x-1/2 inline-block h-2 w-2 rounded-full ${
                          m.net >= 0 ? "bg-emerald-700" : "bg-rose-700"
                        }`}
                        style={{
                          top: `${Math.min(Math.max(dotOffset, 2), 14)}px`,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex h-32 w-full items-end gap-0.5">
                    <div
                      className="flex-1 rounded-t bg-emerald-500"
                      style={{
                        height: `${Math.max(revH, m.revenue > 0 ? 4 : 0)}px`,
                      }}
                    />
                    <div
                      className="flex-1 rounded-t bg-rose-400"
                      style={{
                        height: `${Math.max(expH, m.expenses > 0 ? 4 : 0)}px`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Expenses by category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-5">
            <h3 className="font-serif text-xl">Expenses by category</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              All-time, top {catList.length || 0}.
            </p>
            {catList.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                No expenses logged yet.
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {catList.map(([cat, total]) => {
                  const pct =
                    totalExpensesAll > 0
                      ? Math.round((total / totalExpensesAll) * 100)
                      : 0;
                  return (
                    <li key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {EXPENSE_CATEGORY_LABEL[cat]}
                        </span>
                        <span className="text-stone-500 tabular-nums">
                          €{Math.round(total).toLocaleString()}
                          <span className="ml-2 text-stone-400">{pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                          className={`h-full ${CATEGORY_TONE[cat]}`}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <h3 className="font-serif text-xl">Quick math</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Lifetime totals (not just YTD).
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row
                k="Revenue collected (lifetime)"
                v={`€${Math.round(invoices.filter((i) => i.paid_at).reduce((a, i) => a + Number(i.amount_eur), 0)).toLocaleString()}`}
              />
              <Row
                k="Expenses paid (lifetime)"
                v={`€${Math.round(expenses.filter((e) => e.paid_at).reduce((a, e) => a + Number(e.amount_eur), 0)).toLocaleString()}`}
              />
              <Row
                k="Unpaid expenses on the books"
                v={`€${Math.round(expenses.filter((e) => !e.paid_at).reduce((a, e) => a + Number(e.amount_eur), 0)).toLocaleString()}`}
              />
              <Row
                k="Time entries logged"
                v={String(timeEntries.length)}
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Recent expenses */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-xl">Recent expenses</h3>
          <span className="text-xs text-stone-500">
            Last {recentExpenses.length} of {expenses.length}
          </span>
        </div>
        <ExpensesTable
          expenses={recentExpenses}
          workspaceById={workspaceById}
          emptyHint="No expenses logged yet. Click + New expense to add the first one."
        />
      </section>

      {/* Recent time */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-xl">Recent time entries</h3>
          <span className="text-xs text-stone-500">
            Last {recentTime.length} of {timeEntries.length}
          </span>
        </div>
        <TimeEntriesTable
          entries={recentTime}
          workspaceById={workspaceById}
          userById={userById}
          showClient
          emptyHint="No time logged yet. Click Log time to add the first entry."
        />
      </section>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "emerald" | "rose" | "stone";
}) {
  const toneCls =
    tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : tone === "rose"
        ? "bg-rose-50 border-rose-200 text-rose-900"
        : "bg-white border-stone-200";
  return (
    <div className={`rounded-2xl border ${toneCls} p-4`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl font-medium tabular-nums leading-tight md:text-4xl">
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] uppercase tracking-[0.15em] opacity-70">
          {sub}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 py-2 last:border-b-0">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right font-medium tabular-nums text-stone-900">
        {v}
      </dd>
    </div>
  );
}
