"use client";

// The big day. wedding_date drives the nav countdown + plan re-anchoring;
// wedding_region drives autopilot vendor search. Both can be cleared.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function BigDayForm({
  initialDate,
  initialRegion,
}: {
  initialDate: string | null;
  initialRegion: string | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate ?? "");
  const [region, setRegion] = useState(initialRegion ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    // Optional client-side date sanity check; the server validates too.
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("Pick a valid date.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/workspace/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wedding_date: date.trim() || null,
          wedding_region: region.trim() || null,
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
        <h2 className="font-serif text-2xl">The big day</h2>
        <p className="mt-1 text-sm text-stone-600">
          Your wedding date drives the dashboard countdown and re-anchors plan
          tasks. The region helps autopilot suggest local vendors.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wedding_date">Wedding date</Label>
          <Input
            id="wedding_date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wedding_region">Region</Label>
          <Input
            id="wedding_region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Newport, RI"
            maxLength={200}
            autoComplete="off"
          />
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
