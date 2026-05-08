"use client";

// Estimator drill-down: click any category to expand it and see every leaf
// line under it. Edit the amount in-place (number entry) or swap the vendor
// — both PATCH back to /api/budget-lines/[id] and the totals recalc live.
//
// This is the "scenario-build" view: tweak vendor selections + amounts and
// watch how each category total + the grand total move. Persisted scenario
// snapshots are a future iteration (would need a budget_scenarios table).

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Save,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BUDGET_CATEGORY_LABEL,
  type BudgetCategory,
  type BudgetLineRow,
} from "@/lib/autopilot-types";
import { cn, formatCurrency, currencySymbol } from "@/lib/utils";

interface VendorOption {
  id: string;
  name: string;
  category: string | null;
  quoted_price_eur: number | null;
}

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  budget_line_id: string | null;
  estimated_cost: number | null;
}

interface CategoryBucket {
  category: string;
  estimated: number;
  committed: number;
  paid: number;
  lineCount: number;
}

export function EstimatorDrillDown({
  initialLines,
  vendors,
  baseCurrency,
  target,
  guestCount,
  linkedTasks = [],
}: {
  initialLines: BudgetLineRow[];
  vendors: VendorOption[];
  baseCurrency: string;
  target: number | null;
  guestCount: number | null;
  linkedTasks?: LinkedTask[];
}) {
  const [lines, setLines] = useState<BudgetLineRow[]>(initialLines);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingLine, setSavingLine] = useState<string | null>(null);

  const fmt = (n: number) => formatCurrency(n, baseCurrency);
  const sym = currencySymbol(baseCurrency);

  // Leaf lines = the ones that aren't a parent of anything.
  const leafLines = useMemo(
    () =>
      lines.filter((l) => !lines.some((other) => other.parent_line_id === l.id)),
    [lines],
  );

  // Bucket by category — each bucket holds its leaf lines.
  const buckets = useMemo(() => {
    const m = new Map<
      string,
      { bucket: CategoryBucket; lines: BudgetLineRow[] }
    >();
    for (const l of leafLines) {
      const cat = l.category ?? "misc";
      const est = Number(l.amount_estimated ?? l.total_eur ?? 0);
      const com = Number(l.amount_committed ?? 0);
      const paid = Number(l.amount_paid ?? 0);
      const entry = m.get(cat) ?? {
        bucket: {
          category: cat,
          estimated: 0,
          committed: 0,
          paid: 0,
          lineCount: 0,
        },
        lines: [],
      };
      entry.bucket.estimated += est;
      entry.bucket.committed += com;
      entry.bucket.paid += paid;
      entry.bucket.lineCount += 1;
      entry.lines.push(l);
      m.set(cat, entry);
    }
    return Array.from(m.values()).sort(
      (a, b) => b.bucket.estimated - a.bucket.estimated,
    );
  }, [leafLines]);

  const totalEstimated = buckets.reduce((a, b) => a + b.bucket.estimated, 0);
  const totalCommitted = buckets.reduce((a, b) => a + b.bucket.committed, 0);
  const totalPaid = buckets.reduce((a, b) => a + b.bucket.paid, 0);
  const overUnder = target ? totalEstimated - target : null;
  const perGuest =
    guestCount && guestCount > 0 ? totalEstimated / guestCount : null;

  async function patchLine(id: string, patch: Partial<BudgetLineRow>) {
    const optimistic = lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
    setLines(optimistic);
    setSavingLine(id);
    try {
      const res = await fetch(`/api/budget-lines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "Couldn't save change.");
        // revert
        setLines(initialLines);
      }
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
      setLines(initialLines);
    } finally {
      setSavingLine(null);
    }
  }

  // Group vendors by category for smart suggestions
  const vendorsByCategory = useMemo(() => {
    const m = new Map<string, VendorOption[]>();
    for (const v of vendors) {
      const k = v.category ?? "_misc";
      const list = m.get(k) ?? [];
      list.push(v);
      m.set(k, list);
    }
    return m;
  }, [vendors]);

  // Tasks indexed by budget_line_id so each leaf row can show its blockers
  const tasksByLineId = useMemo(() => {
    const m = new Map<string, LinkedTask[]>();
    for (const t of linkedTasks) {
      if (!t.budget_line_id) continue;
      const list = m.get(t.budget_line_id) ?? [];
      list.push(t);
      m.set(t.budget_line_id, list);
    }
    return m;
  }, [linkedTasks]);

  return (
    <div className="space-y-6">
      {/* Top totals — always visible, recalc live as edits happen */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat
          label="Estimated total"
          value={fmt(totalEstimated)}
          sub={
            perGuest
              ? `~${fmt(perGuest)} per guest`
              : `${leafLines.length} lines`
          }
          tone="stone"
        />
        <BigStat
          label="Committed"
          value={fmt(totalCommitted)}
          sub={
            totalEstimated > 0
              ? `${Math.round((totalCommitted / totalEstimated) * 100)}% locked`
              : "—"
          }
          tone="amber"
        />
        <BigStat
          label="Paid"
          value={fmt(totalPaid)}
          sub={
            totalEstimated > 0
              ? `${Math.round((totalPaid / totalEstimated) * 100)}% paid`
              : "—"
          }
          tone="emerald"
        />
        {target ? (
          <BigStat
            label="Vs target"
            value={`${(overUnder ?? 0) >= 0 ? "+" : "−"}${fmt(Math.abs(overUnder ?? 0))}`}
            sub={`Target: ${fmt(target)}`}
            tone={(overUnder ?? 0) > 0 ? "rose" : "emerald"}
          />
        ) : (
          <BigStat
            label="Target"
            value="—"
            sub="Set on /budget"
            tone="stone"
          />
        )}
      </section>

      {/* Help blurb */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 text-sm text-stone-700">
        <strong className="font-medium text-rose-900">
          Click any category
        </strong>{" "}
        to drill in. Per line, swap vendors or type a new estimate — totals
        recalc live. This is your scenario-builder: try different
        photographer × florist × catering combos to see what each costs.
      </div>

      {/* Categories with drill-down */}
      <div className="space-y-2">
        {buckets.map(({ bucket, lines: kids }) => {
          const isOpen = expanded[bucket.category] ?? false;
          const catLabel =
            BUDGET_CATEGORY_LABEL[bucket.category as BudgetCategory] ??
            bucket.category;
          const pctOfTotal =
            totalEstimated > 0
              ? (bucket.estimated / totalEstimated) * 100
              : 0;
          // Vendor suggestions for this category bucket — exact-match first,
          // then any vendor (couple may use a "rentals" vendor for music etc.)
          const exactMatch = vendorsByCategory.get(bucket.category) ?? [];
          const suggestedVendors = [
            ...exactMatch,
            ...vendors.filter((v) => v.category !== bucket.category),
          ];

          return (
            <Card key={bucket.category} className="overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpanded((e) => ({
                    ...e,
                    [bucket.category]: !e[bucket.category],
                  }))
                }
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-stone-50/60"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-stone-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-stone-500" />
                  )}
                  <div>
                    <div className="font-serif text-lg font-medium tracking-tight">
                      {catLabel}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                      {bucket.lineCount} line{bucket.lineCount === 1 ? "" : "s"}
                      {" · "}
                      {Math.round(pctOfTotal)}% of total
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-2xl font-medium tabular-nums">
                    {fmt(bucket.estimated)}
                  </div>
                  <div className="mt-0.5 flex justify-end gap-2 text-[10px] uppercase tracking-[0.15em]">
                    {bucket.committed > 0 && (
                      <span className="text-amber-700">
                        {fmt(bucket.committed)} committed
                      </span>
                    )}
                    {bucket.paid > 0 && (
                      <span className="text-emerald-700">
                        {fmt(bucket.paid)} paid
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {isOpen && (
                <CardContent className="border-t border-stone-200 bg-stone-50/30 py-4">
                  <div className="space-y-2">
                    {kids.map((line) => (
                      <LeafEditRow
                        key={line.id}
                        line={line}
                        vendors={suggestedVendors}
                        sym={sym}
                        fmt={fmt}
                        saving={savingLine === line.id}
                        onPatch={(patch) => patchLine(line.id, patch)}
                        linkedTasks={tasksByLineId.get(line.id) ?? []}
                      />
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-200 pt-3 text-sm">
                    <div className="text-xs text-stone-600">
                      Want to add a line, drag a slider, or delete? Use the
                      full editor on{" "}
                      <Link
                        href="/budget"
                        className="font-medium text-stone-900 underline"
                      >
                        /budget
                      </Link>
                      .
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const summary = `${catLabel} scenario · ${bucket.lineCount} lines · ${fmt(bucket.estimated)}`;
                        navigator.clipboard.writeText(summary).catch(() => {});
                        toast.success(`Copied: ${summary}`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-500"
                    >
                      <Save className="h-3 w-3" />
                      Copy scenario summary
                    </button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Link
          href="/budget"
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-800 transition hover:border-stone-500"
        >
          Open the full budget tree
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function LeafEditRow({
  line,
  vendors,
  sym,
  fmt,
  saving,
  onPatch,
  linkedTasks = [],
}: {
  line: BudgetLineRow;
  vendors: VendorOption[];
  sym: string;
  fmt: (n: number) => string;
  saving: boolean;
  onPatch: (patch: Partial<BudgetLineRow>) => void;
  linkedTasks?: LinkedTask[];
}) {
  const initial = Number(line.amount_estimated ?? line.total_eur ?? 0);
  const [amount, setAmount] = useState<string>(String(Math.round(initial)));
  const [editing, setEditing] = useState(false);

  function commitAmount() {
    setEditing(false);
    const n = Number(amount.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      setAmount(String(Math.round(initial)));
      return;
    }
    if (Math.round(n) === Math.round(initial)) return;
    onPatch({ amount_estimated: Math.round(n), total_eur: Math.round(n) });
  }

  const openTaskCount = linkedTasks.filter(
    (t) => t.status !== "done" && t.status !== "na",
  ).length;
  const doneTaskCount = linkedTasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-stone-900">{line.label}</div>
        {line.qty && line.unit_price_eur ? (
          <div className="mt-0.5 text-[11px] text-stone-500">
            {Number(line.qty).toLocaleString()} × {sym}
            {Number(line.unit_price_eur).toLocaleString()}
          </div>
        ) : null}
        {linkedTasks.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-stone-500">
            <span className="font-medium text-stone-700">Tasks:</span>
            {linkedTasks.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className={cn(
                  "rounded-full px-2 py-0.5",
                  t.status === "done"
                    ? "bg-emerald-50 text-emerald-700"
                    : t.status === "blocked"
                    ? "bg-rose-50 text-rose-700"
                    : t.status === "in_progress"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-stone-100 text-stone-600",
                )}
                title={`Status: ${t.status.replace(/_/g, " ")}`}
              >
                {t.title}
              </span>
            ))}
            {linkedTasks.length > 3 && (
              <span className="text-stone-400">
                +{linkedTasks.length - 3} more
              </span>
            )}
            {(openTaskCount > 0 || doneTaskCount > 0) && (
              <span className="ml-1 text-[10px] uppercase tracking-[0.12em] text-stone-400">
                {doneTaskCount}/{linkedTasks.length} done
              </span>
            )}
          </div>
        )}
      </div>

      {/* Vendor swap */}
      <Select
        value={line.vendor_id ?? "none"}
        onValueChange={(v) =>
          onPatch({ vendor_id: v === "none" ? null : v })
        }
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <Link2 className="mr-1 h-3 w-3 text-stone-500" />
          <SelectValue placeholder="No vendor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No vendor</SelectItem>
          {vendors.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
              {v.quoted_price_eur ? (
                <span className="ml-1 text-[10px] text-stone-500">
                  · {fmt(Number(v.quoted_price_eur))}
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Amount: click-to-edit */}
      {editing ? (
        <div className="flex items-center gap-1">
          <span className="text-sm text-stone-500">{sym}</span>
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={commitAmount}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                setAmount(String(Math.round(initial)));
                setEditing(false);
              }
            }}
            className="w-24 rounded border border-stone-300 px-2 py-1 text-right text-sm tabular-nums focus:border-stone-900 focus:outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "rounded px-2 py-1 text-right font-serif text-base font-medium tabular-nums hover:bg-stone-100",
            saving && "opacity-50",
          )}
          title="Click to edit amount"
        >
          {fmt(initial)}
        </button>
      )}

      {Number(line.amount_committed ?? 0) > 0 && (
        <Badge variant="warning" className="text-[10px]">
          {fmt(Number(line.amount_committed))} committed
        </Badge>
      )}
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
  tone: "amber" | "rose" | "emerald" | "stone";
}) {
  const cls =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-stone-200 bg-white";
  return (
    <div className={`rounded-2xl border ${cls} p-4`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-medium tabular-nums leading-tight md:text-3xl">
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[10px] uppercase tracking-[0.15em] opacity-70">
          {sub}
        </div>
      )}
    </div>
  );
}
