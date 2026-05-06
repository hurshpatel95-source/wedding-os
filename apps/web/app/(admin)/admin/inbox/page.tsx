import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Briefcase, CheckSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PlanningTaskRow {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
  due_date: string | null;
  phase: string | null;
}

interface VendorTaskRow {
  id: string;
  vendor_id: string;
  label: string;
  done: boolean;
  due_at: string | null;
}

interface VendorRow {
  id: string;
  name: string;
  workspace_id: string;
}

interface InboxItem {
  key: string;
  workspace_id: string;
  workspace_name: string;
  title: string;
  context: string;
  due_at: string | null;
  href: string;
  kind: "plan" | "vendor";
}

export default async function PlannerInboxPage() {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{
        data: Record<string, unknown>[] | null;
      }>;
    };
  };

  const [
    { data: workspaces },
    { data: planningTasksRaw },
    { data: vendorTasksRaw },
    { data: vendorsRaw },
  ] = await Promise.all([
    supabase.from("workspaces").select("id, name").order("name", { ascending: true }),
    sb
      .from("planning_tasks")
      .select("id, workspace_id, title, status, due_date, phase"),
    sb
      .from("vendor_tasks")
      .select("id, vendor_id, label, done, due_at"),
    sb.from("vendors").select("id, name, workspace_id"),
  ]);

  const workspaceById = new Map<string, string>();
  for (const w of workspaces ?? []) workspaceById.set(w.id, w.name);
  const vendors = ((vendorsRaw ?? []) as unknown as VendorRow[]) ?? [];
  const vendorById = new Map<string, VendorRow>();
  for (const v of vendors) vendorById.set(v.id, v);

  const items: InboxItem[] = [];

  for (const t of (planningTasksRaw ?? []) as unknown as PlanningTaskRow[]) {
    if (t.status === "done" || t.status === "na") continue;
    items.push({
      key: `plan-${t.id}`,
      workspace_id: t.workspace_id,
      workspace_name: workspaceById.get(t.workspace_id) ?? "Unknown",
      title: t.title,
      context: t.phase
        ? t.phase.replace(/_/g, " ")
        : "Plan task",
      due_at: t.due_date,
      href: `/plan`,
      kind: "plan",
    });
  }

  for (const t of (vendorTasksRaw ?? []) as unknown as VendorTaskRow[]) {
    if (t.done) continue;
    const v = vendorById.get(t.vendor_id);
    items.push({
      key: `vendor-${t.id}`,
      workspace_id: v?.workspace_id ?? "",
      workspace_name: v?.workspace_id
        ? workspaceById.get(v.workspace_id) ?? "Unknown"
        : "Unknown",
      title: t.label,
      context: v ? `Vendor · ${v.name}` : "Vendor task",
      due_at: t.due_at,
      href: `/vendors/${t.vendor_id}`,
      kind: "vendor",
    });
  }

  // Sort: overdue → today → soon → no-date last
  const now = Date.now();
  items.sort((a, b) => {
    const ad = a.due_at ? new Date(a.due_at).getTime() : Infinity;
    const bd = b.due_at ? new Date(b.due_at).getTime() : Infinity;
    return ad - bd;
  });

  // Bucket
  const overdue: InboxItem[] = [];
  const dueSoon: InboxItem[] = []; // next 14 days
  const later: InboxItem[] = [];
  const noDate: InboxItem[] = [];
  for (const it of items) {
    if (!it.due_at) {
      noDate.push(it);
      continue;
    }
    const dt = new Date(it.due_at).getTime();
    if (dt < now) overdue.push(it);
    else if (dt - now <= 14 * 24 * 60 * 60 * 1000) dueSoon.push(it);
    else later.push(it);
  }

  // Per-client roll-up
  type ClientRollup = { name: string; total: number; overdue: number };
  const rollups = new Map<string, ClientRollup>();
  for (const it of items) {
    const r = rollups.get(it.workspace_id) ?? {
      name: it.workspace_name,
      total: 0,
      overdue: 0,
    };
    r.total += 1;
    if (it.due_at && new Date(it.due_at).getTime() < now) r.overdue += 1;
    rollups.set(it.workspace_id, r);
  }
  const rollupList = Array.from(rollups.values()).sort(
    (a, b) => b.overdue - a.overdue || b.total - a.total,
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Studio inbox
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          What needs your attention
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Open tasks across all your clients — couple-side plan tasks +
          vendor outreach. Overdue first, then due-this-fortnight, then the
          long tail. Click any row to jump into that client&rsquo;s shell.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Overdue"
          value={String(overdue.length)}
          tone={overdue.length > 0 ? "red" : "stone"}
        />
        <StatCard
          label="Due in 14 days"
          value={String(dueSoon.length)}
          tone={dueSoon.length > 0 ? "amber" : "stone"}
        />
        <StatCard
          label="Open total"
          value={String(items.length)}
          tone="stone"
        />
      </section>

      {rollupList.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="mb-3 text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Per-client load
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rollupList.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between rounded-md border border-stone-100 bg-stone-50/40 px-3 py-2 text-sm"
                >
                  <div className="font-medium">{r.name}</div>
                  <div className="flex items-center gap-2">
                    {r.overdue > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {r.overdue} overdue
                      </Badge>
                    )}
                    <span className="text-[11px] uppercase tracking-[0.15em] text-stone-500">
                      {r.total} open
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <CheckSquare className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
            Nothing open across your clients. Inbox zero — go enjoy a coffee.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <Bucket
              label={`Overdue · ${overdue.length}`}
              tone="red"
              items={overdue}
            />
          )}
          {dueSoon.length > 0 && (
            <Bucket
              label={`Due in 14 days · ${dueSoon.length}`}
              tone="amber"
              items={dueSoon}
            />
          )}
          {later.length > 0 && (
            <Bucket
              label={`Later · ${later.length}`}
              tone="stone"
              items={later}
            />
          )}
          {noDate.length > 0 && (
            <Bucket
              label={`No date set · ${noDate.length}`}
              tone="stone"
              items={noDate}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "red" | "emerald" | "stone";
}) {
  const toneCls =
    tone === "red"
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : tone === "amber"
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : tone === "emerald"
          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
          : "bg-white border-stone-200";
  return (
    <div className={`rounded-2xl border ${toneCls} p-4`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl font-medium tabular-nums">
        {value}
      </div>
    </div>
  );
}

function Bucket({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "red" | "amber" | "stone";
  items: InboxItem[];
}) {
  const headerCls =
    tone === "red"
      ? "text-rose-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-stone-500";
  const now = Date.now();
  return (
    <Card>
      <CardContent className="py-4">
        <div
          className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] ${headerCls}`}
        >
          {tone === "red" && <AlertTriangle className="h-3 w-3" />}
          {label}
        </div>
        <ul className="divide-y divide-stone-100">
          {items.map((it) => {
            const dt = it.due_at ? new Date(it.due_at) : null;
            const daysOff = dt
              ? Math.round((dt.getTime() - now) / (1000 * 60 * 60 * 24))
              : null;
            const dueLabel =
              daysOff == null
                ? "no date"
                : daysOff < 0
                  ? `${Math.abs(daysOff)}d overdue`
                  : daysOff === 0
                    ? "today"
                    : daysOff === 1
                      ? "tomorrow"
                      : `in ${daysOff}d`;
            return (
              <li key={it.key} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    it.kind === "plan"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700",
                  )}
                >
                  {it.kind === "plan" ? (
                    <CheckSquare className="h-3 w-3" />
                  ) : (
                    <Briefcase className="h-3 w-3" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={it.href}
                    className="font-medium text-stone-900 hover:underline"
                  >
                    {it.title}
                  </Link>
                  <div className="line-clamp-1 text-[11px] uppercase tracking-[0.15em] text-stone-500">
                    {it.workspace_name} · {it.context}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[10px] uppercase tracking-[0.15em]",
                    daysOff != null && daysOff < 0
                      ? "text-rose-700"
                      : daysOff != null && daysOff <= 3
                        ? "text-amber-700"
                        : "text-stone-500",
                  )}
                >
                  {dueLabel}
                  {dt && (
                    <span className="ml-1 text-stone-400">
                      ({format(parseISO(it.due_at!), "MMM d")})
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
