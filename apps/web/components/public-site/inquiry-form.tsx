"use client";

import { useState } from "react";
import { toast } from "sonner";

// "Like what you see? Hire the planner who built this site." — couple
// referral lead source. Posts to /api/public/leads with workspaceSlug so
// the server can resolve org_id + referring_workspace_id.

export function InquiryForm({
  workspaceSlug,
  plannerName,
  bookSlug,
}: {
  workspaceSlug: string;
  plannerName: string | null;
  bookSlug: string | null;
}) {
  const [coupleNames, setCoupleNames] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!email && !phone) {
      toast.error("Email or phone, please — we need to be able to reach you");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          source: "public_wedding_site",
          couple_names: coupleNames,
          email,
          phone,
          notes,
          website,
          page_path: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not submit");
      }
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
          ✓
        </div>
        <p className="mt-4 text-sm text-stone-700">
          Got it — {plannerName ?? "the planner"} will be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
      <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
        Inquire
      </div>
      <h3 className="mt-2 font-serif text-2xl font-light tracking-tight">
        Plan with {plannerName ?? "us"}
      </h3>
      <p className="mt-2 text-sm text-stone-600">
        Loved this wedding? The same team can help plan yours. Drop a quick
        note and they&rsquo;ll be in touch.
      </p>

      <div className="mt-5 space-y-3 text-sm">
        <input
          type="text"
          value={coupleNames}
          onChange={(e) => setCoupleNames(e.target.value)}
          placeholder="Your names"
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Tell them about your wedding (rough date, vibe, location)…"
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
        <div aria-hidden="true" className="hidden">
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send message"}
        </button>
        {bookSlug && (
          <a
            href={`/book/${bookSlug}`}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 transition hover:border-rose-500 hover:text-rose-800"
          >
            Or book a call →
          </a>
        )}
      </div>
    </div>
  );
}
