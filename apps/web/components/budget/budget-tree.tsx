"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LineRow } from "./line-row";
import { AddLineForm } from "./add-line-form";
import { AddCategoryForm } from "./add-category-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BUDGET_CATEGORY_LABEL,
  type BudgetCategory,
  type BudgetLineRow,
} from "@/lib/autopilot-types";
import {
  EVENT_ROLE_LABEL,
  EVENT_ROLE_ORDER,
  isEventRole,
  type EventRole,
} from "@/lib/event-types";

interface VendorOption {
  id: string;
  name: string;
  category: string | null;
}

interface WorkspaceLite {
  id: string;
  base_currency: string;
  guest_count_estimate: number | null;
  budget_target_eur: number | null;
}

const DEBOUNCE_MS = 350;

export function BudgetTree({
  lines: initial,
  workspace,
  vendorOptions,
  groupMode = "category",
}: {
  lines: BudgetLineRow[];
  workspace: WorkspaceLite;
  vendorOptions: VendorOption[];
  /**
   * Move 5 Day 2 — top-level grouping for the tree. "category" keeps
   * the original behavior. "event" groups parents by their event_role
   * (null = "Shared / unallocated" at the top).
   */
  groupMode?: "category" | "event";
}) {
  const router = useRouter();
  const [lines, setLines] = useState<BudgetLineRow[]>(initial);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const symbol = workspace.base_currency === "USD" ? "$" : "€";

  // Group: parents (parent_line_id == null) and child map
  const { parents, childrenByParent } = useMemo(() => {
    const parents: BudgetLineRow[] = [];
    const childrenByParent: Record<string, BudgetLineRow[]> = {};
    for (const l of lines) {
      if (!l.parent_line_id) {
        parents.push(l);
      } else {
        if (!childrenByParent[l.parent_line_id]) {
          childrenByParent[l.parent_line_id] = [];
        }
        childrenByParent[l.parent_line_id].push(l);
      }
    }
    parents.sort((a, b) => a.sort_order - b.sort_order);
    for (const k of Object.keys(childrenByParent)) {
      childrenByParent[k].sort((a, b) => a.sort_order - b.sort_order);
    }
    return { parents, childrenByParent };
  }, [lines]);

  // Roll up children into parent totals.
  const parentRollups = useMemo(() => {
    const m: Record<
      string,
      { estimated: number; committed: number; paid: number }
    > = {};
    for (const p of parents) {
      const kids = childrenByParent[p.id] ?? [];
      const estimated = kids.reduce(
        (acc, k) => acc + Number(k.amount_estimated ?? k.total_eur ?? 0),
        0,
      );
      const committed = kids.reduce(
        (acc, k) => acc + Number(k.amount_committed ?? 0),
        0,
      );
      const paid = kids.reduce(
        (acc, k) => acc + Number(k.amount_paid ?? 0),
        0,
      );
      m[p.id] = { estimated, committed, paid };
    }
    return m;
  }, [parents, childrenByParent]);

  // Top-level totals
  const totals = useMemo(() => {
    let estimated = 0;
    let committed = 0;
    let paid = 0;
    for (const p of parents) {
      const r = parentRollups[p.id];
      estimated += r?.estimated ?? 0;
      committed += r?.committed ?? 0;
      paid += r?.paid ?? 0;
    }
    return { estimated, committed, paid };
  }, [parents, parentRollups]);

  const target = workspace.budget_target_eur ?? 0;
  const delta = totals.estimated - target;

  // Debounced PATCH bag for slider drags
  const debounceMap = useRef<Record<string, NodeJS.Timeout>>({});

  const patchLine = useCallback(
    async (id: string, patch: Partial<BudgetLineRow>) => {
      // Optimistic
      setLines((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      );
      try {
        const res = await fetch(`/api/budget-lines/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.error ?? "Couldn't save.");
          // Best-effort: refresh server state
          router.refresh();
        }
      } catch (err) {
        toast.error(`Network error: ${(err as Error).message}`);
        router.refresh();
      }
    },
    [router],
  );

  const handleSliderChange = useCallback(
    (id: string, newAmount: number) => {
      // Optimistic in-memory
      setLines((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, amount_estimated: newAmount } : l,
        ),
      );
      const existing = debounceMap.current[id];
      if (existing) clearTimeout(existing);
      debounceMap.current[id] = setTimeout(() => {
        patchLine(id, {
          amount_estimated: newAmount,
          // For leaf rows, also reflect in total_eur so parent rollup math stays sane
          total_eur: newAmount,
        });
        delete debounceMap.current[id];
      }, DEBOUNCE_MS);
    },
    [patchLine],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      // Optimistic remove
      const removed = lines.find((l) => l.id === id) ?? null;
      setLines((prev) => prev.filter((l) => l.id !== id));
      try {
        const res = await fetch(`/api/budget-lines/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.error ?? "Couldn't delete.");
          // Restore
          if (removed) setLines((prev) => [...prev, removed]);
          return;
        }
        toast.success("Line deleted.");
      } catch (err) {
        toast.error(`Network error: ${(err as Error).message}`);
        if (removed) setLines((prev) => [...prev, removed]);
      }
    },
    [lines],
  );

  const handleCreated = useCallback((line: BudgetLineRow) => {
    setLines((prev) => [...prev, line]);
  }, []);

  // Move 5 Day 2 — re-sort parents into event groups when groupMode="event".
  // Each group is one event_role (or "shared" for null event_role).
  // Children retain their parent grouping (BudgetTree's existing
  // parent_line_id model is unchanged); we only re-order parents and
  // inject section headers.
  const eventGroups = useMemo(() => {
    if (groupMode !== "event") return null;
    type Group = {
      key: string;
      label: string;
      role: EventRole | null;
      parents: BudgetLineRow[];
    };
    const sharedKey = "__shared__";
    const map = new Map<string, Group>();
    map.set(sharedKey, {
      key: sharedKey,
      label: "Shared / unallocated",
      role: null,
      parents: [],
    });
    for (const p of parents) {
      const role = p.event_role && isEventRole(p.event_role) ? p.event_role : null;
      const key = role ?? sharedKey;
      const label = role ? EVENT_ROLE_LABEL[role] : "Shared / unallocated";
      const existing = map.get(key) ?? { key, label, role, parents: [] };
      existing.parents.push(p);
      map.set(key, existing);
    }
    // Stable group ordering: shared first, then canonical EVENT_ROLE_ORDER.
    const ordered: Group[] = [];
    const shared = map.get(sharedKey);
    if (shared && shared.parents.length > 0) ordered.push(shared);
    for (const role of EVENT_ROLE_ORDER) {
      const g = map.get(role);
      if (g && g.parents.length > 0) ordered.push(g);
    }
    return ordered;
  }, [groupMode, parents]);

  // Local renderer reused by both grouping modes — keeps the actual
  // parent + nested-children markup identical regardless of grouping.
  const renderParentBlock = (parent: BudgetLineRow) => {
    const kids = childrenByParent[parent.id] ?? [];
    const isExpanded = expanded[parent.id] ?? false;
    const rollup = parentRollups[parent.id];
    return (
      <div key={parent.id} className="space-y-2">
        <LineRow
          line={parent}
          childrenLines={kids}
          symbol={symbol}
          isParent
          expanded={isExpanded}
          onToggleExpand={() =>
            setExpanded((e) => ({ ...e, [parent.id]: !e[parent.id] }))
          }
          onPatch={patchLine}
          onDelete={handleDelete}
          onSliderChange={handleSliderChange}
          vendorOptions={vendorOptions}
          rolledUpTotal={rollup?.estimated}
          rolledUpCommitted={rollup?.committed}
          rolledUpPaid={rollup?.paid}
        />
        {isExpanded && (
          <div className="ml-6 space-y-2 border-l-2 border-stone-100 pl-4">
            {kids.map((child) => (
              <LineRow
                key={child.id}
                line={child}
                childrenLines={[]}
                symbol={symbol}
                isParent={false}
                expanded={false}
                onToggleExpand={() => {}}
                onPatch={patchLine}
                onDelete={handleDelete}
                onSliderChange={handleSliderChange}
                vendorOptions={vendorOptions}
              />
            ))}
            <AddLineForm
              category={parent.category as BudgetCategory}
              parentLineId={parent.id}
              onCreated={handleCreated}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top-level summary */}
      <Card>
        <CardContent className="grid gap-4 py-6 md:grid-cols-4">
          <SummaryStat
            label="Estimated total"
            value={totals.estimated}
            symbol={symbol}
            color="text-stone-900"
          />
          <SummaryStat
            label="Committed"
            value={totals.committed}
            symbol={symbol}
            color="text-amber-700"
          />
          <SummaryStat
            label="Paid"
            value={totals.paid}
            symbol={symbol}
            color="text-emerald-700"
          />
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Vs target {target ? `(${symbol}${target.toLocaleString()})` : ""}
            </div>
            <div className="font-serif text-2xl font-medium tabular-nums">
              {target ? (
                <span
                  className={cn(
                    delta > 0 ? "text-red-700" : "text-emerald-700",
                  )}
                >
                  {delta >= 0 ? "+" : "-"}
                  {symbol}
                  {Math.abs(Math.round(delta)).toLocaleString()}
                </span>
              ) : (
                <span className="text-stone-400">No target set</span>
              )}
            </div>
            {target ? (
              <Badge
                variant={delta > target * 0.05 ? "warning" : "muted"}
                className="text-[10px]"
              >
                {delta > 0
                  ? `${Math.round((delta / target) * 100)}% over`
                  : `${Math.round((-delta / target) * 100)}% under`}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Parent rows + nested children */}
      <div className="space-y-3">
        {eventGroups
          ? eventGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center gap-2 pt-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  <span>{group.label}</span>
                  <span className="text-stone-300">·</span>
                  <span className="tabular-nums text-stone-400">
                    {group.parents.length} categor
                    {group.parents.length === 1 ? "y" : "ies"}
                  </span>
                </div>
                {group.parents.map((parent) => renderParentBlock(parent))}
              </div>
            ))
          : parents.map((parent) => renderParentBlock(parent))}
      </div>

      {/* Show category-key legend for orphan / category-fallback */}
      {parents.length === 0 && (
        <p className="text-sm text-stone-500">
          No top-level categories yet — the AI baseline didn&apos;t produce any
          parents. Try regenerating from the empty state.
        </p>
      )}

      {/* Add a new top-level category (e.g. forgot welcome bags, want a
          custom "Honeymoon fund" bucket). Categories already on the tree
          are filtered out automatically. */}
      <AddCategoryForm
        existingCategories={parents.map((p) => p.category)}
        onCreated={handleCreated}
        symbol={symbol}
      />

      {/* Optional: small hint linking to category labels (used by parent rows). */}
      <div className="hidden">
        {/* Reference so the typecheck retains the label map */}
        {Object.keys(BUDGET_CATEGORY_LABEL).join(",")}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  symbol,
  color,
}: {
  label: string;
  value: number;
  symbol: string;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </div>
      <div className={cn("font-serif text-3xl font-medium tabular-nums", color)}>
        {symbol}
        {Math.round(value).toLocaleString()}
      </div>
    </div>
  );
}
