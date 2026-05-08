"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABEL,
  type BudgetCategory,
  type BudgetLineRow,
} from "@/lib/autopilot-types";

interface AddCategoryFormProps {
  /** Categories already on the tree — we exclude these so couples can't
   *  accidentally double up "Catering" parent rows. (They can still add
   *  multiple "misc" rows since that's the catch-all bucket.) */
  existingCategories: BudgetCategory[];
  onCreated: (line: BudgetLineRow) => void;
  symbol: string;
}

export function AddCategoryForm({
  existingCategories,
  onCreated,
  symbol,
}: AddCategoryFormProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BudgetCategory>("misc");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter the dropdown to categories not already on the tree (plus "misc"
  // which can appear repeatedly for one-off buckets).
  const availableCategories = useMemo(() => {
    const used = new Set<BudgetCategory>(existingCategories);
    return (BUDGET_CATEGORIES as readonly BudgetCategory[]).filter(
      (c) => c === "misc" || !used.has(c),
    );
  }, [existingCategories]);

  function reset() {
    setCategory("misc");
    setLabel("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalLabel = label.trim() || BUDGET_CATEGORY_LABEL[category];
    setSubmitting(true);
    try {
      const res = await fetch("/api/budget-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // parent_line_id intentionally null — this is a top-level category.
          parent_line_id: null,
          category,
          label: finalLabel,
          // Parents are pure rollup containers; no estimate, no qty, no price.
          qty: null,
          unit_price_eur: null,
          total_eur: null,
          amount_estimated: null,
          amount_committed: 0,
          amount_paid: 0,
          source: "manual",
          status: "placeholder",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't add category.");
        return;
      }
      onCreated(json.line as BudgetLineRow);
      toast.success(`Added "${finalLabel}". Click to expand and add lines.`);
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
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-white/40 px-4 py-3 text-sm text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900"
      >
        <Plus className="h-4 w-4" />
        Add a new category
        <span className="text-xs text-stone-400">
          ({symbol === "$" ? "USD" : "EUR"})
        </span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-stone-300 bg-stone-50/60 p-4"
    >
      <div className="w-56 space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-stone-500">
          Category
        </label>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as BudgetCategory)}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {BUDGET_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[200px] flex-1 space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-stone-500">
          Label (optional)
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={BUDGET_CATEGORY_LABEL[category]}
          autoFocus
          className="h-9"
        />
      </div>
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Add category"
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
