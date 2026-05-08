"use client";

// Self-serve B2C signup for couples planning their own wedding (no planner).
// Mirrors the /signup planner form but with couple-friendly fields. Posts to
// /api/couples-signup which provisions org + workspace + magic-link.

import { useState } from "react";
import { toast } from "sonner";
import { isValidEmail } from "@/lib/lead-types";

export function CouplesSignupForm() {
  const [yourName, setYourName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [region, setRegion] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    magicLink: string | null;
    email: string;
  } | null>(null);
  // Honeypot — bots fill this; humans never see it.
  const [hp, setHp] = useState("");

  const submit = async () => {
    if (hp) {
      // silent success — don't tip off the bot
      setDone({ magicLink: null, email });
      return;
    }
    if (!yourName.trim()) {
      toast.error("What's your name?");
      return;
    }
    if (!region.trim()) {
      toast.error("Where's the wedding? (e.g. Newport, RI)");
      return;
    }
    if (!email || !isValidEmail(email)) {
      toast.error("Need a real email so we can send your magic link.");
      return;
    }

    let guestCountNum: number | null = null;
    if (guestCount.trim()) {
      const parsed = Number(guestCount);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < 10000) {
        guestCountNum = Math.floor(parsed);
      }
    }

    setBusy(true);
    try {
      const res = await fetch("/api/couples-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          your_name: yourName,
          partner_name: partnerName.trim() || null,
          wedding_date: weddingDate || null,
          region,
          guest_count: guestCountNum,
          email: email.toLowerCase(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not sign up");
      setDone({ magicLink: j.magic_link ?? null, email });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign up");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
          ✓
        </div>
        <h3 className="mt-4 font-serif text-2xl font-light tracking-tight">
          Check your inbox
        </h3>
        <p className="mt-3 text-sm text-stone-700">
          We sent a magic link to <strong>{done.email}</strong>. Click it and
          you&rsquo;ll land in your wedding workspace, with your AI co-pilot
          already up to speed.
        </p>
        {done.magicLink && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
            <div className="text-[10px] font-semibold uppercase tracking-wider">
              Dev mode — direct link
            </div>
            <a
              href={done.magicLink}
              className="mt-1 block break-all font-mono text-[10px] underline"
            >
              {done.magicLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
        Sign up
      </div>
      <h2 className="mt-2 font-serif text-2xl font-light tracking-tight">
        Tell us about your wedding
      </h2>
      <div className="mt-5 space-y-4 text-sm">
        <Field label="Your name">
          <input
            type="text"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            placeholder="Alex"
            autoComplete="given-name"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-400 focus:outline-none"
          />
        </Field>
        <Field label="Partner's name (optional)">
          <input
            type="text"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder="Sam"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-400 focus:outline-none"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Wedding date (optional)">
            <input
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-400 focus:outline-none"
            />
          </Field>
          <Field label="Approx. guests (optional)">
            <input
              type="number"
              inputMode="numeric"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="120"
              min={0}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-400 focus:outline-none"
            />
          </Field>
        </div>
        <Field label="Region or city">
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Newport, RI"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-400 focus:outline-none"
          />
        </Field>
        <Field label="Email" hint="Magic link arrives here">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-400 focus:outline-none"
          />
        </Field>
        <div aria-hidden="true" className="hidden">
          <label>
            Site
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
            />
          </label>
        </div>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {busy ? "Setting up your wedding…" : "Send me a magic link"}
      </button>
      <p className="mt-3 text-center text-[11px] text-stone-500">
        Free during beta. Paid plan ($19/mo) when we leave beta.
      </p>
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
