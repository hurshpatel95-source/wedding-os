"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Link2, Trash2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  BudgetLineRow,
  BudgetLineSource,
  BudgetLineStatus,
} from "@/lib/autopilot-types";

interface VendorOption {
  id: string;
  name: string;
  category: string | null;
}

const STATUS_LABEL: Record<BudgetLineStatus, string> = {
  placeholder: "Placeholder",
  researching: "Researching",
  quoted: "Quoted",
  booked: "Booked",
  paid: "Paid",
};

const STATUS_VARIANT: Record<
  BudgetLineStatus,
  "default" | "secondary" | "outline" | "muted" | "success" | "warning" | "destructive"
> = {
  placeholder: "muted",
  researching: "secondary",
  quoted: "warning",
  booked: "success",
  paid: "success",
};

const SOURCE_LABEL: Record<BudgetLineSource, string> = {
  ai_baseline: "AI",
  industry_avg: "Avg",
  vendor_quote: "Quote",
  manual: "Manual",
  imported: "Imported",
};

const SOURCE_VARIANT: Record<
  BudgetLineSource,
  "default" | "secondary" | "outline" | "muted" | "success" | "warning" | "destructive"
> = {
  ai_baseline: "secondary",
  industry_avg: "outline",
  vendor_quote: "warning",
  manual: "outline",
  imported: "muted",
};

function formatMoney(n: number, symbol: string): string {
  return `${symbol}${Math.round(n).toLocaleString()}`;
}

interface LineRowProps {
  line: BudgetLineRow;
  childrenLines: BudgetLineRow[];
  symbol: string;
  isParent: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onPatch: (
    id: string,
    patch: Partial<BudgetLineRow>,
  ) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onSliderChange: (id: string, newAmount: number) => void;
  vendorOptions: VendorOption[];
  /** Sum of children's totals — for parent rows. */
  rolledUpTotal?: number;
  /** Sum of children's amount_committed. */
  rolledUpCommitted?: number;
  /** Sum of children's amount_paid. */
  rolledUpPaid?: number;
}

