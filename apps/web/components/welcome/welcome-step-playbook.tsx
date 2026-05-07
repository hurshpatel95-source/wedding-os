"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  WelcomeStepFooter,
  WelcomeStepHeader,
  type WelcomeStepProps,
} from "./welcome-step-shell";

// Step 3 — Playbook. Lets the planner choose between the stock 12-month
// wedding-os playbook (9 phases / 20 starter tasks, applied via
// /api/admin/welcome/apply-playbook) or starting blank.
export function WelcomeStepPlaybook({
  state,
  onChange,
  onNext,
  onSkip,
  onBack,
}: WelcomeStepProps) {
  const [choice, setChoice] = useState<"stock" | "blank">("stock");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (choice === "blank") {
      onChange({ playbookSeeded: false });
      onNext();
      return;
    }
    if (state.playbookSeeded) {
      // Already seeded for this org — short-circuit without re-applying.
      toast.success("Playbook already in place");
      onNext();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/welcome/apply-playbook", {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not apply playbook");
      const phases = Number(j.phases_inserted ?? 0);
      const tasks = Number(j.tasks_inserted ?? 0);
      if (phases > 0) {
        toast.success(`Applied ${phases} phases / ${tasks} tasks`);
      } else if (j.already_seeded) {
        toast.success("Playbook already in place");
      }
      onChange({ playbookSeeded: true });
      onNext();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not apply playbook",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <WelcomeStepHeader
        eyebrow="Step 3 · Playbook"
        title="Set up your master playbook"
        description="Your playbook is the master list of tasks every wedding goes through. We'll copy it into each new client workspace; you can rename, reorder, or delete tasks at any time in /admin/playbook."
      />

      <div className="space-y-3">
        <Option
          checked={choice === "stock"}
          onClick={() => setChoice("stock")}
          title="Use the wedding-os 12-month playbook"
          subtitle="9 phases, 20 starter tasks — covers vision, vendors, design, logistics, day-of, and post-wedding."
          badge="Recommended"
        />
        <Option
          checked={choice === "blank"}
          onClick={() => setChoice("blank")}
          title="Start blank — I'll write my own"
          subtitle="You'll get an empty playbook editor at /admin/playbook to build it from scratch."
        />
      </div>

      <WelcomeStepFooter
        onBack={onBack}
        onSkip={onSkip}
        onNext={save}
        busy={busy}
        nextLabel="Save and continue"
      />
    </div>
  );
}

function Option({
  checked,
  onClick,
  title,
  subtitle,
  badge,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        checked
          ? "border-rose-300 bg-rose-50/40"
          : "border-stone-200 bg-white hover:border-stone-400"
      }`}
    >
      <span
        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          checked
            ? "border-rose-500 bg-white"
            : "border-stone-300 bg-white"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-rose-500" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-serif text-base font-medium text-stone-900">
            {title}
          </span>
          {badge && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-1 block text-sm leading-snug text-stone-600">
          {subtitle}
        </span>
      </span>
    </button>
  );
}
