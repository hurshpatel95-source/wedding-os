"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  List,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  VENDOR_CATEGORY_ICON,
  VENDOR_CATEGORY_LABEL,
  VENDOR_STATUS_LABEL,
} from "@/lib/vendor-categories";
import type { Milestone } from "@/app/(app)/payments/page";

type View = "calendar" | "list";

type Tone = "emerald" | "amber" | "rose" | "stone";

function toneOf(m: Milestone, today: Date): Tone {
  if (m.paid_at) return "emerald";
  if (m.is_overdue) return "rose";
  const due = parseISO(m.due_at);
  const in30 = addDays(today, 30);
  if (due >= today && due <= in30) return "amber";
  return "stone";
}

const PILL_TONE: Record<Tone, string> = {
  emerald: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
  amber: "bg-amber-100 text-amber-900 hover:bg-amber-200",
  rose: "bg-rose-100 text-rose-900 hover:bg-rose-200",
  stone: "bg-stone-100 text-stone-700 hover:bg-stone-200",
};

const TONE_LABEL: Record<Tone, string> = {
  emerald: "Paid",
  amber: "Upcoming",
  rose: "Overdue",
  stone: "Future",
};

export function PaymentsCalendar({
  milestones,
  role,
  baseCurrency = "USD",
}: {
  milestones: Milestone[];
  role: "admin" | "couple" | null;
  /** Workspace base currency — controls money formatting throughout. */
  baseCurrency?: string;
}) {
  const fmt = (n: number) => formatCurrency(n, baseCurrency);
  const router = useRouter();
  const [view, setView] = useState<View>("calendar");
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return startOfMonth(d);
  });
  const [selected, setSelected] = useState<Milestone | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Group milestones by ISO date for fast lookup
  const byDate = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    for (const m of milestones) {
      const key = m.due_at.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return map;
  }, [milestones]);

  // Build the visible 6-week grid for the cursor month
  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = first;
    while (d <= last) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [cursor]);

  // Sorted milestones grouped by month for List view
  const monthGroups = useMemo(() => {
    const sorted = [...milestones].sort((a, b) => a.due_at.localeCompare(b.due_at));
    const groups = new Map<string, Milestone[]>();
    for (const m of sorted) {
      const key = format(parseISO(m.due_at), "yyyy-MM");
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [milestones]);

  const markPaid = async (m: Milestone) => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const sb = supabase as unknown as {
      from: (table: string) => {
        update: (
          values: Record<string, unknown>,
        ) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
    const column = m.kind === "deposit" ? "deposit_paid_at" : "final_paid_at";
    const { error: updErr } = await sb
      .from("vendors")
      .update({ [column]: new Date().toISOString() })
      .eq("id", m.vendor_id);
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setSelected(null);
    router.refresh();
  };

  const markUnpaid = async (m: Milestone) => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const sb = supabase as unknown as {
      from: (table: string) => {
        update: (
          values: Record<string, unknown>,
        ) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
    const column = m.kind === "deposit" ? "deposit_paid_at" : "final_paid_at";
    const { error: updErr } = await sb
      .from("vendors")
      .update({ [column]: null })
      .eq("id", m.vendor_id);
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setSelected(null);
    router.refresh();
  };

  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white/60 p-12 text-center shadow-sm">
        <CalendarIcon className="mx-auto h-10 w-10 text-stone-400" />
        <p className="mt-4 font-serif text-xl text-stone-700">
          No payment milestones yet.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add deposit amounts and due dates on each vendor&apos;s Pricing tab and they&apos;ll show
          up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle + month nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white/60 p-1">
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              view === "calendar"
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              view === "list"
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900",
            )}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>

        {view === "calendar" && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[10rem] text-center font-serif text-lg">
              {format(cursor, "MMMM yyyy")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCursor(startOfMonth(today))}
            >
              Today
            </Button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
        <LegendDot tone="emerald" label="Paid" />
        <LegendDot tone="amber" label="Upcoming (30d)" />
        <LegendDot tone="rose" label="Overdue" />
        <LegendDot tone="stone" label="Future" />
      </div>

      {view === "calendar" ? (
        <div className="rounded-2xl border border-stone-200 bg-white/60 shadow-sm">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-stone-200 text-[10px] uppercase tracking-[0.2em] text-stone-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-2 py-2 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, cursor);
              const isToday = isSameDay(day, today);
              const dayMilestones = byDate.get(key) ?? [];
              const visible = dayMilestones.slice(0, 2);
              const extra = dayMilestones.length - visible.length;
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[6rem] border-b border-r border-stone-100 p-1.5",
                    !inMonth && "bg-stone-50/50 text-stone-400",
                  )}
                >
                  <div
                    className={cn(
                      "flex justify-end text-xs",
                      isToday &&
                        "font-semibold text-rose-700",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1",
                        isToday && "bg-rose-100",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {visible.map((m) => {
                      const tone = toneOf(m, today);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelected(m)}
                          className={cn(
                            "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors",
                            PILL_TONE[tone],
                          )}
                          title={`${m.vendor_name} · ${m.kind} · ${fmt(m.amount_eur)}`}
                        >
                          {m.kind === "deposit" ? "↓" : "↑"} {m.vendor_name}
                        </button>
                      );
                    })}
                    {extra > 0 && (
                      <div className="px-1.5 text-[10px] text-stone-500">+{extra} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {monthGroups.map(([key, items]) => {
            const monthLabel = format(parseISO(`${key}-01`), "MMMM yyyy");
            return (
              <div
                key={key}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white/60 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
                  <div className="font-serif text-lg">{monthLabel}</div>
                  <div className="text-xs text-muted-foreground">
                    {items.length} milestone{items.length === 1 ? "" : "s"} ·{" "}
                    {fmt(items.reduce((s, m) => s + m.amount_eur, 0))}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-stone-50/60 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-normal">Vendor</th>
                      <th className="px-4 py-2 text-left font-normal">Kind</th>
                      <th className="px-4 py-2 text-right font-normal">Amount</th>
                      <th className="px-4 py-2 text-left font-normal">Due</th>
                      <th className="px-4 py-2 text-left font-normal">Status</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => {
                      const tone = toneOf(m, today);
                      const Icon = VENDOR_CATEGORY_ICON[m.vendor_category];
                      return (
                        <tr
                          key={m.id}
                          className={cn(
                            "border-t border-stone-100",
                            tone === "emerald" && "bg-emerald-50/40",
                            tone === "rose" && "bg-rose-50/40",
                          )}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-stone-500" />
                              <div>
                                <div className="font-medium">{m.vendor_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {VENDOR_CATEGORY_LABEL[m.vendor_category]}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs uppercase tracking-[0.15em] text-stone-600">
                            {m.kind}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            {fmt(m.amount_eur)}
                          </td>
                          <td className="px-4 py-2.5">
                            {format(parseISO(m.due_at), "EEE, MMM d")}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant={
                                tone === "emerald"
                                  ? "success"
                                  : tone === "rose"
                                    ? "destructive"
                                    : tone === "amber"
                                      ? "warning"
                                      : "muted"
                              }
                            >
                              {TONE_LABEL[tone]}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(m)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Side panel */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setSelected(null)}
            aria-hidden
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-stone-200 bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  {selected.kind === "deposit" ? "Deposit" : "Final balance"}
                </div>
                <div className="font-serif text-2xl">{selected.vendor_name}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <Field
                label="Category"
                value={VENDOR_CATEGORY_LABEL[selected.vendor_category]}
              />
              {selected.contact_name && (
                <Field label="Contact" value={selected.contact_name} />
              )}
              <Field
                label="Vendor status"
                value={VENDOR_STATUS_LABEL[selected.vendor_status]}
              />
              <Field label="Amount" value={fmt(selected.amount_eur)} />
              <Field
                label="Due"
                value={format(parseISO(selected.due_at), "EEEE, MMMM d, yyyy")}
              />
              <Field
                label="Status"
                value={
                  <Badge
                    variant={
                      selected.paid_at
                        ? "success"
                        : selected.is_overdue
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {selected.paid_at
                      ? `Paid · ${format(parseISO(selected.paid_at), "MMM d, yyyy")}`
                      : selected.is_overdue
                        ? "Overdue"
                        : "Unpaid"}
                  </Badge>
                }
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            {/* Couples can mark their own payments paid — they're the
                ones writing the wires. Visibility/scenario-include
                settings stay admin-only via the vendor-pricing tab. */}
            {role && (
              <div className="border-t border-stone-200 p-5">
                {selected.paid_at ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => markUnpaid(selected)}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Mark as unpaid"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => markPaid(selected)}
                    disabled={saving}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {saving ? "Saving…" : "Mark paid"}
                  </Button>
                )}
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

function LegendDot({ tone, label }: { tone: Tone; label: string }) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-400"
      : tone === "amber"
        ? "bg-amber-400"
        : tone === "rose"
          ? "bg-rose-400"
          : "bg-stone-300";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
