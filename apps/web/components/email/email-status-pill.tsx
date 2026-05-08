"use client";

// Tiny status pill rendered next to every email row. Mirrors the
// status enum on email_messages and stays consistent across the app.
//
// Status values come from email_messages.status (see migration 0025):
//   queued, sent, delivered, opened, clicked, bounced, complained, failed,
//   received

import { cn } from "@/lib/utils";

export interface EmailStatusPillProps {
  status: string;
  className?: string;
}

const COLOR_BY_STATUS: Record<string, string> = {
  queued: "bg-stone-100 text-stone-700 ring-stone-200",
  sent: "bg-blue-50 text-blue-800 ring-blue-200",
  delivered: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  opened: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  clicked: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  bounced: "bg-rose-50 text-rose-800 ring-rose-200",
  failed: "bg-rose-50 text-rose-800 ring-rose-200",
  complained: "bg-rose-100 text-rose-900 ring-rose-300",
  received: "bg-amber-50 text-amber-800 ring-amber-200",
};

const LABEL_BY_STATUS: Record<string, string> = {
  queued: "Draft",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  failed: "Failed",
  complained: "Complained",
  received: "Received",
};

export function EmailStatusPill({ status, className }: EmailStatusPillProps) {
  const color =
    COLOR_BY_STATUS[status] ?? "bg-stone-100 text-stone-700 ring-stone-200";
  const label = LABEL_BY_STATUS[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset",
        color,
        className,
      )}
    >
      {label}
    </span>
  );
}
