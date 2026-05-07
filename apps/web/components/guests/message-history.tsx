"use client";

// History pane on the messaging page. Shows the last 10 guest_messages
// campaigns with status pills; clicking a row opens a drill-down modal that
// renders the original subject + body.

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { History, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { GuestMessageRow } from "@/lib/tier1-types";

const STATUS_VARIANT: Record<
  GuestMessageRow["status"],
  "muted" | "success" | "warning" | "destructive"
> = {
  pending: "muted",
  sending: "warning",
  sent: "success",
  failed: "destructive",
};

export function MessageHistory({ rows }: { rows: GuestMessageRow[] }) {
  const [active, setActive] = useState<GuestMessageRow | null>(null);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
        <History className="h-3 w-3" /> Recent campaigns
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">
          No messages yet. Your first send will appear here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setActive(row)}
                className="w-full rounded-lg border border-stone-100 bg-stone-50/40 p-3 text-left transition-colors hover:border-stone-300 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                    {formatDate(row.sent_at ?? row.created_at)}
                  </span>
                  <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                </div>
                <div className="mt-1 line-clamp-1 text-sm font-medium text-stone-900">
                  {row.subject || row.kind}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {row.kind} · {row.recipient_count} recipient
                  {row.recipient_count === 1 ? "" : "s"}
                  {row.delivered_count !== row.recipient_count
                    ? ` · ${row.delivered_count} delivered`
                    : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {active?.subject || active?.kind || "Message"}
            </DialogTitle>
            <DialogDescription>
              {active
                ? `Sent ${formatDate(active.sent_at ?? active.created_at)} · ${active.recipient_count} recipient${active.recipient_count === 1 ? "" : "s"} · ${active.delivered_count} delivered${active.bounced_count ? ` · ${active.bounced_count} failed` : ""}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant={STATUS_VARIANT[active.status]}>
                  {active.status}
                </Badge>
                <Badge variant="muted">{active.channel}</Badge>
                <Badge variant="muted">{active.kind}</Badge>
              </div>
              <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm">
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  Subject
                </div>
                <div className="mt-1 font-medium">{active.subject ?? "—"}</div>
              </div>
              <div className="rounded-md border border-stone-200 bg-white p-4 text-sm leading-relaxed">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{active.body}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
