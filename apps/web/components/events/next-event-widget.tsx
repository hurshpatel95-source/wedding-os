// Move 5 — Day 2. Dashboard "Next upcoming event" widget.
//
// Server component (no `"use client"`). Receives the next event row +
// optional venue, renders a small tile. The parent decides whether to
// mount us — we just render or return null defensively.

import Link from "next/link";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Sparkles } from "lucide-react";
import {
  EVENT_ROLE_LABEL,
  type EventDetailRow,
} from "@/lib/event-types";

export function NextEventWidget({
  event,
  venueName,
}: {
  event: EventDetailRow;
  venueName?: string | null;
}) {
  if (!event.start_at) return null;

  let start: Date;
  try {
    start = parseISO(event.start_at);
  } catch {
    return null;
  }
  if (Number.isNaN(start.getTime())) return null;

  const days = differenceInCalendarDays(start, new Date());
  const inLabel =
    days < 0
      ? `${Math.abs(days)}d ago`
      : days === 0
      ? "today"
      : days === 1
      ? "tomorrow"
      : `in ${days} days`;

  const title = event.display_name?.trim() || EVENT_ROLE_LABEL[event.event_role];
  const dateLine = format(start, "EEEE, MMMM d");
  const timeLine = format(start, "h:mm a");

  return (
    <Link
      href={`/events`}
      className="block rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50/40 p-5 shadow-sm transition hover:border-rose-300 hover:shadow-md"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-rose-700">
        <Sparkles className="h-3 w-3" />
        Next event
      </div>
      <h3 className="mt-1 font-serif text-2xl font-light leading-tight tracking-tight">
        {title}
      </h3>
      <div className="mt-2 text-sm text-stone-700">
        {dateLine} · {timeLine}
      </div>
      <div className="mt-1 text-xs text-stone-500">
        {inLabel}
        {venueName ? ` · ${venueName}` : ""}
      </div>
    </Link>
  );
}
