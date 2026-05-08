"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Mail,
  RefreshCw,
  Trash2,
  Send,
  ShieldAlert,
} from "lucide-react";

const ERROR_LABEL: Record<string, string> = {
  gmail_not_configured:
    "Gmail isn't configured yet — your admin needs to set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, and GMAIL_OAUTH_REDIRECT_URI.",
  bad_state: "The connection link expired or was tampered with. Try again.",
  state_user_mismatch:
    "That consent link wasn't for your account. Sign in as the right user and try again.",
  missing_code: "Google didn't send back an auth code. Try again.",
  no_refresh_token:
    "Google didn't issue a refresh token. Remove this app from your Google Account access settings, then reconnect.",
  token_exchange_failed: "Could not exchange code with Google. Try again.",
  profile_email_missing: "Couldn't read your Gmail address from Google.",
  profile_fetch_failed: "Couldn't fetch your Gmail profile. Try again.",
  save_failed: "Could not save the connection. Try again.",
  state_signing_unavailable:
    "Server can't sign the connection link. Ask your admin to set SUPABASE_SERVICE_ROLE_KEY.",
};

// Common personal-mailbox indicators. If the connected email matches,
// we surface a hard warning + an override checkbox for the test-send.
const PERSONAL_HINT_RE =
  /^(?!.*wedding)(?!.*\.us$)(?!.*\.us\b).*@(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|me|aol|protonmail)\.[a-z.]+$/i;

interface ConnectionLite {
  id: string;
  email: string;
  status: "active" | "expired" | "revoked" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

export function GmailConnectionPanel({
  connection,
  gmailConfigured,
  flashConnected,
  flashError,
}: {
  connection: ConnectionLite | null;
  gmailConfigured: boolean;
  flashConnected: string | null;
  flashError: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "sync" | "disconnect" | "test_send">(
    null,
  );
  const [acknowledgePersonal, setAcknowledgePersonal] = useState(false);

  // Surface flash query params from OAuth redirect once.
  useEffect(() => {
    if (flashConnected) {
      toast.success("Gmail connected");
      cleanQuery(["connected"]);
    } else if (flashError) {
      toast.error(ERROR_LABEL[flashError] ?? `Could not connect: ${flashError}`);
      cleanQuery(["error"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const looksPersonal = useMemo(() => {
    if (!connection?.email) return false;
    if (/wedding/i.test(connection.email)) return false;
    return PERSONAL_HINT_RE.test(connection.email);
  }, [connection?.email]);

  const onSync = async () => {
    if (!connection) return;
    setBusy("sync");
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Sync failed");
      toast.success(
        `Synced — ${j.messages_processed ?? 0} new messages` +
          (j.vendor_threads ? `, ${j.vendor_threads} vendor` : ""),
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  };

  const onDisconnect = async () => {
    if (!connection) return;
    if (
      !confirm(
        "Disconnect this Gmail? You can reconnect later. Existing message history is kept.",
      )
    )
      return;
    setBusy("disconnect");
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Disconnect failed");
      toast.success("Gmail disconnected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  };

  const onTestSend = async () => {
    if (!connection) return;
    if (looksPersonal && !acknowledgePersonal) {
      toast.error(
        "Confirm you understand this is a personal address before test-sending.",
      );
      return;
    }
    setBusy("test_send");
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: connection.email,
          subject: "wedding-os connected",
          body_text: "Wedding-os connected",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Test send failed");
      toast.success("Test email sent — check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setBusy(null);
    }
  };

  if (!gmailConfigured) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
        <div className="font-medium">Gmail isn&rsquo;t configured yet.</div>
        <p className="mt-1">
          Your admin needs to set{" "}
          <code className="font-mono">GMAIL_OAUTH_CLIENT_ID</code>,{" "}
          <code className="font-mono">GMAIL_OAUTH_CLIENT_SECRET</code>, and{" "}
          <code className="font-mono">GMAIL_OAUTH_REDIRECT_URI</code> in Railway
          to enable Gmail. Once set, this page will let you connect a
          wedding-only address.
        </p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700">
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl font-light tracking-tight">
                Connect your wedding Gmail
              </h2>
              <p className="mt-1 text-sm text-stone-700">
                We strongly recommend creating a free Gmail like{" "}
                <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px] font-mono">
                  jane-and-john-2027@gmail.com
                </code>{" "}
                and using <em>only</em> that for vendor outreach. We see every
                thread we read or send — keep it clean by keeping it dedicated.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-stone-600">
                <li>• Read vendor replies and bring them into your dashboard</li>
                <li>• Draft personalised outreach (you review before send)</li>
                <li>• Send on your behalf, threaded with prior messages</li>
              </ul>

              <a
                href="/api/gmail/oauth/connect"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                <Mail className="h-4 w-4" />
                Connect Gmail
              </a>
            </div>
          </div>
        </div>

        <p className="text-xs text-stone-500">
          By connecting, you grant wedding-os permission to read, compose, send,
          and modify mail for this address. You can disconnect any time.
        </p>
      </div>
    );
  }

  // Connected (or recently disconnected) — show status card
  const isActive = connection.status === "active";
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-stone-100 text-stone-500"
            }`}
          >
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-stone-900">
                {connection.email}
              </span>
              <StatusPill status={connection.status} />
            </div>
            <div className="mt-1 text-xs text-stone-500">
              Last synced {relativeTime(connection.last_synced_at)}
              {connection.last_error && (
                <span className="ml-2 text-rose-700">
                  · {connection.last_error}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSync}
              disabled={!isActive || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${busy === "sync" ? "animate-spin" : ""}`}
              />
              {busy === "sync" ? "Syncing…" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={onTestSend}
              disabled={!isActive || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {busy === "test_send" ? "Sending…" : "Test send"}
            </button>
            {isActive && (
              <button
                type="button"
                onClick={onDisconnect}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-rose-500 hover:text-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
              </button>
            )}
            {!isActive && (
              <a
                href="/api/gmail/oauth/connect"
                className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-800"
              >
                Reconnect
              </a>
            )}
          </div>
        </div>

        {looksPersonal && isActive && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="min-w-0 text-sm text-amber-900">
                <div className="font-medium">
                  This looks like a personal address.
                </div>
                <p className="mt-1 text-xs">
                  We strongly recommend a wedding-only Gmail. Connecting a
                  personal account means we&rsquo;ll see all your mail in this
                  inbox. Disconnect and reconnect with a dedicated address if
                  you can.
                </p>
                <label className="mt-3 flex items-center gap-2 text-xs text-amber-900">
                  <input
                    type="checkbox"
                    checked={acknowledgePersonal}
                    onChange={(e) => setAcknowledgePersonal(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  I understand and want to use this address anyway.
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-stone-500">
        We pull new inbox messages on demand. AI drafts always wait for your
        review before sending unless you explicitly enable autopilot for that
        vendor.
      </p>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: ConnectionLite["status"];
}) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "error"
        ? "bg-rose-50 text-rose-700"
        : status === "revoked"
          ? "bg-stone-100 text-stone-600"
          : "bg-amber-50 text-amber-800";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {status}
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

function cleanQuery(keys: string[]) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const k of keys) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, "", url.toString());
  }
}
