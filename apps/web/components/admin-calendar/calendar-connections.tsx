"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Link as LinkIcon,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { CalendarConnectionRow } from "@/lib/wave2-types";

const ERROR_LABEL: Record<string, string> = {
  google_not_configured:
    "Google Calendar isn't configured yet — ask your admin to set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.",
  forbidden: "Org admins only.",
  missing_code: "Google didn't send back an auth code. Try again.",
  no_refresh_token:
    "Google didn't issue a refresh token. Remove this app from your Google Account access settings, then reconnect.",
  token_exchange_failed: "Could not exchange code with Google. Try again.",
  save_failed: "Could not save the connection. Try again.",
};

function providerIcon(provider: CalendarConnectionRow["provider"]) {
  if (provider === "google") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700">
        <CalendarIcon className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-700">
      <LinkIcon className="h-4 w-4" />
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / (60 * 60_000))}h ago`;
  return `${Math.round(ms / (24 * 60 * 60_000))}d ago`;
}

export function CalendarConnections({
  initialConnections,
  googleConfigured,
  flashConnected,
  flashError,
}: {
  initialConnections: CalendarConnectionRow[];
  googleConfigured: boolean;
  flashConnected: string | null;
  flashError: string | null;
}) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [showIcal, setShowIcal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // id or "ical-add"

  useEffect(() => {
    setConnections(initialConnections);
  }, [initialConnections]);

  // Surface flash message from Google OAuth callback redirect
  useEffect(() => {
    if (flashConnected) {
      toast.success(
        flashConnected === "google"
          ? "Google Calendar connected"
          : "Calendar connected",
      );
      // Clean URL
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("connected");
        window.history.replaceState({}, "", url.toString());
      }
    } else if (flashError) {
      toast.error(ERROR_LABEL[flashError] ?? `Could not connect: ${flashError}`);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSync = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/calendar/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connection_id: id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not sync");
      const result = (j.results ?? [])[0];
      if (result?.ok) {
        toast.success(`Synced — ${result.count} busy slots`);
      } else {
        throw new Error(result?.error || "Sync failed");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync");
    } finally {
      setBusy(null);
    }
  };

  const onDisconnect = async (id: string) => {
    if (!confirm("Disconnect this calendar?")) return;
    setBusy(id);
    try {
      const res = await fetch("/api/admin/calendar/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connection_id: id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not disconnect");
      setConnections((prev) => prev.filter((c) => c.id !== id));
      toast.success("Disconnected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connections list / empty state */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-2xl font-light tracking-tight">
          Connected calendars
        </h2>

        {connections.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center">
            <CalendarIcon className="mx-auto h-8 w-8 text-stone-400" />
            <p className="mt-3 text-sm text-stone-700">
              No calendars connected yet. Connect Google Calendar (or paste an
              iCal feed) so{" "}
              <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">
                /book/&lt;slug&gt;
              </code>{" "}
              hides slots when you&rsquo;re busy.
            </p>
            <p className="mt-2 text-xs text-stone-500">
              We only read busy/free — your event details never leave Google.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100">
            {connections.map((c) => {
              const isBusy = busy === c.id;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-4 py-4"
                >
                  {providerIcon(c.provider)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-900">
                        {c.label ??
                          (c.provider === "google"
                            ? "Google Calendar"
                            : c.provider === "ical"
                              ? "iCal feed"
                              : c.provider)}
                      </span>
                      <StatusPill status={c.status} />
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      Last synced {relativeTime(c.last_synced_at)}
                      {c.last_error && (
                        <span className="ml-2 text-rose-700">
                          · {c.last_error}
                        </span>
                      )}
                    </div>
                    {c.provider === "ical" && c.ical_url && (
                      <div className="mt-1 truncate text-[11px] font-mono text-stone-400">
                        {c.ical_url}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSync(c.id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`}
                      />
                      {isBusy ? "Syncing…" : "Sync now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDisconnect(c.id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-rose-500 hover:text-rose-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Add buttons */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-2xl font-light tracking-tight">
          Add a calendar
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {googleConfigured ? (
            <a
              href="/api/admin/calendar/google/connect"
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              <CalendarIcon className="h-4 w-4" />
              Connect Google Calendar
            </a>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <strong className="font-semibold">
                Google Calendar not configured.
              </strong>{" "}
              Set <code className="font-mono">GOOGLE_OAUTH_CLIENT_ID</code>,{" "}
              <code className="font-mono">GOOGLE_OAUTH_CLIENT_SECRET</code>, and{" "}
              <code className="font-mono">GOOGLE_OAUTH_REDIRECT_URI</code> in
              your environment to enable Google sign-in. iCal still works.
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowIcal((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 transition hover:border-stone-400"
          >
            <LinkIcon className="h-4 w-4" />
            {showIcal ? "Cancel" : "Add iCal feed URL"}
          </button>
        </div>

        {showIcal && (
          <IcalForm
            busy={busy === "ical-add"}
            onSubmit={async ({ url, label }) => {
              setBusy("ical-add");
              try {
                const res = await fetch("/api/admin/calendar/ical", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ url, label }),
                });
                const j = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(j.error || "Could not add feed");
                toast.success("iCal feed connected");
                setShowIcal(false);
                router.refresh();
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Could not add feed",
                );
              } finally {
                setBusy(null);
              }
            }}
          />
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: CalendarConnectionRow["status"] }) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "error"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-800";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {status}
    </span>
  );
}

function IcalForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (vals: { url: string; label: string }) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!url) return;
        onSubmit({ url: url.trim(), label: label.trim() });
      }}
      className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4"
    >
      <label className="block text-sm">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          iCal feed URL
        </span>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.example.com/feed.ics"
          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Label (optional)
        </span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="My personal calendar"
          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !url}
          className="rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add feed"}
        </button>
      </div>
    </form>
  );
}
