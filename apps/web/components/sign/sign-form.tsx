"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ContractStatus } from "@/lib/tier1-types";

type Mode = "idle" | "decline";

export function SignForm({
  token,
  currentStatus,
  signerHint,
}: {
  token: string;
  currentStatus: ContractStatus;
  signerHint: string | null;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "signed" | "declined">(null);

  // Stamp viewed_at on mount when the contract is still 'sent'. Idempotent
  // server-side, so it's fine to call from useEffect even if already viewed.
  useEffect(() => {
    if (currentStatus !== "sent") return;
    const ctrl = new AbortController();
    fetch(`/api/sign/${token}/view`, {
      method: "POST",
      signal: ctrl.signal,
    }).catch(() => {
      // Silent — not worth surfacing a tracking failure to the user.
    });
    return () => ctrl.abort();
  }, [token, currentStatus]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Please type your full name as your signature.");
      return;
    }
    if (!agreed) {
      setError("Please confirm you've read and agree to the terms.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signed_full_name: trimmed }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Couldn't record your signature.");
        setSubmitting(false);
        return;
      }
      setDone("signed");
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}/decline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Couldn't record your decline.");
        setSubmitting(false);
        return;
      }
      setDone("declined");
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (done === "signed") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h3 className="mt-3 font-serif text-2xl font-light text-stone-900">
          Signed.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-stone-700">
          Thank you, {name.trim()}. Your signature has been recorded — the
          planner will follow up with next steps shortly.
        </p>
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div className="text-center">
        <h3 className="font-serif text-2xl font-light text-stone-900">
          Decline recorded.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-stone-700">
          The planner will reach out to discuss. Thank you for letting us know.
        </p>
      </div>
    );
  }

  if (mode === "decline") {
    return (
      <form onSubmit={handleDecline} className="space-y-4">
        <div>
          <h3 className="font-serif text-xl font-light text-stone-900">
            Decline this contract
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            A short note helps the planner understand what to revise.
          </p>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Optional — what didn't work?"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
        />
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Submit decline
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setMode("idle");
              setError(null);
            }}
            className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300"
          >
            Back
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSign} className="space-y-4">
      <div>
        <h3 className="font-serif text-xl font-light text-stone-900">
          Sign this agreement
        </h3>
        {signerHint && (
          <p className="mt-1 text-sm text-stone-600">
            Type your name (e.g. <strong>{signerHint}</strong>) below to sign.
          </p>
        )}
      </div>

      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-stone-500">
          Full name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder={signerHint ?? "Your full name"}
          autoComplete="name"
          className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-serif text-lg italic text-stone-900 focus:border-stone-900 focus:outline-none"
        />
      </label>

      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-stone-300"
        />
        <span>
          I have read and agree to the terms of this agreement.
        </span>
      </label>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          Sign contract
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setMode("decline");
            setError(null);
          }}
          className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-rose-300 hover:text-rose-700"
        >
          Decline
        </button>
      </div>
    </form>
  );
}
