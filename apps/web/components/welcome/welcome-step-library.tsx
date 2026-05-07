"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { STARTER_VENUES } from "@/lib/welcome-types";
import {
  WelcomeStepFooter,
  WelcomeStepHeader,
  type WelcomeStepProps,
} from "./welcome-step-shell";

// Step 2 — Library. Offers 5 generic destination wedding starter venues that
// the planner can opt into with a checkbox each. Submitting the form sends
// the picks to /api/admin/welcome/seed-library which inserts library_venues
// rows. Skipping is fine — the library can also be filled from
// /admin/library/venues at any time.
export function WelcomeStepLibrary({
  state,
  onChange,
  onNext,
  onSkip,
  onBack,
}: WelcomeStepProps) {
  // Default to all five selected — most planners want them all and it's the
  // fastest "happy path" through the wizard.
  const [picks, setPicks] = useState<Set<string>>(
    () => new Set(STARTER_VENUES.map((v) => v.id)),
  );
  const [busy, setBusy] = useState(false);

  const togglePick = (id: string) => {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (picks.size === 0) {
      // Empty submit — treat as skip.
      onSkip();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/welcome/seed-library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ picks: Array.from(picks) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not seed library");
      const inserted = Number(j.inserted ?? 0);
      const skipped = Number(j.skipped ?? 0);
      if (inserted > 0) {
        toast.success(
          `Added ${inserted} venue${inserted === 1 ? "" : "s"} to your library`,
        );
      } else if (skipped > 0) {
        toast.success("Library already has these — moving on");
      }
      onChange({ librarySize: state.librarySize + inserted });
      onNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not seed library");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <WelcomeStepHeader
        eyebrow="Step 2 · Library"
        title="Pick a few starter venues"
        description="We'll seed your library with these so /admin/library/venues isn't empty when you land. Edit, rename or delete any of them later."
      />

      <ul className="space-y-2">
        {STARTER_VENUES.map((v) => {
          const checked = picks.has(v.id);
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => togglePick(v.id)}
                className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                  checked
                    ? "border-rose-300 bg-rose-50/40"
                    : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    checked
                      ? "border-rose-500 bg-rose-500 text-white"
                      : "border-stone-300 bg-white"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-serif text-base font-medium text-stone-900">
                      {v.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-stone-500">
                      {v.region} · {v.capacity_min}-{v.capacity_max} guests
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-stone-600">
                    {v.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-stone-500">
        {picks.size} selected — &ldquo;Skip&rdquo; if you&rsquo;d rather start
        with a clean library and add real venues yourself.
      </p>

      <WelcomeStepFooter
        onBack={onBack}
        onSkip={onSkip}
        onNext={save}
        busy={busy}
        nextLabel={picks.size > 0 ? "Add to my library" : "Continue"}
        skipLabel="Skip — I'll add later"
      />
    </div>
  );
}
