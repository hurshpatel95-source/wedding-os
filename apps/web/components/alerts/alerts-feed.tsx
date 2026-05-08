"use client";

// Twitter-feed-style alerts list. Loads via /api/alerts. Reusable on the
// /autopilot dashboard. Shows severity dot, title, body excerpt, time ago,
// and per-row [Open] / [Dismiss] buttons.

import * as React from "react";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AlertRow, AlertSeverity } from "@/lib/autopilot-types";

interface AlertsFeedProps {
  className?: string;
  /** How many alerts to render. Defaults to 50. */
  limit?: number;
  /** Optional audience filter forwarded to the API. */
  audience?: "couple" | "planner" | "both";
  /** Set to true to hide dismissed rows from the list (default true). */
  hideDismissed?: boolean;
  /** Re-fetch cadence in ms. 0 to disable. Default 0 (manual). */
  pollMs?: number;
}

interface AlertsApiResponse {
  alerts?: AlertRow[];
  unread_count?: number;
}

export function AlertsFeed({
  className,
  limit = 50,
  audience,
  hideDismissed = true,
  pollMs = 0,
}: AlertsFeedProps) {
  const [alerts, setAlerts] = React.useState<AlertRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errored, setErrored] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/alerts", window.location.origin);
      url.searchParams.set("limit", String(limit));
      if (audience) url.searchParams.set("audience", audience);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        setErrored(true);
        return;
      }
      const data = (await res.json()) as AlertsApiResponse;
      setAlerts(data.alerts ?? []);
      setErrored(false);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, [audience, limit]);

  React.useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  const dismiss = async (id: string) => {
    setPendingId(id);
    // Optimistic: mark dismissed locally
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, dismissed_at: new Date().toISOString() } : a,
      ),
    );
    try {
      await fetch(`/api/alerts/${id}/dismiss`, { method: "POST" });
    } catch {
      // best-effort — refetch will reconcile
    } finally {
      setPendingId(null);
    }
  };

  const visible = hideDismissed
    ? alerts.filter((a) => !a.dismissed_at)
    : alerts;

  if (loading && alerts.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Loading alerts…
      </div>
    );
  }

  if (errored) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Couldn&rsquo;t load alerts.{" "}
        <button
          type="button"
          className="text-foreground underline underline-offset-2"
          onClick={refresh}
        >
          Retry
        </button>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border p-8 text-center",
          className,
        )}
      >
        <div className="text-sm font-medium text-foreground">No alerts</div>
        <div className="mt-1 text-xs text-muted-foreground">
          When autopilot picks something up, it&rsquo;ll show up here.
        </div>
      </div>
    );
  }

  return (
    <ul className={cn("divide-y divide-border", className)}>
      {visible.map((a) => (
        <li
          key={a.id}
          className={cn(
            "py-3 transition-opacity",
            a.dismissed_at && "opacity-50",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full",
                severityDotClass(a.severity),
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-sm font-semibold text-foreground">
                  {a.title}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {timeAgo(a.created_at)}
                </div>
              </div>
              {a.body ? (
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                  {a.body}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                {a.action_url ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                  >
                    <a href={a.action_url}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open
                    </a>
                  </Button>
                ) : null}
                {!a.dismissed_at ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => dismiss(a.id)}
                    disabled={pendingId === a.id}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Dismiss
                  </Button>
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    dismissed
                  </span>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function severityDotClass(sev: AlertSeverity): string {
  switch (sev) {
    case "urgent":
      return "bg-rose-600";
    case "warn":
      return "bg-amber-500";
    case "success":
      return "bg-emerald-500";
    default:
      return "bg-sky-500";
  }
}

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
