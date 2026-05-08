"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BudgetCategory, BudgetLineRow } from "@/lib/autopilot-types";

interface AddLineFormProps {
  category: BudgetCategory;
  parentLineId: string;
  onCreated: (line: BudgetLineRow) => void;
}

export function AddLineForm({
  category,
  parentLineId,
  onCreated,
}: AddLineFormProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const qtyN = Number(qty);
  const upN = Number(unitPrice);
  const totalN =
    Number.isFinite(qtyN) && Number.isFinite(upN) && qtyN > 0 && upN > 0
      ? qtyN * upN
      : null;

  function reset() {
    setLabel("");
    setQty("1");
    setUnitPrice("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Label required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/budget-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          parent_line_id: parentLineId,
          label: label.trim(),
          qty: Number.isFinite(qtyN) && qtyN > 0 ? qtyN : 1,
          unit_price_eur: Number.isFinite(upN) && upN > 0 ? upN : null,
          total_eur: totalN,
          amount_estimated: totalN,
          source: "manual",
          status: "placeholder",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't add line.");
        return;
      }
      onCreated(json.line as BudgetLineRow);
      toast.success(`Added "${label.trim()}".`);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-stone-300 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900"
      >
        <Plus className="h-3.5 w-3.5" />
        Add line
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-md border border-stone-300 bg-stone-50/60 p-3"
    >
      <div className="min-w-[180px] flex-1 space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-stone-500">
          Label
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Welcome bag tote"
          autoFocus
          className="h-9"
        />
      </div>
      <div className="w-20 space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-stone-500">
          Qty
        </label>
        <Input
          type="number"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="w-28 space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-stone-500">
          Unit price
        </label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="w-24 space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-stone-500">
          Total
        </label>
        <div className="flex h-9 items-center rounded-md border border-stone-200 bg-stone-100 px-2 text-sm font-medium tabular-nums text-stone-700">
          {totalN != null ? totalN.toLocaleString() : "—"}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:text-stone-900"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
