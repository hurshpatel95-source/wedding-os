"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AlertRow, AlertSeverity } from "@/lib/autopilot-types";

const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  info: "border-l-stone-400 bg-stone-50/60",
  success: "border-l-emerald-500 bg-emerald-50/40",
  warn: "border-l-amber-500 bg-amber-50/50",
  urgent: "border-l-rose-600 bg-rose-50/50",
};

const SEVERITY_LABEL_CLASS: Record<AlertSeverity, string> = {
  info: "text-stone-600",
  success: "text-emerald-700",
  warn: "text-amber-800",
  urgent: "text-rose-800",
};

export function AlertCard({
  alert,
  variant = "full",
}: {
  alert: AlertRow;
  /** "full" — for the autopilot page list. "compact" — for the today widget. */
  variant?: "full" | "compact";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"read" | "dismiss" | null>(null);

  const ts = (() => {
    try {
      return formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  const patch = async (body: { read?: boolean; dismissed?: boolean }) => {
    const which = body.dismissed ? "dismiss" : "read";
    setBusy(which);
    try {
      const res = await fetch(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Could not update alert");
      }
      if (body.dismissed) toast.success("Alert dismissed");
      else toast.success("Marked as read");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const isUnread = alert.read_at === null;

  return (
    <article
      className={cn(
        "rounded-xl border border-stone-200 border-l-4 shadow-sm transition",
        SEVERITY_BORDER[alert.severity],
        variant === "full" ? "p-5" : "p-3",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] uppercase tracking-[0.2em]",
                SEVERITY_LABEL_CLASS[alert.severity],
              )}
            >
              {alert.severity}
            </span>
            {isUnread && (
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
            )}
            {ts && (
              <span className="text-[11px] text-stone-500">{ts}</span>
            )}
          </div>
          <h3
            className={cn(
              "mt-1 font-serif font-medium leading-tight",
              variant === "full" ? "text-xl" : "text-base",
            )}
          >
            {alert.title}
          </h3>
          {alert.body && (
            <p
              className={cn(
                "mt-1 text-stone-600",
                variant === "full" ? "text-sm" : "text-xs",
              )}
            >
              {alert.body}
            </p>
          )}
        </div>
      </div>

      {variant === "full" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {alert.action_url && (
            <Button asChild size="sm">
              <Link href={alert.action_url}>
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          {isUnread && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => void patch({ read: true })}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark read
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => void patch({ dismissed: true })}
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
      )}

      {variant === "compact" && alert.action_url && (
        <Link
          href={alert.action_url}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-stone-700 hover:text-stone-900"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </article>
  );
}