export function LineRow({
  line,
  childrenLines,
  symbol,
  isParent,
  expanded,
  onToggleExpand,
  onPatch,
  onDelete,
  onSliderChange,
  vendorOptions,
  rolledUpTotal,
  rolledUpCommitted,
  rolledUpPaid,
}: LineRowProps) {
  // Local mirror of amount_estimated for snappy slider feedback.
  const localEstimate =
    line.amount_estimated ?? line.total_eur ?? 0;
  const [sliderVal, setSliderVal] = useState<number>(localEstimate);
  const lastPropVal = useRef<number>(localEstimate);

  // Re-sync if the row's value changes from outside (e.g. server refresh).
  useEffect(() => {
    if (lastPropVal.current !== localEstimate) {
      setSliderVal(localEstimate);
      lastPropVal.current = localEstimate;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localEstimate]);

  // Inline-edit state for label
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(line.label);
  useEffect(() => {
    setLabelDraft(line.label);
  }, [line.label]);

  // For parents: show rolled-up totals (sum of children).
  const estimated = isParent
    ? rolledUpTotal ?? sliderVal
    : sliderVal;
  const committed = isParent
    ? rolledUpCommitted ?? Number(line.amount_committed ?? 0)
    : Number(line.amount_committed ?? 0);
  const paid = isParent
    ? rolledUpPaid ?? Number(line.amount_paid ?? 0)
    : Number(line.amount_paid ?? 0);

  // Slider max: 3× current estimate, with floor at €5,000.
  const sliderMax = Math.max(
    Math.round((localEstimate || 1000) * 3),
    5000,
  );
  // Step: 50 for small, 250 for medium, 500 for large
  const sliderStep =
    sliderMax >= 50000 ? 500 : sliderMax >= 10000 ? 250 : 50;

  const denom = Math.max(estimated, committed, paid, 1);
  const pctCommitted = Math.min((committed / denom) * 100, 100);
  const pctPaid = Math.min((paid / denom) * 100, 100);

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isParent
          ? "border-stone-300 bg-white shadow-sm"
          : "border-stone-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {/* Expand chevron — only for parents with children */}
        {isParent && childrenLines.length > 0 ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-stone-500 hover:text-stone-900"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Label (inline edit on click) */}
        <div className="min-w-0 flex-1">
          {editingLabel ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => {
                setEditingLabel(false);
                if (labelDraft.trim() && labelDraft !== line.label) {
                  onPatch(line.id, { label: labelDraft.trim() });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setLabelDraft(line.label);
                  setEditingLabel(false);
                }
              }}
              className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-stone-900 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingLabel(true)}
              className={cn(
                "block truncate text-left text-sm hover:text-stone-900",
                isParent
                  ? "font-serif text-base font-medium text-stone-900"
                  : "font-medium text-stone-700",
              )}
              title="Click to rename"
            >
              {line.label}
            </button>
          )}
          {/* qty / unit price snippet for children */}
          {!isParent && line.qty && line.unit_price_eur ? (
            <div className="mt-0.5 text-[11px] text-stone-500">
              {Number(line.qty).toLocaleString()} ×{" "}
              {formatMoney(Number(line.unit_price_eur), symbol)}
            </div>
          ) : null}
        </div>

        {/* Source badge */}
        <Badge
          variant={SOURCE_VARIANT[line.source]}
          className="text-[10px] uppercase"
        >
          {SOURCE_LABEL[line.source]}
        </Badge>

        {/* Status pill */}
        <Badge
          variant={STATUS_VARIANT[line.status]}
          className="text-[10px] uppercase"
        >
          {STATUS_LABEL[line.status]}
        </Badge>

        {/* Vendor link/dropdown — leaf rows only */}
        {!isParent && (
          <Select
            value={line.vendor_id ?? "none"}
            onValueChange={(v) => {
              const vid = v === "none" ? null : v;
              onPatch(line.id, { vendor_id: vid });
            }}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <Link2 className="mr-1 h-3 w-3 text-stone-500" />
              <SelectValue placeholder="Connect vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No vendor</SelectItem>
              {vendorOptions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  {v.category ? (
                    <span className="ml-1 text-[10px] text-stone-500">
                      · {v.category.replace(/_/g, " ")}
                    </span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Amount */}
        <div className="text-right">
          <div className="font-serif text-base font-medium tabular-nums">
            {formatMoney(estimated, symbol)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500">
            estimated
          </div>
        </div>

        {/* Delete */}
        {!isParent && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${line.label}"?`)) {
                onDelete(line.id);
              }
            }}
            className="text-stone-400 transition-colors hover:text-red-600"
            aria-label="Delete line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Slider + 3 progress bars — only for leaf rows */}
      {!isParent && (
        <div className="space-y-2 border-t border-stone-100 px-4 py-3">
          <Slider
            value={[sliderVal]}
            min={0}
            max={sliderMax}
            step={sliderStep}
            onValueChange={(vals) => {
              const v = vals[0] ?? 0;
              setSliderVal(v);
              onSliderChange(line.id, v);
            }}
          />
          <div className="space-y-1">
            <Bar
              label="Estimated"
              symbol={symbol}
              value={estimated}
              denom={denom}
              color="bg-stone-700"
            />
            <Bar
              label="Committed"
              symbol={symbol}
              value={committed}
              pct={pctCommitted}
              color="bg-amber-500"
            />
            <Bar
              label="Paid"
              symbol={symbol}
              value={paid}
              pct={pctPaid}
              color="bg-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Parent rolled-up bars */}
      {isParent && (
        <div className="space-y-1 border-t border-stone-100 px-4 py-3">
          <Bar
            label="Estimated"
            symbol={symbol}
            value={estimated}
            denom={denom}
            color="bg-stone-700"
          />
          <Bar
            label="Committed"
            symbol={symbol}
            value={committed}
            pct={pctCommitted}
            color="bg-amber-500"
          />
          <Bar
            label="Paid"
            symbol={symbol}
            value={paid}
            pct={pctPaid}
            color="bg-emerald-500"
          />
        </div>
      )}
    </div>
  );
}

function Bar({
  label,
  symbol,
  value,
  denom,
  pct,
  color,
}: {
  label: string;
  symbol: string;
  value: number;
  denom?: number;
  pct?: number;
  color: string;
}) {
  const computedPct =
    pct != null
      ? pct
      : denom && denom > 0
      ? Math.min((value / denom) * 100, 100)
      : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-20 shrink-0 text-stone-500">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
        <div
          className={cn("absolute inset-y-0 left-0", color)}
          style={{ width: `${computedPct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-medium tabular-nums text-stone-700">
        {formatMoney(value, symbol)}
      </span>
    </div>
  );
}
