"use client";

import { useState } from "react";
import { toast } from "sonner";
import { isValidEmail } from "@/lib/lead-types";

export function SignupForm() {
  const [studioName, setStudioName] = useState("");
  const [yourName, setYourName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    magicLink: string | null;
    email: string;
  } | null>(null);
  // Honeypot
  const [hp, setHp] = useState("");

  const submit = async () => {
    if (hp) {
      // silent — bots fill the honeypot
      setDone({ magicLink: null, email });
      return;
    }
    if (!studioName.trim()) {
      toast.error("What's your studio called?");
      return;
    }
    if (!email || !isValidEmail(email)) {
      toast.error("Need a real email so we can send you a magic link.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studio_name: studioName,
          your_name: yourName,
          email: email.toLowerCase(),
          website: website.trim() || null,
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
          you&rsquo;ll land in your admin shell.
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
        Tell us about your studio
      </h2>
      <div className="mt-5 space-y-4 text-sm">
        <Field label="Studio name">
          <input
            type="text"
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            placeholder="Astia Events"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
        <Field label="Your name">
          <input
            type="text"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            placeholder="Astha P."
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
        <Field label="Email" hint="Magic link arrives here">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hello@yourstudio.com"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
        <Field label="Website (optional)" hint="We can run a marketing scorecard against it later">
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourstudio.com"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
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
        {busy ? "Setting up…" : "Send me a magic link"}
      </button>
      <p className="mt-3 text-center text-[11px] text-stone-500">
        By continuing you agree to our terms + privacy policy.
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
