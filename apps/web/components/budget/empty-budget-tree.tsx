"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WorkspaceLite {
  id: string;
  base_currency: string;
  guest_count_estimate: number | null;
  budget_target_eur: number | null;
  wedding_region: string | null;
}

export function EmptyBudgetTree({ workspace }: { workspace: WorkspaceLite }) {
  const router = useRouter();
  const [guestCount, setGuestCount] = useState<string>(
    workspace.guest_count_estimate?.toString() ?? "120",
  );
  const [budgetTarget, setBudgetTarget] = useState<string>(
    workspace.budget_target_eur?.toString() ?? "75000",
  );
  const [region, setRegion] = useState<string>(workspace.wedding_region ?? "");
  const [generating, setGenerating] = useState(false);

  const symbol = workspace.base_currency === "USD" ? "$" : "€";

  async function handleGenerate() {
    const guestN = Number(guestCount);
    const budgetN = Number(budgetTarget);
    if (!Number.isFinite(guestN) || guestN <= 0) {
      toast.error("Guest count must be a positive number.");
      return;
    }
    if (!Number.isFinite(budgetN) || budgetN <= 0) {
      toast.error("Budget target must be a positive number.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/budget-lines/generate-baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_count: guestN,
          budget_target_eur: budgetN,
          region: region.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't generate baseline.");
        return;
      }
      toast.success(
        `Generated ${json.lines_inserted} budget lines. Drag any one to re-balance.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50">
      <CardContent className="space-y-6 py-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-2xl">Let&apos;s build your budget.</h2>
            <p className="max-w-xl text-sm text-stone-700">
              Tell us a few details and we&apos;ll generate a personalized
              starting baseline across all 18 categories — venue, catering,
              flowers, music, even tipping + contingency. Drag any line later
              to re-balance.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="guest_count">Guest count</Label>
            <Input
              id="guest_count"
              type="number"
              inputMode="numeric"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="120"
              disabled={generating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_target">Total budget target ({symbol})</Label>
            <Input
              id="budget_target"
              type="number"
              inputMode="numeric"
              value={budgetTarget}
              onChange={(e) => setBudgetTarget(e.target.value)}
              placeholder="75000"
              disabled={generating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region (city or area)</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Newport, RI"
              disabled={generating}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating baseline…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate my baseline
              </>
            )}
          </Button>
          <span className="text-xs text-stone-500">
            Takes 5-15 seconds. You can edit every number afterwards.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
