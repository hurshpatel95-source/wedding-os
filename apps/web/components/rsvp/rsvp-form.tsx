"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RsvpStatus = "pending" | "yes" | "no" | "maybe";

const OPTIONS: { value: RsvpStatus; label: string; sub: string }[] = [
  { value: "yes", label: "Yes, I'm in", sub: "Save my seat" },
  { value: "no", label: "Can't make it", sub: "We'll miss you" },
  { value: "maybe", label: "Tentative", sub: "Update later" },
];

interface Props {
  token: string;
  initial: {
    overall_rsvp: RsvpStatus;
    dietary: string;
    allergies: string;
    notes: string;
  };
  publicSlug: string | null;
}

export function RsvpForm({ token, initial, publicSlug }: Props) {
  const [status, setStatus] = useState<RsvpStatus>(initial.overall_rsvp);
  const [dietary, setDietary] = useState(initial.dietary);
  const [allergies, setAllergies] = useState(initial.allergies);
  const [notes, setNotes] = useState(initial.notes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/rsvp/${token}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          overall_rsvp: status,
          dietary,
          allergies,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't save — please try again.");
        return;
      }
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-7 w-7" />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-light">
            Thanks &mdash; we&rsquo;ve got you.
          </h2>
          <p className="mt-2 text-sm text-stone-700">
            Your RSVP is{" "}
            <span className="font-medium">{labelFor(status)}</span>. Reopen
            this link anytime to update.
          </p>
        </div>
        {publicSlug && (
          <Link
            href={`/w/${publicSlug}`}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 transition hover:border-stone-900"
          >
            View the wedding details
          </Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
          Will you be there?
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition",
                status === opt.value
                  ? "border-rose-500 bg-rose-50 ring-2 ring-rose-200"
                  : "border-stone-200 bg-white hover:border-stone-400",
              )}
            >
              <div className="font-serif text-base font-medium">
                {opt.label}
              </div>
              <div className="mt-0.5 text-[11px] text-stone-500">
                {opt.sub}
              </div>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
          Dietary preferences (vegetarian, vegan, etc.)
        </label>
        <input
          type="text"
          value={dietary}
          onChange={(e) => setDietary(e.target.value)}
          className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
          placeholder="Optional"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
          Allergies
        </label>
        <input
          type="text"
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
          placeholder="Optional"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
          A note for the couple
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
          placeholder="Plus-one, song requests, anything we should know"
        />
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3 text-sm font-medium uppercase tracking-[0.25em] text-white transition hover:bg-stone-700 disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Send RSVP"
        )}
      </button>
    </form>
  );
}

function labelFor(s: RsvpStatus): string {
  if (s === "yes") return "confirmed";
  if (s === "no") return "noted as a no";
  if (s === "maybe") return "tentative";
  return "pending";
}
