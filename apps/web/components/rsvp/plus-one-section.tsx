"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

type RsvpStatus = "pending" | "yes" | "no" | "maybe";

interface PlusOne {
  id: string;
  full_name: string;
  overall_rsvp: RsvpStatus;
  email: string | null;
}

interface Props {
  token: string;
  initial: PlusOne[];
  max: number;
}

const STATUS_LABEL: Record<RsvpStatus, string> = {
  pending: "Pending",
  yes: "Going",
  no: "Not coming",
  maybe: "Tentative",
};

const STATUS_TONE: Record<RsvpStatus, string> = {
  pending: "bg-stone-100 text-stone-600",
  yes: "bg-emerald-100 text-emerald-800",
  no: "bg-rose-100 text-rose-800",
  maybe: "bg-amber-100 text-amber-800",
};

export function PlusOneSection({ token, initial, max }: Props) {
  const [list, setList] = useState<PlusOne[]>(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const remaining = Math.max(0, max - list.length);

  const addOne = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) {
      setErr("Please enter a name.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/rsvp/${token}/plus-one`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't add — please try again.");
        return;
      }
      setList((prev) => [...prev, data.plus_one as PlusOne]);
      setName("");
      setEmail("");
      setAdding(false);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setErr(null);
    setRemovingId(id);
    try {
      const res = await fetch(`/api/rsvp/${token}/plus-one/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't remove — please try again.");
        return;
      }
      setList((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-stone-200 bg-white/90 p-8 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl font-light tracking-tight">
            Your plus-ones
          </h2>
          <p className="mt-1 text-xs text-stone-600">
            You can bring up to {max} additional guest{max === 1 ? "" : "s"}.
            They&rsquo;ll get their own RSVP page.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {list.length} / {max}
        </div>
      </div>

      {list.length > 0 && (
        <ul className="mt-5 space-y-2">
          {list.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-stone-900">
                  {p.full_name}
                </div>
                {p.email && (
                  <div className="truncate text-xs text-stone-500">
                    {p.email}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_TONE[p.overall_rsvp]}`}
                >
                  {STATUS_LABEL[p.overall_rsvp]}
                </span>
                {p.overall_rsvp === "pending" && (
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={removingId === p.id}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-stone-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                    aria-label={`Remove ${p.full_name}`}
                  >
                    {removingId === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        adding ? (
          <form onSubmit={addOne} className="mt-5 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                Their name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                Email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                placeholder="them@example.com"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-stone-900 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-white transition hover:bg-stone-700 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Add plus-one"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setName("");
                  setEmail("");
                  setErr(null);
                }}
                disabled={busy}
                className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-stone-700 transition hover:border-stone-500"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-dashed border-stone-400 bg-white px-4 py-2 text-xs font-medium text-stone-700 transition hover:border-stone-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add plus-one
          </button>
        )
      ) : (
        <p className="mt-5 text-xs text-stone-500">
          You&rsquo;ve added the maximum number of plus-ones.
        </p>
      )}

      {err && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
    </section>
  );
}
