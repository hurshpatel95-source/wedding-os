"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertCircle, Utensils, Users as UsersIcon } from "lucide-react";
import type { Database } from "@wedding-os/db";

type RsvpStatus = Database["public"]["Enums"]["rsvp_status"];
type GuestSide = Database["public"]["Enums"]["guest_side"];

type Guest = Pick<
  Database["public"]["Tables"]["guests"]["Row"],
  | "id"
  | "full_name"
  | "side"
  | "dietary"
  | "allergies"
  | "overall_rsvp"
  | "household_id"
  | "is_household_head"
  | "created_at"
  | "updated_at"
>;

type FilterKey = "all" | RsvpStatus;

const RSVP_LABEL: Record<RsvpStatus, string> = {
  yes: "Yes",
  no: "No",
  maybe: "Maybe",
  pending: "Pending",
};

const RSVP_TONE: Record<RsvpStatus, { dot: string; bg: string; text: string; ring: string }> = {
  yes: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  no: { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
  maybe: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-200" },
  pending: { dot: "bg-stone-400", bg: "bg-stone-50", text: "text-stone-700", ring: "ring-stone-200" },
};

const SIDE_LABEL: Record<GuestSide, string> = {
  bride: "Bride side",
  groom: "Groom side",
  both: "Both sides",
};

export function RsvpDashboard({ guests }: { guests: Guest[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const stats = useMemo(() => {
    const total = guests.length;
    const yes = guests.filter((g) => g.overall_rsvp === "yes").length;
    const no = guests.filter((g) => g.overall_rsvp === "no").length;
    const maybe = guests.filter((g) => g.overall_rsvp === "maybe").length;
    const pending = guests.filter((g) => g.overall_rsvp === "pending").length;
    const responded = yes + no + maybe;
    const respondedPct = total === 0 ? 0 : Math.round((responded / total) * 100);
    const yesPct = total === 0 ? 0 : Math.round((yes / total) * 100);
    return { total, yes, no, maybe, pending, responded, respondedPct, yesPct };
  }, [guests]);

  // Dietary breakdown: count by lowercased dietary value
  const dietaryTop = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of guests) {
      if (!g.dietary) continue;
      const key = g.dietary.trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [guests]);

  // Allergies — distinct, split on commas
  const allergyList = useMemo(() => {
    const set = new Set<string>();
    for (const g of guests) {
      if (!g.allergies) continue;
      g.allergies
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((a) => set.add(a));
    }
    return [...set].slice(0, 30);
  }, [guests]);

  // Household plus-ones outstanding: households with a head but other members still pending
  const plusOnesOutstanding = useMemo(() => {
    const byHousehold = new Map<string, Guest[]>();
    for (const g of guests) {
      if (!g.household_id) continue;
      const list = byHousehold.get(g.household_id) ?? [];
      list.push(g);
      byHousehold.set(g.household_id, list);
    }
    let outstanding = 0;
    for (const list of byHousehold.values()) {
      const head = list.find((g) => g.is_household_head);
      if (!head) continue;
      // Pending non-head members count as outstanding plus-ones
      outstanding += list.filter(
        (g) => !g.is_household_head && g.overall_rsvp === "pending",
      ).length;
    }
    return outstanding;
  }, [guests]);

  // Side breakdown — bride/groom totals + yes counts
  const sideStats = useMemo(() => {
    const make = (side: GuestSide) => {
      const list = guests.filter((g) => g.side === side);
      return { total: list.length, yes: list.filter((g) => g.overall_rsvp === "yes").length };
    };
    return {
      bride: make("bride"),
      groom: make("groom"),
      both: make("both"),
    };
  }, [guests]);

  // Recent RSVPs — last 10 guests who actually responded, newest first.
  // We rely on the guests table's updated_at being touched whenever a row's
  // overall_rsvp flips; the public RSVP API does that on every submit, and
  // admin Select edits in /guests do too via supabase.update.
  const recent = useMemo(() => {
    return [...guests]
      .filter((g) => g.overall_rsvp !== "pending")
      .sort((a, b) => {
        const ta = a.updated_at ?? "";
        const tb = b.updated_at ?? "";
        return tb.localeCompare(ta);
      })
      .slice(0, 10);
  }, [guests]);

  const filtered = useMemo(() => {
    if (filter === "all") return guests;
    return guests.filter((g) => g.overall_rsvp === filter);
  }, [guests, filter]);

  return (
    <div className="space-y-6">
      {/* Hero — celebratory headline + ring */}
      <section className="rounded-3xl border border-stone-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 sm:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
          <ProgressRing
            valuePct={stats.total === 0 ? 0 : Math.round((stats.yes / stats.total) * 100)}
            label={`${stats.yes}/${stats.total}`}
            sublabel="coming"
          />
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
              Guest list celebration
            </p>
            <h2 className="font-serif text-3xl font-light leading-tight tracking-tight md:text-4xl">
              <span className="text-rose-700">{stats.yes}</span> of {stats.total} guests are
              coming
            </h2>
            <p className="text-sm text-muted-foreground">
              {stats.responded} of {stats.total} have responded ({stats.respondedPct}%) ·{" "}
              {stats.pending} still pending
            </p>
          </div>
        </div>
      </section>

      {/* Stat tiles + donut */}
      <section className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["yes", "no", "maybe", "pending"] as RsvpStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(filter === s ? "all" : s)}
              className={[
                "rounded-2xl border bg-white p-4 text-left shadow-sm transition",
                filter === s
                  ? `border-stone-900 ring-2 ring-offset-2 ${RSVP_TONE[s].ring}`
                  : "border-stone-200 hover:border-stone-300",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <span className={`h-1.5 w-1.5 rounded-full ${RSVP_TONE[s].dot}`} />
                {RSVP_LABEL[s]}
              </div>
              <div className="mt-2 font-serif text-3xl font-light leading-none">
                {stats[s]}
              </div>
              {filter === s && (
                <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  Filtering ↓
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Response mix
          </div>
          <Donut total={stats.total} yes={stats.yes} no={stats.no} maybe={stats.maybe} pending={stats.pending} />
        </div>
      </section>

      {/* Side by side, plus-ones, dietary, allergies */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Sides */}
        {(sideStats.bride.total > 0 || sideStats.groom.total > 0 || sideStats.both.total > 0) && (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              By side
            </div>
            <div className="mt-3 space-y-3">
              {(["bride", "groom", "both"] as GuestSide[]).map((side) => {
                const s = sideStats[side];
                if (s.total === 0) return null;
                const pct = s.total === 0 ? 0 : Math.round((s.yes / s.total) * 100);
                return (
                  <div key={side}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-base">{SIDE_LABEL[side]}</span>
                      <span className="text-sm font-medium tabular-nums text-stone-700">
                        {s.yes} / {s.total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Plus-ones outstanding */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
            <UsersIcon className="h-3 w-3" />
            Plus-ones outstanding
          </div>
          <div className="mt-2 font-serif text-4xl font-light leading-none">
            {plusOnesOutstanding}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Household members still pending an RSVP from the household lead.
          </p>
        </div>

        {/* Dietary */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
            <Utensils className="h-3 w-3" />
            Dietary needs
          </div>
          {dietaryTop.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">None reported yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {dietaryTop.map(([name, count]) => (
                <li key={name} className="flex items-baseline justify-between gap-2">
                  <span className="capitalize text-stone-700">{name}</span>
                  <span className="font-medium tabular-nums text-stone-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Allergies callout */}
      {allergyList.length > 0 && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-rose-700">
            <AlertCircle className="h-3 w-3" />
            Allergies — flag for catering
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {allergyList.map((a) => (
              <span
                key={a}
                className="inline-flex items-center rounded-full bg-rose-600/10 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200"
              >
                {a}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Recent RSVPs */}
      {recent.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Recent RSVPs
          </div>
          <ul className="mt-3 divide-y divide-stone-100">
            {recent.map((g) => {
              const tone = RSVP_TONE[g.overall_rsvp];
              let when = "";
              try {
                when = format(parseISO(g.updated_at), "MMM d, p");
              } catch {
                when = "";
              }
              return (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-900">{g.full_name}</div>
                    {when && (
                      <div className="text-xs text-stone-500">{when}</div>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] ${tone.bg} ${tone.text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {RSVP_LABEL[g.overall_rsvp]}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Filtered list */}
      {filter !== "all" && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Showing {filtered.length} {RSVP_LABEL[filter as RsvpStatus]}
            </div>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="text-xs font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
            >
              Clear filter
            </button>
          </div>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g) => (
              <li
                key={g.id}
                className="truncate rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2 text-sm text-stone-800"
              >
                {g.full_name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ProgressRing({
  valuePct,
  label,
  sublabel,
}: {
  valuePct: number;
  label: string;
  sublabel?: string;
}) {
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, valuePct));
  const dash = (clamped / 100) * c;

  return (
    <div className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(231 229 228)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(225 29 72)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-serif text-2xl leading-none text-stone-900">{label}</div>
        {sublabel && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-stone-500">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

function Donut({
  total,
  yes,
  no,
  maybe,
  pending,
}: {
  total: number;
  yes: number;
  no: number;
  maybe: number;
  pending: number;
}) {
  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <div className="mt-3 flex h-[160px] items-center justify-center text-xs text-stone-400">
        No guests yet
      </div>
    );
  }

  const segments = [
    { key: "yes", count: yes, color: "rgb(16 185 129)" },
    { key: "maybe", count: maybe, color: "rgb(245 158 11)" },
    { key: "no", count: no, color: "rgb(244 63 94)" },
    { key: "pending", count: pending, color: "rgb(168 162 158)" },
  ];

  let offset = 0;
  return (
    <div className="mt-3 flex flex-col items-center gap-3">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(245 245 244)"
          strokeWidth={stroke}
        />
        {segments.map((seg) => {
          const len = (seg.count / total) * c;
          const dasharray = `${len} ${c - len}`;
          const dashoffset = -offset;
          offset += len;
          if (seg.count === 0) return null;
          return (
            <circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-stone-600">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="capitalize">{seg.key}</span>
            </span>
            <span className="tabular-nums text-stone-900">
              {total === 0 ? 0 : Math.round((seg.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
