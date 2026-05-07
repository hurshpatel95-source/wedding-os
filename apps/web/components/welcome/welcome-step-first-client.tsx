"use client";

import { useState } from "react";
import { toast } from "sonner";
import { isValidEmail } from "@/lib/lead-types";
import {
  WelcomeStepFooter,
  WelcomeStepHeader,
  type WelcomeStepProps,
} from "./welcome-step-shell";

// Step 5 — First client. Optional. Posts to /api/admin/clients/new which
// creates a workspace, magic-links the couple, and (optionally) applies the
// stock playbook the planner just chose in step 3.
export function WelcomeStepFirstClient({
  state,
  onChange,
  onNext,
  onSkip,
  onBack,
}: WelcomeStepProps) {
  const [coupleName, setCoupleName] = useState("");
  const [coupleEmail, setCoupleEmail] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!coupleName.trim() || !coupleEmail.trim()) {
      toast.error("Couple name + email are required.");
      return;
    }
    if (!isValidEmail(coupleEmail)) {
      toast.error("That email looks off.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clients/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          couple_email: coupleEmail.trim().toLowerCase(),
          workspace_name: coupleName.trim(),
          wedding_date: weddingDate ? weddingDate : null,
          // Apply playbook only if the planner chose to seed one in step 3.
          apply_playbook: !!state.playbookSeeded,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not create client");
      toast.success("First client created — welcome to wedding-os");
      onChange({ hasFirstClient: true });
      // Final step → wizard host knows to redirect to /admin?welcome=done.
      onNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create client");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <WelcomeStepHeader
        eyebrow="Step 5 · First client"
        title="Add your first couple (optional)"
        description="Magic-link them in now and we'll spin up a workspace, apply your playbook, and email them a link to log in. You can also skip and add them later from /admin/clients."
      />

      <div className="space-y-4 text-sm">
        <Field label="Couple name" hint="What you'll call this workspace">
          <input
            type="text"
            value={coupleName}
            onChange={(e) => setCoupleName(e.target.value.slice(0, 120))}
            placeholder="Anna & Marc"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
        <Field label="Couple email" hint="Magic link goes here">
          <input
            type="email"
            value={coupleEmail}
            onChange={(e) => setCoupleEmail(e.target.value)}
            placeholder="anna@example.com"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
        <Field label="Wedding date (optional)">
          <input
            type="date"
            value={weddingDate}
            onChange={(e) => setWeddingDate(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
      </div>

      <WelcomeStepFooter
        onBack={onBack}
        onSkip={onSkip}
        onNext={save}
        busy={busy}
        nextLabel="Create client and finish"
        skipLabel="Skip and finish"
      />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {label}
        </span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
