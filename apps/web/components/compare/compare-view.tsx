"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/venue-status";
import { EVENT_ROLE_SHORT } from "@/lib/event-roles";
import { VENUE_HIRE } from "@/lib/venue-pricing";
import { currencySymbol, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Database } from "@wedding-os/db";

type Venue = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  | "id"
  | "name"
  | "address"
  | "hero_photo_url"
  | "status"
  | "capacity_min"
  | "capacity_max"
  | "indoor_outdoor"
  | "in_house_catering"
  | "has_accommodation"
  | "event_roles"
  | "planner_notes"
  | "contact_name"
  | "contact_email"
>;

const MAX_SLOTS = 3;

export function CompareView({
  venues,
  baseCurrency = "USD",
}: {
  venues: Venue[];
  baseCurrency?: string;
}) {
  const [selectedIds, setSelectedIds] = useState<(string | null)[]>([
    venues[0]?.id ?? null,
    venues[1]?.id ?? null,
    null,
  ]);

  const selected = useMemo(
    () => selectedIds.map((id) => (id ? venues.find((v) => v.id === id) ?? null : null)),
    [selectedIds, venues],
  );

  const setSlot = (idx: number, id: string | null) => {
    setSelectedIds((prev) => prev.map((p, i) => (i === idx ? id : p)));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {selected.map((v, i) => (
          <SlotPicker
            key={i}
            slot={i}
            venue={v}
            allVenues={venues}
            takenIds={new Set(selectedIds.filter((x): x is string => !!x))}
            onChange={(id) => setSlot(i, id)}
          />
        ))}
      </div>

      <ComparisonTable venues={selected} baseCurrency={baseCurrency} />
    </div>
  );
}

function SlotPicker({
  slot,
  venue,
  allVenues,
  takenIds,
  onChange,
}: {
  slot: number;
  venue: Venue | null;
  allVenues: Venue[];
  takenIds: Set<string>;
  onChange: (id: string | null) => void;
}) {
  if (!venue) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-stone-500">
          <Plus className="h-6 w-6" />
          <Select onValueChange={(v) => onChange(v === "none" ? null : v)}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder={`Pick venue ${slot + 1}`} />
            </SelectTrigger>
            <SelectContent>
              {allVenues
                .filter((v) => !takenIds.has(v.id))
                .map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-100 via-rose-200 to-orange-300">
        {venue.hero_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.hero_photo_url} alt={venue.name} className="h-full w-full object-cover" />
        ) : null}
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Clear"
          className="absolute right-2 top-2 rounded-full bg-white/85 p-1.5 backdrop-blur hover:bg-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="absolute left-2 top-2">
          <Badge variant={STATUS_VARIANT[venue.status]}>{STATUS_LABEL[venue.status]}</Badge>
        </div>
      </div>
      <CardContent className="space-y-1 py-4">
        <h3 className="font-serif text-xl">{venue.name}</h3>
        <p className="text-xs text-stone-500">{venue.address ?? "—"}</p>
        <Link
          href={`/venues/${venue.id}`}
          className="mt-2 inline-block text-xs text-stone-600 hover:underline"
        >
          Open full detail →
        </Link>
      </CardContent>
    </Card>
  );
}

function ComparisonTable({
  venues,
  baseCurrency,
}: {
  venues: (Venue | null)[];
  baseCurrency: string;
}) {
  const symbol = currencySymbol(baseCurrency);
  const populated = venues.filter((v): v is Venue => !!v);
  if (populated.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Pick at least 2 venues to compare.
        </CardContent>
      </Card>
    );
  }

  type Row = {
    label: string;
    render: (v: Venue) => React.ReactNode;
    note?: string;
  };

  const rows: Row[] = [
    {
      label: "Capacity",
      render: (v) => `${v.capacity_min ?? "?"} – ${v.capacity_max ?? "?"} guests`,
    },
    {
      label: "Indoor / outdoor",
      render: (v) => v.indoor_outdoor ?? "—",
    },
    {
      label: "Event roles",
      render: (v) =>
        (v.event_roles ?? []).length === 0 ? (
          <span className="text-stone-400">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(v.event_roles ?? []).map((r) => (
              <Badge key={r} variant="secondary" className="text-[10px]">
                {EVENT_ROLE_SHORT[r]}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      label: "In-house catering",
      render: (v) => (v.in_house_catering ? "Yes" : "No"),
    },
    {
      label: "Hire fee — weekend",
      render: (v) => {
        const p = VENUE_HIRE[v.name];
        return p?.weekend_eur != null
          ? formatCurrency(p.weekend_eur, baseCurrency)
          : <span className="text-stone-400">TBD</span>;
      },
    },
    {
      label: "Hire fee — Sunday",
      render: (v) => {
        const p = VENUE_HIRE[v.name];
        const val = p?.sunday_eur ?? p?.weekend_eur;
        return val != null
          ? formatCurrency(val, baseCurrency)
          : <span className="text-stone-400">—</span>;
      },
    },
    {
      label: "Hire fee — weekday",
      render: (v) => {
        const p = VENUE_HIRE[v.name];
        return p?.weekday_eur != null
          ? formatCurrency(p.weekday_eur, baseCurrency)
          : <span className="text-stone-400">—</span>;
      },
    },
    {
      label: "Min-pax penalty?",
      render: (v) => {
        const p = VENUE_HIRE[v.name];
        if (p?.minimum_pax) {
          return (
            <span>
              <Badge variant="warning" className="text-[10px]">Yes</Badge>{" "}
              {p.shortfall_per_pax_eur
                ? `${symbol}${p.shortfall_per_pax_eur}/pax`
                : ""}
            </span>
          );
        }
        return <span className="text-stone-400">No</span>;
      },
    },
    {
      label: "On-site accommodation",
      render: (v) => (v.has_accommodation ? "Yes" : "No"),
    },
    {
      label: "Contact",
      render: (v) =>
        v.contact_name ? (
          <span>
            {v.contact_name}
            {v.contact_email && (
              <>
                {" "}
                ·{" "}
                <a className="hover:underline" href={`mailto:${v.contact_email}`}>
                  {v.contact_email}
                </a>
              </>
            )}
          </span>
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
    {
      label: "Planner notes",
      render: (v) =>
        v.planner_notes ? (
          <p className="text-xs leading-relaxed text-stone-600">{v.planner_notes}</p>
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
  ];

  return (
    <Card>
      <CardContent className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="px-3 py-3 text-left text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  Spec
                </th>
                {populated.map((v) => (
                  <th key={v.id} className="px-3 py-3 text-left font-serif text-base font-medium">
                    {v.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} className={cn(i % 2 === 1 && "bg-stone-50/50")}>
                  <td className="px-3 py-3 align-top text-xs uppercase tracking-[0.15em] text-stone-500">
                    {row.label}
                  </td>
                  {populated.map((v) => (
                    <td key={v.id} className="px-3 py-3 align-top">
                      {row.render(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
