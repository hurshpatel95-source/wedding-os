import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * ActionWidgets — the actionable hub for the B2C couple dashboard.
 *
 * Surfaces four counts drawn from existing tables so the couple lands on
 * something they can DO, not just look at:
 *  1. Due this week — planning_tasks open in the next 7d (or already overdue)
 *  2. Deposits coming up — vendor deposits/finals due in the next 30d
 *  3. RSVPs landing — guests who've responded (hidden if guest list is empty)
 *  4. Unanswered venue questions — venue_questions still open
 *
 * Acts on audit finding #7 (2026-05-06): dashboard was informational, not
 * actionable. Hardcoded "—" stats killed the entire purpose of the surface.
 *
 * Server-data only — pass counts in; this is a pure presentational component.
 * Pass `null` for any value that errored / is unavailable to render "—".
 */
export interface ActionWidgetData {
  // null = read errored; show "—" gracefully
  dueThisWeek: number | null;
  depositsComingUp: number | null;
  rsvps: {
    responded: number;
    total: number;
    yes: number;
    maybe: number;
    no: number;
  } | null;
  unansweredQuestions: number | null;
}

export function ActionWidgets({ data }: { data: ActionWidgetData }) {
  const widgets: WidgetTile[] = [
    {
      eyebrow: "Tasks due this week",
      value:
        data.dueThisWeek == null
          ? "—"
          : data.dueThisWeek === 0
          ? "0"
          : String(data.dueThisWeek),
      sub:
        data.dueThisWeek == null
          ? "Couldn't load — try later"
          : data.dueThisWeek === 0
          ? "You're caught up — anything new?"
          : `Open ${data.dueThisWeek === 1 ? "task" : "tasks"} this week or overdue`,
      href: "/plan",
      cta: "Open plan",
      tone: data.dueThisWeek && data.dueThisWeek > 0 ? "amber" : "stone",
    },
    {
      eyebrow: "Deposits coming up",
      value:
        data.depositsComingUp == null
          ? "—"
          : data.depositsComingUp === 0
          ? "0"
          : String(data.depositsComingUp),
      sub:
        data.depositsComingUp == null
          ? "Couldn't load — try later"
          : data.depositsComingUp === 0
          ? "No deposits due soon."
          : `Due in the next 30 days`,
      href: "/payments",
      cta: "Open payments",
      tone:
        data.depositsComingUp && data.depositsComingUp > 0 ? "rose" : "stone",
    },
    // RSVPs widget — hide entirely when guest list is empty (avoid a
    // confusing 0/0 tile during cold-start).
    ...(data.rsvps && data.rsvps.total > 0
      ? [
          {
            eyebrow: "RSVPs landing",
            value: `${data.rsvps.responded} of ${data.rsvps.total}`,
            sub: `${data.rsvps.yes} yes · ${data.rsvps.maybe} maybe · ${data.rsvps.no} no`,
            href: "/guests",
            cta: "Open guests",
            tone: "emerald" as WidgetTone,
          },
        ]
      : []),
    {
      eyebrow: "Unanswered venue questions",
      value:
        data.unansweredQuestions == null
          ? "—"
          : data.unansweredQuestions === 0
          ? "0"
          : String(data.unansweredQuestions),
      sub:
        data.unansweredQuestions == null
          ? "Couldn't load — try later"
          : data.unansweredQuestions === 0
          ? "All venue questions answered."
          : `Still waiting on a venue reply`,
      href: "/venues",
      cta: "Open venues",
      tone:
        data.unansweredQuestions && data.unansweredQuestions > 0
          ? "amber"
          : "stone",
    },
  ];

  return (
    <section aria-label="What's next">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          What needs you
        </div>
        <h2 className="mt-1 font-serif text-2xl font-light tracking-tight">
          Your next moves
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.map((w) => (
          <ActionTile key={w.eyebrow} {...w} />
        ))}
      </div>
    </section>
  );
}

type WidgetTone = "amber" | "rose" | "emerald" | "stone";

interface WidgetTile {
  eyebrow: string;
  value: string;
  sub: string;
  href: string;
  cta: string;
  tone: WidgetTone;
}

const TONE_RING: Record<WidgetTone, string> = {
  amber: "border-amber-200 hover:border-amber-300",
  rose: "border-rose-200 hover:border-rose-300",
  emerald: "border-emerald-200 hover:border-emerald-300",
  stone: "border-stone-200 hover:border-stone-300",
};

const TONE_VALUE: Record<WidgetTone, string> = {
  amber: "text-amber-900",
  rose: "text-rose-800",
  emerald: "text-emerald-800",
  stone: "text-stone-900",
};

function ActionTile({ eyebrow, value, sub, href, cta, tone }: WidgetTile) {
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${TONE_RING[tone]}`}
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {eyebrow}
        </div>
        <div
          className={`mb-1 mt-2 font-serif text-3xl font-light leading-none ${TONE_VALUE[tone]}`}
        >
          {value}
        </div>
        <div className="text-xs text-stone-500">{sub}</div>
      </div>
      <div className="mt-4 flex items-center gap-1 text-[11px] uppercase tracking-[0.15em] text-stone-600 transition group-hover:text-stone-900">
        {cta} <ArrowUpRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
