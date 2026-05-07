"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EmailMessageRow } from "@/lib/tier1-types";
import { cn } from "@/lib/utils";

export interface EmailThreadListProps {
  contextKind: "lead" | "vendor" | "guest";
  contextId: string;
}

type StatusVariant =
  | "default"
  | "secondary"
  | "outline"
  | "muted"
  | "success"
  | "warning"
  | "destructive";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  queued: "muted",
  sent: "success",
  delivered: "success",
  opened: "success",
  clicked: "success",
  bounced: "destructive",
  complained: "destructive",
  failed: "destructive",
  received: "default",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Draft",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  complained: "Complained",
  failed: "Failed",
  received: "Received",
};

export function EmailThreadList({ contextKind, contextId }: EmailThreadListProps) {
  const [messages, setMessages] = useState<EmailMessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const param =
    contextKind === "lead"
      ? "lead_id"
      : contextKind === "vendor"
      ? "vendor_id"
      : "guest_id";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/email/log?${param}=${contextId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Load failed (${res.status})`);
      }
      const data = (await res.json()) as { messages: EmailMessageRow[] };
      setMessages(data.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [param, contextId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !messages) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500">
        Loading conversation…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-center">
        <Mail className="mx-auto h-5 w-5 text-stone-400" />
        <p className="mt-2 text-sm text-stone-500">
          No emails yet — drop one above.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {messages.map((m) => (
        <li
          key={m.id}
          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-stone-500">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                m.direction === "outbound"
                  ? "bg-rose-50 text-rose-800"
                  : "bg-emerald-50 text-emerald-800",
              )}
            >
              {m.direction === "outbound" ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownLeft className="h-3 w-3" />
              )}
              {m.direction === "outbound" ? "Sent" : "Received"}
            </span>
            <Badge variant={STATUS_VARIANT[m.status] ?? "muted"}>
              {STATUS_LABEL[m.status] ?? m.status}
            </Badge>
            <span className="ml-auto text-stone-400 normal-case tracking-normal">
              {formatTimestamp(m.sent_at ?? m.created_at)}
            </span>
          </div>

          <div className="mt-2 text-xs text-stone-500">
            {m.direction === "outbound" ? (
              <>
                To{" "}
                <span className="font-medium text-stone-700">
                  {m.to_name ? `${m.to_name} <${m.to_email}>` : m.to_email}
                </span>
              </>
            ) : (
              <>
                From{" "}
                <span className="font-medium text-stone-700">
                  {m.from_name
                    ? `${m.from_name} <${m.from_email ?? ""}>`
                    : m.from_email ?? "—"}
                </span>
              </>
            )}
          </div>

          <div className="mt-2 font-serif text-base text-stone-900">
            {m.subject || "(no subject)"}
          </div>

          {m.body_text && (
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-stone-600">
              {m.body_text}
            </p>
          )}

          {m.status_detail && m.status === "failed" && (
            <p className="mt-2 text-xs text-destructive">{m.status_detail}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return iso;
  }
}
