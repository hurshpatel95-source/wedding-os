"use client";

// Guests + budget target. budget_target_eur is a misnomer at the column level
// (it stores whatever currency the workspace is set to) so the label flips
// based on the workspace's base_currency.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function GuestsBudgetForm({
  initialGuestCount,
  initialBudgetTarget,
  currency,
}: {
  initialGuestCount: number | null;
  initialBudgetTarget: number | null;
  currency: "USD" | "EUR";
}) {
  const router = useRouter();
  const [guestCount, setGuestCount] = useState(
    initialGuestCount != null ? String(initialGuestCount) : "",
  );
  const [budgetTarget, setBudgetTarget] = useState(
    initialBudgetTarget != null ? String(initialBudgetTarget) : "",
  );
  const [saving, setSaving] = useState(false);

  const symbol = currency === "EUR" ? "€" : "$";
  const currencyLabel = currency === "EUR" ? "EUR" : "USD";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const guestRaw = guestCount.trim();
    const budgetRaw = budgetTarget.trim();

    let parsedGuest: number | null = null;
    if (guestRaw !== "") {
      const n = Number(guestRaw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
        toast.error("Guest count must be a positive whole number.");
        return;
      }
      parsedGuest = n;
    }

    let parsedBudget: number | null = null;
    if (budgetRaw !== "") {
      const n = Number(budgetRaw);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Budget target must be a positive number.");
        return;
      }
      parsedBudget = n;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/workspace/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_count_estimate: parsedGuest,
          budget_target_eur: parsedBudget,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't save.");
        return;
      }
      toast.success("Saved.");
      router.refresh();
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-stone-200 bg-white p-6"
    >
      <div className="mb-4">
        <h2 className="font-serif text-2xl">Guests &amp; budget target</h2>
        <p className="mt-1 text-sm text-stone-600">
          Your headline numbers. The estimator and budget tree compare against
          your target so you know when a category is creeping.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="guest_count_estimate">Guest count estimate</Label>
          <Input
            id="guest_count_estimate"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            placeholder="e.g. 120"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budget_target_eur">
            Budget target ({currencyLabel})
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-500">
              {symbol}
            </span>
            <Input
              id="budget_target_eur"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={budgetTarget}
              onChange={(e) => setBudgetTarget(e.target.value)}
              placeholder="e.g. 50000"
              className="pl-7"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end">
        <Button type="submit" disabled={saving} className="min-w-[80px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </form>
  );
}
