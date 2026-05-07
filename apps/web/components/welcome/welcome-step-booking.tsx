"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DAY_OF_WEEK_LABELS } from "@/lib/lead-types";
import {
  WelcomeStepFooter,
  WelcomeStepHeader,
  type WelcomeStepProps,
} from "./welcome-step-shell";

// Step 4 — Booking page. Pick a slug, write a quick tagline (pre-filled from
// step 1), then check the days you can take consult calls. Each checked day
// gets a single 9am-5pm window; the planner can fine-tune in /admin/booking
// later. Submitting publishes the page in one shot via
// /api/admin/welcome/booking-setup.
export function WelcomeStepBooking({
  state,
  onChange,
  onNext,
  onSkip,
  onBack,
}: WelcomeStepProps) {
  // Default slug from the studio name — lowercase, alphanumeric + hyphens.
  const defaultSlug = useMemo(() => {
    const base = state.publicSlug ?? state.orgName ?? "";
    return base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }, [state.publicSlug, state.orgName]);

  const [slug, setSlug] = useState(defaultSlug || "studio");
  const [tagline, setTagline] = useState(state.publicTagline ?? "");
  const [brandMd, setBrandMd] = useState(state.publicBrandMd ?? "");
  // Default to Tue/Wed/Thu mornings — the most common consult availability
  // we see in the wild.
  const [days, setDays] = useState<Set<number>>(() => new Set([2, 3, 4]));
  const [startHour, setStartHour] = useState(10);
  const [endHour, setEndHour] = useState(13);
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: number) => {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const save = async () => {
    if (!slug.trim() || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) {
      toast.error("Slug must be lowercase letters, numbers, hyphens.");
      return;
    }
    if (!tagline.trim()) {
      toast.error("Add a one-liner so couples know what to expect.");
      return;
    }
    if (days.size === 0) {
      toast.error("Pick at least one day you can take calls.");
      return;
    }
    if (endHour <= startHour) {
      toast.error("End time must be after start time.");
      return;
    }
    setBusy(true);
    try {
      const slots = Array.from(days).map((d) => ({
        day_of_week: d,
        start_minute: startHour * 60,
        end_minute: endHour * 60,
        label: null as string | null,
      }));

      const res = await fetch("/api/admin/welcome/booking-setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          public_slug: slug.trim(),
          public_tagline: tagline.trim(),
          public_brand_md: brandMd.trim() || undefined,
          contact_email: state.contactEmail ?? undefined,
          contact_phone: state.contactPhone ?? undefined,
          day_of_week_slots: slots,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not publish booking page");

      toast.success(`Live at /book/${j.public_slug ?? slug}`);
      onChange({
        bookingPublished: true,
        publicSlug: slug.trim(),
        publicTagline: tagline.trim(),
        publicBrandMd: brandMd.trim() || null,
      });
      onNext();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not publish booking page",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <WelcomeStepHeader
        eyebrow="Step 4 · Booking page"
        title="Get a live consult-booking link"
        description="Share this URL on Instagram and your contact form. Couples pick a slot, you get a lead."
      />

      <div className="space-y-5 text-sm">
        <Field
          label="Slug"
          hint={`/book/${slug || "your-slug"}`}
        >
          <div className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2">
            <span className="text-stone-500">/book/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "")
                    .slice(0, 60),
                )
              }
              placeholder="your-studio"
              className="w-full bg-transparent outline-none"
            />
          </div>
        </Field>

        <Field label="Booking page tagline">
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, 240))}
            placeholder="Destination weddings on the Costa Brava."
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>

        <Field label="About your studio (optional)" hint="Markdown supported">
          <textarea
            value={brandMd}
            onChange={(e) => setBrandMd(e.target.value.slice(0, 4000))}
            placeholder="A short paragraph or two about your style, where you work, and what makes you different."
            rows={4}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Weekly availability" hint="Pick 2-3 days to start">
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_OF_WEEK_LABELS.map((label, i) => {
              const checked = days.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`rounded-lg border py-2 text-center text-xs font-medium transition ${
                    checked
                      ? "border-rose-500 bg-rose-50 text-rose-900"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-stone-600">
            <label className="flex items-center gap-1.5">
              From
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
              >
                {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              to
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
              >
                {Array.from({ length: 14 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </select>
            </label>
            <span className="text-stone-400">
              · same hours every selected day
            </span>
          </div>
        </Field>
      </div>

      <WelcomeStepFooter
        onBack={onBack}
        onSkip={onSkip}
        onNext={save}
        busy={busy}
        nextLabel="Publish and continue"
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
