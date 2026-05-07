"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Check, MapPin, User as UserIcon } from "lucide-react";
import { EVENT_ROLE_LABEL } from "@/lib/event-roles";
import type { Database } from "@wedding-os/db";

type TimelineItem = Database["public"]["Tables"]["timeline_items"]["Row"];

type Status = "past" | "current" | "future" | "tbd";

const fmtTime = (iso: string | null) => {
  if (!iso) return "TBD";
  try {
    return format(parseISO(iso), "p");
  } catch {
    return "TBD";
  }
};

function statusFor(item: TimelineItem, now: Date): Status {
  if (!item.occurs_at) return "tbd";
  let start: Date;
  try {
    start = parseISO(item.occurs_at);
  } catch {
    return "tbd";
  }
  const dur = Math.max(0, item.duration_minutes ?? 0);
  const end = new Date(start.getTime() + dur * 60_000);
  if (now < start) return "future";
  if (now >= end) return "past";
  return "current";
}

function formatCountdown(target: Date, now: Date): string {
  const totalSec = Math.max(0, differenceInSeconds(target, now));
  if (totalSec <= 0) return "now";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m`;
  return "<1m";
}

export function DayOfRunner({
  items,
  workspaceName,
  weddingDate,
}: {
  items: TimelineItem[];
  workspaceName: string | null;
  weddingDate: string | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date>(() => new Date());
  const initialScrollDone = useRef(false);
  const currentRef = useRef<HTMLDivElement | null>(null);

  // Tick the clock every 30s for fresh "now" + countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Refresh server data every 60s so couple sees planner edits
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const { withStatus, currentItem, nextItem } = useMemo(() => {
    const scheduled = items.filter((i) => !!i.occurs_at);
    const tbd = items.filter((i) => !i.occurs_at);

    const withStatus = scheduled
      .map((it) => ({ item: it, status: statusFor(it, now) }))
      .concat(tbd.map((it) => ({ item: it, status: "tbd" as Status })));

    const current = withStatus.find((x) => x.status === "current")?.item ?? null;
    const next = withStatus.find((x) => x.status === "future")?.item ?? null;
    return { withStatus, currentItem: current, nextItem: next };
  }, [items, now]);

  // Auto-scroll to current event once on first render
  useEffect(() => {
    if (initialScrollDone.current) return;
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      initialScrollDone.current = true;
    } else if (nextItem) {
      // No current event — scroll to the next upcoming one
      const el = document.querySelector<HTMLDivElement>(`[data-tl-id="${nextItem.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        initialScrollDone.current = true;
      }
    }
  }, [currentItem, nextItem]);

  const dateLabel = weddingDate
    ? (() => {
        try {
          return format(parseISO(weddingDate), "PPPP");
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <div className="space-y-6">
      {/* Sticky now/next pill */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-serif text-2xl leading-none">
              {format(now, "p")}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-stone-500">
              {format(now, "EEE, MMM d")}
            </div>
          </div>
          <div className="min-w-0 text-right">
            {currentItem ? (
              <div className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
                <span className="opacity-80">Now: </span>
                <span className="font-semibold">{currentItem.what}</span>
              </div>
            ) : nextItem ? (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  Next in {formatCountdown(parseISO(nextItem.occurs_at as string), now)}
                </div>
                <div className="mt-0.5 truncate font-serif text-base">
                  {nextItem.what}
                </div>
              </div>
            ) : (
              <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
                Nothing scheduled
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Wedding heading */}
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-light tracking-tight md:text-4xl">
          {workspaceName ?? "Wedding"} day-of
        </h1>
        {dateLabel && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
            {dateLabel}
          </p>
        )}
      </header>

      {/* Timeline */}
      {withStatus.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
          No timeline yet.
        </div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-stone-200 pl-5">
          {withStatus.map(({ item, status }) => (
            <TimelineCard
              key={item.id}
              item={item}
              status={status}
              now={now}
              forwardedRef={status === "current" ? currentRef : undefined}
            />
          ))}
        </ol>
      )}

      <p className="pt-4 text-center text-[10px] uppercase tracking-[0.2em] text-stone-400">
        Auto-refreshes every minute
      </p>
    </div>
  );
}

function TimelineCard({
  item,
  status,
  now,
  forwardedRef,
}: {
  item: TimelineItem;
  status: Status;
  now: Date;
  forwardedRef?: React.Ref<HTMLDivElement>;
}) {
    const isPast = status === "past";
    const isCurrent = status === "current";

    const start = item.occurs_at ? parseISO(item.occurs_at) : null;
    const end = start
      ? new Date(start.getTime() + Math.max(0, item.duration_minutes ?? 0) * 60_000)
      : null;

    const minutesUntil =
      start && status === "future" ? Math.max(0, differenceInMinutes(start, now)) : null;
    const minutesLeft =
      end && status === "current" ? Math.max(0, differenceInMinutes(end, now)) : null;

    const dotClass = isCurrent
      ? "bg-rose-600 ring-4 ring-rose-200"
      : isPast
      ? "bg-emerald-500"
      : "bg-stone-300";

    return (
      <li className="relative">
        <span
          className={`absolute -left-[27px] top-4 inline-flex h-4 w-4 items-center justify-center rounded-full ${dotClass}`}
          aria-hidden
        >
          {isPast && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
        </span>
        <div
          ref={forwardedRef}
          data-tl-id={item.id}
          className={[
            "rounded-2xl border bg-white p-4 transition-shadow",
            isCurrent
              ? "border-rose-300 bg-rose-50/60 shadow-lg shadow-rose-100"
              : isPast
              ? "border-stone-200/70 opacity-60"
              : "border-stone-200 shadow-sm",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-serif text-xl leading-tight">
                {fmtTime(item.occurs_at)}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                {EVENT_ROLE_LABEL[item.event_role]} · {item.duration_minutes} min
              </div>
            </div>
            {isCurrent && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                Happening now
              </div>
            )}
            {status === "future" && minutesUntil !== null && minutesUntil <= 60 && (
              <div className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-amber-800">
                in {minutesUntil}m
              </div>
            )}
            {status === "tbd" && (
              <div className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-stone-600">
                TBD
              </div>
            )}
          </div>

          <div className={`mt-2 font-medium ${isPast ? "line-through" : ""}`}>
            {item.what}
          </div>

          {(item.who_responsible || item.location) && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-600">
              {item.who_responsible && (
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="h-3.5 w-3.5 text-stone-400" />
                  {item.who_responsible}
                </span>
              )}
              {item.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-stone-400" />
                  {item.location}
                </span>
              )}
            </div>
          )}

          {item.notes && (
            <p className="mt-2 whitespace-pre-wrap text-xs text-stone-500">
              {item.notes}
            </p>
          )}

          {isCurrent && minutesLeft !== null && (
            <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-rose-700">
              {minutesLeft > 0 ? `${minutesLeft} min left` : "wrapping up"}
            </div>
          )}
        </div>
      </li>
    );
}
