"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  WelcomeStepFooter,
  WelcomeStepHeader,
  type WelcomeStepProps,
} from "./welcome-step-shell";

// Step 1 — Brand. Collects the studio's tagline, accent color and contact
// details. We persist the tagline + contact info into the org row via the
// existing /api/admin/booking/settings PATCH route. The accent color is
// stored locally (the wider product currently doesn't have an org-level
// accent column — the booking page derives palette from public_brand_md).
export function WelcomeStepBrand({
  state,
  onChange,
  onNext,
  onSkip,
  onBack,
}: WelcomeStepProps) {
  const [tagline, setTagline] = useState(state.publicTagline ?? "");
  const [accent, setAccent] = useState<string>("#e11d48"); // rose-600
  const [email, setEmail] = useState(state.contactEmail ?? "");
  const [phone, setPhone] = useState(state.contactPhone ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!tagline.trim()) {
      toast.error("Add a one-liner so couples know what you offer.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/booking/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          public_tagline: tagline.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not save brand");
      }
      onChange({
        publicTagline: tagline.trim(),
        contactEmail: email.trim() || null,
        contactPhone: phone.trim() || null,
      });
      onNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save brand");
    } finally {
      setBusy(false);
    }
  };

  const accents: Array<{ value: string; label: string }> = [
    { value: "#e11d48", label: "Rose" },
    { value: "#d97706", label: "Amber" },
    { value: "#0f766e", label: "Teal" },
    { value: "#1d4ed8", label: "Indigo" },
    { value: "#44403c", label: "Stone" },
  ];

  return (
    <div>
      <WelcomeStepHeader
        eyebrow="Step 1 · Brand"
        title={`Tell couples who ${state.orgName} is`}
        description="A one-liner, your contact details, and an accent color. You can change everything later in Settings."
      />

      <div className="space-y-5 text-sm">
        <Field label="Studio name" hint="Locked from signup — change in Settings → Studio">
          <input
            type="text"
            value={state.orgName}
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-stone-600"
          />
        </Field>

        <Field
          label="Tagline"
          hint="One sentence — appears on your booking page hero"
        >
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, 120))}
            placeholder="Destination weddings on the Costa Brava."
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <div className="mt-1 text-[10px] text-stone-400">
            {tagline.length}/120
          </div>
        </Field>

        <Field label="Accent color">
          <div className="flex flex-wrap gap-2">
            {accents.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setAccent(a.value)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                  accent === a.value
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: a.value }}
                />
                {a.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-stone-400">
            Coming soon — for now we&rsquo;ll save your pick locally and apply
            it to your booking page when palette support ships.
          </p>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Contact email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@yourstudio.com"
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </Field>
          <Field label="Contact phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </Field>
        </div>
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
