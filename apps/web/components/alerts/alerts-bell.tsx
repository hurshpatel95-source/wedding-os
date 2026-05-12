"use client";

// Bell icon with unread-count badge + click-to-open dropdown showing the
// latest 10 alerts. Polls /api/alerts every 60s. Mounted by another agent
// (admin-nav / couple nav); this file only EXPORTS it.

import * as React from "react";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertRow, AlertSeverity } from "@/lib/autopilot-types";

interface AlertsBellProps {
  className?: string;
  /** Override poll cadence in ms. Defaults to 60_000. Pass 0 to disable polling. */
  pollMs?: number;
}

interface AlertsApiResponse {
  alerts?: AlertRow[];
  unread_count?: number;
}

export function AlertsBell({ className, pollMs = 60_000 }: AlertsBellProps) {
  const [alerts, setAlerts] = React.useState<AlertRow[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errored, setErrored] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const fetchAlerts = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts?limit=10", {
        cache: "no-store",
      });
      if (!res.ok) {
        setErrored(true);
        return;
      }
      const data = (await res.json()) as AlertsApiResponse;
      const next = data.alerts ?? [];
      setAlerts(next);
      const computed =
        typeof data.unread_count === "number"
          ? data.unread_count
          : next.filter((a) => !a.read_at && !a.dismissed_at).length;
      setUnreadCount(computed);
      setErrored(false);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchAlerts();
    if (pollMs <= 0) return;
    const id = setInterval(fetchAlerts, pollMs);
    return () => clearInterval(id);
  }, [fetchAlerts, pollMs]);

  // Click-outside to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void fetchAlerts();
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-[18px] text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <a
              href="/autopilot"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              View all
            </a>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              </div>
            ) : errored ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Couldn&rsquo;t load alerts.
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                You&rsquo;re all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.action_url ?? "/autopilot"}
                      className={cn(
                        "block px-3 py-2.5 transition-colors hover:bg-muted",
                        !a.read_at && "bg-rose-50/40",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full",
                            severityDotClass(a.severity),
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {a.title}
                          </div>
                          {a.body ? (
                            <div className="line-clamp-2 text-xs text-muted-foreground">
                              {a.body}
                            </div>
                          ) : null}
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {timeAgo(a.created_at)}
                          </div>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
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
