"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Save, Trash2, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import { calcScenario, makeDefaultScenario } from "@/lib/scenario-calc";
import type {
  ScenarioInputs,
  EventSlot,
  RoomBlock,
  CustomLine,
  DayKind,
} from "@/lib/scenario-types";
import { VENUE_HIRE, HOTEL_PROFILES } from "@/lib/venue-pricing";
import { VENDOR_CATEGORY_LABEL, VENDOR_STATUS_LABEL, VENDOR_STATUS_VARIANT } from "@/lib/vendor-categories";
import type { VendorCategory, VendorStatus } from "@/lib/vendor-types";
import type { Database } from "@wedding-os/db";

interface VendorLite {
  id: string;
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  quoted_price_eur: number | null;
  include_in_pricing: boolean;
  deposit_amount_eur: number | null;
  deposit_due_at: string | null;
  deposit_paid_at: string | null;
}

type Venue = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  | "id"
  | "name"
  | "address"
  | "capacity_min"
  | "capacity_max"
  | "indoor_outdoor"
  | "event_roles"
  | "planner_notes"
  | "hero_photo_url"
  | "spaces"
>;

type EventRole = Database["public"]["Enums"]["event_role"];

interface ScenarioRow {
  id: string;
  name: string;
  inputs: ScenarioInputs;
  created_at: string;
}

const EVENT_ROLE_FOR_SLOT: Record<EventSlot["key"], EventRole[]> = {
  welcome: ["welcome"],
  sangeet: ["sangeet", "welcome"],
  wedding: ["wedding", "ceremony", "reception"],
};

const CUSTOM_CATEGORIES = [
  "Transport",
  "Decor & florals",
  "Photo / video",
  "DJ / music",
  "MUA / hair",
  "Mehndi artist",
  "Priest / pandit",
  "Sound / AV",
  "Lounge furniture",
  "Stationery",
  "Other",
];

const VAT_OPTIONS = [
  { value: 0.21, label: "21% (venue / general)" },
  { value: 0.1, label: "10% (catering / accom)" },
  { value: 0, label: "0% (exempt / inter-EU)" },
];

const DAY_LABEL: Record<DayKind, string> = {
  weekend: "Saturday",
  sunday: "Sunday",
  weekday: "Weekday",
};

function dayFromDate(dateStr: string | null | undefined): DayKind | null {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    const dow = d.getDay();
    if (dow === 0) return "sunday";
    if (dow === 6) return "weekend";
    return "weekday";
  } catch {
    return null;
  }
}

const cryptoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `cl_${Math.random().toString(36).slice(2)}`;

export function ScenarioStudio({
  scenarios,
  venues,
  vendors,
  role,
}: {
  scenarios: ScenarioRow[];
  venues: Venue[];
  vendors: VendorLite[];
  role: "admin" | "couple" | null;
}) {
  const router = useRouter();
  const [list, setList] = useState<ScenarioRow[]>(scenarios);
  const [activeId, setActiveId] = useState<string | null>(scenarios[0]?.id ?? null);
  const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  const fxEurUsd = Number(process.env.NEXT_PUBLIC_FX_EUR_USD ?? "1.08");
  const display = (eur: number) => (currency === "EUR" ? eur : eur * fxEurUsd);

  const venuesById = useMemo(
    () => Object.fromEntries(venues.map((v) => [v.id, v])) as Record<string, Venue>,
    [venues],
  );

  const active = list.find((s) => s.id === activeId) ?? null;

  const calcs = useMemo(
    () =>
      list.map((s) => ({
        id: s.id,
        name: s.name,
        calc: calcScenario(s.inputs, venuesById, vendors),
      })),
    [list, venuesById, vendors],
  );

  const updateActive = (mut: (input: ScenarioInputs) => ScenarioInputs) => {
    if (!active) return;
    setList((prev) =>
      prev.map((s) => (s.id === active.id ? { ...s, inputs: mut(s.inputs) } : s)),
    );
    setDirtyIds((prev) => new Set(prev).add(active.id));
  };

  const handleSave = async () => {
    if (!active) return;
    setSavingId(active.id);
    const supabase = createClient();
    const calc = calcScenario(active.inputs, venuesById, vendors);
    const { error } = await supabase
      .from("pricing_scenarios")
      .update({
        inputs: active.inputs as never,
        calculated_total: Math.round(calc.hosts_grand_eur),
      })
      .eq("id", active.id);
    setSavingId(null);
    if (error) {
      alert(`Save failed: ${error.message}`);
      return;
    }
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(active.id);
      return next;
    });
  };

  const handleAddScenario = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("users")
      .select("workspace_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return;

    const name = `Scenario ${list.length + 1}`;
    const inputs = makeDefaultScenario({
      description: "New scenario — fill in the details",
    });

    // Anchor to first wedding-capable venue if any
    const anchor =
      venues.find((v) => (v.event_roles ?? []).includes("wedding")) ?? venues[0];
    if (!anchor) return;

    const { data, error } = await supabase
      .from("pricing_scenarios")
      .insert({
        workspace_id: profile.workspace_id,
        venue_id: anchor.id,
        name,
        inputs: inputs as never,
        calculated_total: 0,
        currency: "EUR",
      })
      .select()
      .single();
    if (error || !data) {
      alert(`Add failed: ${error?.message ?? "unknown"}`);
      return;
    }
    const row: ScenarioRow = {
      id: data.id,
      name: data.name,
      inputs,
      created_at: data.created_at,
    };
    setList((prev) => [...prev, row]);
    setActiveId(row.id);
  };

  const handleDeleteScenario = async () => {
    if (!active) return;
    if (!confirm(`Delete "${active.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("pricing_scenarios").delete().eq("id", active.id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    setList((prev) => {
      const next = prev.filter((s) => s.id !== active.id);
      setActiveId(next[0]?.id ?? null);
      return next;
    });
    router.refresh();
  };

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">No scenarios yet.</p>
          <Button onClick={handleAddScenario}>
            <Plus className="h-4 w-4" />
            Create your first scenario
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dirty = active ? dirtyIds.has(active.id) : false;

  return (
    <div className="space-y-6">
      {/* Comparison strip */}
      <ComparisonStrip
        rows={calcs}
        activeId={activeId}
        onSelect={setActiveId}
        currency={currency}
        toDisplay={display}
      />

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            className={cn(
              "relative rounded-full px-4 py-1.5 text-sm transition-colors",
              s.id === activeId
                ? "bg-stone-900 text-white"
                : "border border-stone-200 bg-white text-stone-600 hover:text-stone-900",
            )}
          >
            {s.name}
            {dirtyIds.has(s.id) && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={handleAddScenario}
          className="flex items-center gap-1 rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-500 hover:text-stone-900"
        >
          <Plus className="h-3.5 w-3.5" />
          Add scenario
        </button>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Currency</div>
          <Select value={currency} onValueChange={(v) => setCurrency(v as "EUR" | "USD")}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={!dirty || savingId === active?.id}>
            <Save className="h-4 w-4" />
            {savingId === active?.id ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
          {role === "admin" && active && (
            <Button variant="outline" onClick={handleDeleteScenario}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {active && (
        <ActiveScenarioEditor
          scenario={active}
          venues={venues}
          vendors={vendors}
          venuesById={venuesById}
          updateActive={updateActive}
          currency={currency}
          toDisplay={display}
        />
      )}
    </div>
  );
}

function ComparisonStrip({
  rows,
  activeId,
  onSelect,
  currency,
  toDisplay,
}: {
  rows: { id: string; name: string; calc: ReturnType<typeof calcScenario> }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  currency: "EUR" | "USD";
  toDisplay: (eur: number) => number;
}) {
  if (rows.length < 2) return null;
  const cheapest = Math.min(...rows.map((r) => r.calc.hosts_grand_eur));

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {rows.map((r) => {
        const isLowest = r.calc.hosts_grand_eur === cheapest;
        const active = r.id === activeId;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r.id)}
            className={cn(
              "rounded-2xl border bg-white p-5 text-left shadow-sm transition",
              active ? "border-stone-900 shadow-md" : "border-stone-200 hover:border-stone-400",
              isLowest && !active ? "ring-1 ring-emerald-300" : "",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{r.name}</div>
              {isLowest && (
                <Badge variant="success" className="text-[10px]">
                  Lowest
                </Badge>
              )}
            </div>
            <div className="mt-3 font-serif text-3xl font-light leading-none">
              {formatMoney(toDisplay(r.calc.hosts_grand_eur), currency)}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {r.calc.events.length} event{r.calc.events.length === 1 ? "" : "s"} · hosts' direct
              cost
            </div>
            <div className="mt-2 text-xs text-stone-500">
              + {formatMoney(toDisplay(r.calc.accommodation_grand_eur), currency)} accom
              (informational)
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ActiveScenarioEditor({
  scenario,
  venues,
  vendors,
  venuesById,
  updateActive,
  currency,
  toDisplay,
}: {
  scenario: ScenarioRow;
  venues: Venue[];
  vendors: VendorLite[];
  venuesById: Record<string, Venue>;
  updateActive: (mut: (input: ScenarioInputs) => ScenarioInputs) => void;
  currency: "EUR" | "USD";
  toDisplay: (eur: number) => number;
}) {
  const inp = scenario.inputs;
  const calc = useMemo(
    () => calcScenario(inp, venuesById, vendors),
    [inp, venuesById, vendors],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {/* Scenario header */}
        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1.5 md:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  value={inp.description}
                  onChange={(e) =>
                    updateActive((s) => ({ ...s, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="g">Guests (all events)</Label>
                <Input
                  id="g"
                  inputMode="numeric"
                  value={inp.guest_count}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^\d]/g, "") || 0);
                    updateActive((s) => ({
                      ...s,
                      guest_count: n,
                      events: s.link_guest_count
                        ? s.events.map((ev) => ({ ...ev, guests: n }))
                        : s.events,
                    }));
                  }}
                />
              </div>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              step={5}
              value={inp.guest_count}
              onChange={(e) => {
                const n = Number(e.target.value);
                updateActive((s) => ({
                  ...s,
                  guest_count: n,
                  events: s.link_guest_count
                    ? s.events.map((ev) => ({ ...ev, guests: n }))
                    : s.events,
                }));
              }}
              className="w-full accent-stone-900"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={inp.link_guest_count}
                    onChange={(e) =>
                      updateActive((s) => ({ ...s, link_guest_count: e.target.checked }))
                    }
                  />
                  Same guest count for every event
                </label>
              </div>
              <div className="flex gap-2 text-xs text-stone-500">
                <span>From</span>
                <input
                  type="date"
                  value={inp.date_range.from}
                  onChange={(e) =>
                    updateActive((s) => ({
                      ...s,
                      date_range: { ...s.date_range, from: e.target.value },
                    }))
                  }
                  className="rounded border border-stone-200 bg-white px-2 py-1"
                />
                <span>to</span>
                <input
                  type="date"
                  value={inp.date_range.to}
                  onChange={(e) =>
                    updateActive((s) => ({
                      ...s,
                      date_range: { ...s.date_range, to: e.target.value },
                    }))
                  }
                  className="rounded border border-stone-200 bg-white px-2 py-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events */}
        {inp.events.map((ev, i) => (
          <EventSlotEditor
            key={ev.key}
            slot={ev}
            venues={venues}
            linked={inp.link_guest_count}
            globalGuests={inp.guest_count}
            currency={currency}
            toDisplay={toDisplay}
            calcLine={calc.events.find((c) => c.key === ev.key) ?? null}
            onChange={(patch) =>
              updateActive((s) => ({
                ...s,
                events: s.events.map((e2, idx) => (idx === i ? { ...e2, ...patch } : e2)),
              }))
            }
            onChangeSpace={(idx, sel) =>
              updateActive((s) => ({
                ...s,
                events: s.events.map((e2, ix) => {
                  if (ix !== i) return e2;
                  if (!e2.spaces) return e2;
                  return {
                    ...e2,
                    spaces: e2.spaces.map((sp, j) =>
                      j === idx ? { ...sp, selected: sel } : sp,
                    ),
                  };
                }),
              }))
            }
          />
        ))}

        {/* Room block */}
        <RoomBlockEditor
          venues={venues}
          room={inp.room_block}
          currency={currency}
          toDisplay={toDisplay}
          onChange={(rb) => updateActive((s) => ({ ...s, room_block: rb }))}
        />

        {/* Vendors rolling into the total (workspace-wide) */}
        <VendorRollupCard vendors={vendors} currency={currency} toDisplay={toDisplay} />

        {/* Custom lines */}
        <CustomLinesTable
          lines={inp.custom_lines}
          currency={currency}
          toDisplay={toDisplay}
          onChange={(cl) => updateActive((s) => ({ ...s, custom_lines: cl }))}
        />

        {/* Open items */}
        {inp.open_items.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="space-y-2 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-800">
                Things to confirm with Astia
              </div>
              <ul className="space-y-1 text-sm text-stone-700">
                {inp.open_items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-700">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right rail: live total */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <TotalsCard calc={calc} currency={currency} toDisplay={toDisplay} />
      </aside>
    </div>
  );
}

function EventSlotEditor({
  slot,
  venues,
  linked,
  globalGuests,
  currency,
  toDisplay,
  calcLine,
  onChange,
  onChangeSpace,
}: {
  slot: EventSlot;
  venues: Venue[];
  linked: boolean;
  globalGuests: number;
  currency: "EUR" | "USD";
  toDisplay: (eur: number) => number;
  calcLine: { hire_eur: number; catering_subtotal_eur: number; shortfall_eur: number; net_eur: number; hire_note?: string; shortfall_note?: string } | null;
  onChange: (patch: Partial<EventSlot>) => void;
  onChangeSpace: (idx: number, selected: boolean) => void;
}) {
  const matches = EVENT_ROLE_FOR_SLOT[slot.key];
  const compatible = venues.filter((v) =>
    (v.event_roles ?? []).some((r) => matches.includes(r)),
  );
  const venue = slot.venue_id ? venues.find((v) => v.id === slot.venue_id) ?? null : null;
  const profile = venue ? VENUE_HIRE[venue.name] : undefined;

  const guests = linked ? globalGuests : slot.guests;

  return (
    <Card className={cn(slot.enabled ? "" : "opacity-60")}>
      <CardContent className="space-y-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-xl">{slot.label}</h3>
              {profile?.minimum_pax && (
                <Badge variant="warning" className="text-[10px]">
                  Has minimum-pax
                </Badge>
              )}
            </div>
            <p className="text-xs text-stone-500">
              Compatible venues: {compatible.length}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={slot.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
            />
            Include
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Venue</Label>
            <Select
              value={slot.venue_id ?? "none"}
              onValueChange={(v) => {
                const newVenueId = v === "none" ? null : v;
                const newVenue = newVenueId
                  ? venues.find((vn) => vn.id === newVenueId)
                  : null;
                // If the picked venue has a composite-spaces breakdown, copy
                // it onto the event slot with all spaces selected by default.
                // Cleared back to undefined when venue is unset / no spaces.
                const venueSpaces = newVenue?.spaces;
                const newSpaces =
                  venueSpaces && venueSpaces.length > 0
                    ? venueSpaces.map((s) => ({
                        label: s.label,
                        price_eur: Number(s.price_eur),
                        selected: true,
                      }))
                    : undefined;
                onChange({ venue_id: newVenueId, spaces: newSpaces });
              }}
              disabled={!slot.enabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— not picked —</SelectItem>
                {compatible.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} · cap {v.capacity_min ?? "?"}–{v.capacity_max ?? "?"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={slot.date ?? ""}
              onChange={(e) => {
                const newDate = e.target.value || null;
                const derived = dayFromDate(newDate);
                onChange({
                  date: newDate,
                  ...(derived ? { day: derived } : {}),
                });
              }}
              disabled={!slot.enabled}
            />
            {slot.date && (
              <p className="text-[10px] text-stone-500">
                {format(parseISO(slot.date), "EEE, MMM d")}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Day of week</Label>
            <Select
              value={slot.day}
              onValueChange={(v) => onChange({ day: v as DayKind })}
              disabled={!slot.enabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekend">Saturday</SelectItem>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="weekday">Weekday (Mon–Fri)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {slot.enabled && slot.date && dayFromDate(slot.date) && dayFromDate(slot.date) !== slot.day && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
            <div>
              <span className="font-medium">{format(parseISO(slot.date), "MMM d")}</span> is a{" "}
              <span className="font-medium">{DAY_LABEL[dayFromDate(slot.date)!]}</span>, but
              you've picked <span className="font-medium">{DAY_LABEL[slot.day]}</span> pricing.
              Useful for "what-if" modeling — but the venue may not be available that day or the
              rate may be wrong.
            </div>
          </div>
        )}

        {!linked && slot.enabled && (
          <div className="grid gap-1.5 md:max-w-xs">
            <Label>Guests for this event</Label>
            <Input
              inputMode="numeric"
              value={slot.guests}
              onChange={(e) =>
                onChange({ guests: Number(e.target.value.replace(/[^\d]/g, "") || 0) })
              }
            />
          </div>
        )}

        {/* Spaces breakdown (e.g., MSL) */}
        {slot.spaces && slot.spaces.length > 0 && slot.enabled && (
          <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-stone-500">
              <span>Spaces breakdown</span>
              <span>{slot.spaces.filter((s) => s.selected).length} of {slot.spaces.length} selected</span>
            </div>
            <ul className="space-y-1.5">
              {slot.spaces.map((sp, idx) => (
                <li key={idx} className="flex items-center justify-between text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sp.selected}
                      onChange={(e) => onChangeSpace(idx, e.target.checked)}
                    />
                    {sp.label}
                  </label>
                  <span className={cn("font-medium", !sp.selected && "text-stone-400 line-through")}>
                    {formatMoney(toDisplay(sp.price_eur), currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Catering rate */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Catering label</Label>
            <Input
              value={slot.catering_label}
              onChange={(e) => onChange({ catering_label: e.target.value })}
              disabled={!slot.enabled}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Catering / pax (EUR)</Label>
            <Input
              inputMode="decimal"
              value={slot.catering_per_pax_eur}
              onChange={(e) =>
                onChange({
                  catering_per_pax_eur: Number(e.target.value.replace(/[^\d.]/g, "") || 0),
                })
              }
              disabled={!slot.enabled}
            />
          </div>
        </div>

        {/* Live line breakdown */}
        {slot.enabled && calcLine && (
          <div className="space-y-1 rounded-lg border bg-secondary/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-stone-700">
                Venue hire ({slot.day}){venue ? ` · ${venue.name}` : ""}
              </span>
              <span className="font-medium">
                {formatMoney(toDisplay(calcLine.hire_eur), currency)}
              </span>
            </div>
            {calcLine.hire_note && (
              <div className="text-xs text-stone-500">{calcLine.hire_note}</div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-stone-700">
                {slot.catering_label} · {guests} guests × €{slot.catering_per_pax_eur}
              </span>
              <span className="font-medium">
                {formatMoney(toDisplay(calcLine.catering_subtotal_eur), currency)}
              </span>
            </div>
            {calcLine.shortfall_eur > 0 && (
              <div className="rounded bg-amber-50 px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-amber-800">Guest minimum shortfall</span>
                  <span className="font-medium text-amber-900">
                    {formatMoney(toDisplay(calcLine.shortfall_eur), currency)}
                  </span>
                </div>
                {calcLine.shortfall_note && (
                  <div className="text-xs text-amber-700">{calcLine.shortfall_note}</div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-stone-200 pt-1.5 font-medium">
              <span>Event subtotal (net)</span>
              <span>{formatMoney(toDisplay(calcLine.net_eur), currency)}</span>
            </div>
          </div>
        )}

        {profile?.notes && (
          <p className="rounded bg-stone-50 px-2 py-1.5 text-xs italic text-stone-500">
            {profile.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RoomBlockEditor({
  venues,
  room,
  currency,
  toDisplay,
  onChange,
}: {
  venues: Venue[];
  room: RoomBlock | null;
  currency: "EUR" | "USD";
  toDisplay: (eur: number) => number;
  onChange: (rb: RoomBlock | null) => void;
}) {
  const r =
    room ??
    ({
      enabled: false,
      hotel_venue_id: null,
      rooms: 12,
      nights: 3,
      online_rate_eur: 408,
      discount_pct: 0.2,
    } as RoomBlock);

  const hotelVenues = venues.filter(
    (v) => (v.event_roles ?? []).includes("stay") || HOTEL_PROFILES[v.name],
  );
  const hotel = r.hotel_venue_id ? venues.find((v) => v.id === r.hotel_venue_id) : null;

  const discountedRate = r.online_rate_eur * (1 - r.discount_pct);
  const subtotal = discountedRate * r.rooms * r.nights;

  return (
    <Card className={cn(r.enabled ? "" : "opacity-70")}>
      <CardContent className="space-y-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl">Family room block</h3>
            <p className="text-xs text-stone-500">
              Informational only — guests pay their own rooms.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) => onChange({ ...r, enabled: e.target.checked })}
            />
            Include estimate
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Hotel</Label>
            <Select
              value={r.hotel_venue_id ?? "none"}
              onValueChange={(v) => {
                const venue = venues.find((vn) => vn.id === v);
                const profile = venue ? HOTEL_PROFILES[venue.name] : undefined;
                onChange({
                  ...r,
                  hotel_venue_id: v === "none" ? null : v,
                  online_rate_eur: profile?.online_rate_eur ?? r.online_rate_eur,
                  discount_pct: profile?.default_discount_pct ?? r.discount_pct,
                });
              }}
              disabled={!r.enabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a hotel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— not picked —</SelectItem>
                {hotelVenues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Rooms</Label>
            <Input
              inputMode="numeric"
              value={r.rooms}
              onChange={(e) =>
                onChange({ ...r, rooms: Number(e.target.value.replace(/[^\d]/g, "") || 0) })
              }
              disabled={!r.enabled}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Nights</Label>
            <Input
              inputMode="numeric"
              value={r.nights}
              onChange={(e) =>
                onChange({ ...r, nights: Number(e.target.value.replace(/[^\d]/g, "") || 0) })
              }
              disabled={!r.enabled}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Online rate / night (EUR)</Label>
            <Input
              inputMode="decimal"
              value={r.online_rate_eur}
              onChange={(e) =>
                onChange({
                  ...r,
                  online_rate_eur: Number(e.target.value.replace(/[^\d.]/g, "") || 0),
                })
              }
              disabled={!r.enabled}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Advance discount</Label>
            <Select
              value={r.discount_pct.toString()}
              onValueChange={(v) => onChange({ ...r, discount_pct: Number(v) })}
              disabled={!r.enabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.2">20% (90+ days advance)</SelectItem>
                <SelectItem value="0.15">15% (89-15 days)</SelectItem>
                <SelectItem value="0.1">10% (under 14 days)</SelectItem>
                <SelectItem value="0">0% (rack rate)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Discounted rate</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm">
              {formatMoney(toDisplay(discountedRate), currency)}
            </div>
          </div>
        </div>

        {r.enabled && hotel && (
          <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>
                Room block: {r.rooms} rooms × {r.nights} nights ×{" "}
                {formatMoney(toDisplay(discountedRate), currency)}
              </span>
              <span className="font-medium">{formatMoney(toDisplay(subtotal), currency)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VendorRollupCard({
  vendors,
  currency,
  toDisplay,
}: {
  vendors: VendorLite[];
  currency: "EUR" | "USD";
  toDisplay: (eur: number) => number;
}) {
  const included = vendors.filter(
    (v) => v.include_in_pricing && v.quoted_price_eur != null,
  );
  const excluded = vendors.filter(
    (v) => !v.include_in_pricing || v.quoted_price_eur == null,
  );
  const subtotalNet = included.reduce((acc, v) => acc + Number(v.quoted_price_eur ?? 0), 0);
  const subtotalVat = subtotalNet * 0.21;

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl">Booked vendors (workspace-wide)</h3>
            <p className="text-xs text-stone-500">
              Quoted-price vendors flagged "include in pricing" roll into every scenario's total.
              Manage at <a href="/vendors" className="underline">/vendors</a>.
            </p>
          </div>
        </div>

        {included.length === 0 && excluded.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
            No vendors yet. Add florists, photo+video, DJ, MUA, transport, etc. on the{" "}
            <a href="/vendors" className="underline">Vendors page</a>.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Quote (net)</th>
                </tr>
              </thead>
              <tbody>
                {included.map((v) => (
                  <tr key={v.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 text-xs text-stone-500">
                      {VENDOR_CATEGORY_LABEL[v.category]}
                    </td>
                    <td className="px-3 py-2">
                      <a href={`/vendors/${v.id}`} className="hover:underline">
                        {v.name}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={VENDOR_STATUS_VARIANT[v.status]} className="text-[10px]">
                        {VENDOR_STATUS_LABEL[v.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatMoney(toDisplay(Number(v.quoted_price_eur)), currency)}
                    </td>
                  </tr>
                ))}
                {excluded.map((v) => (
                  <tr key={v.id} className="border-t border-stone-100 text-stone-400">
                    <td className="px-3 py-2 text-xs">{VENDOR_CATEGORY_LABEL[v.category]}</td>
                    <td className="px-3 py-2">
                      <a href={`/vendors/${v.id}`} className="hover:underline">
                        {v.name}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="muted" className="text-[10px]">
                        not in pricing
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-xs italic">
                      {v.quoted_price_eur == null ? "no quote yet" : "excluded"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-stone-200 bg-stone-50/50">
                  <td colSpan={3} className="px-3 py-2 text-right font-medium">
                    Vendor subtotal (net + 21% VAT)
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatMoney(toDisplay(subtotalNet + subtotalVat), currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomLinesTable({
  lines,
  currency,
  toDisplay,
  onChange,
}: {
  lines: CustomLine[];
  currency: "EUR" | "USD";
  toDisplay: (eur: number) => number;
  onChange: (lines: CustomLine[]) => void;
}) {
  const addLine = () => {
    const next: CustomLine = {
      id: cryptoId(),
      category: "Transport",
      label: "",
      qty: 1,
      unit_price_eur: 0,
      vat_rate: 0.21,
      notes: "",
    };
    onChange([...lines, next]);
  };

  const update = (id: string, patch: Partial<CustomLine>) => {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const remove = (id: string) => {
    onChange(lines.filter((l) => l.id !== id));
  };

  const subtotal = lines.reduce((acc, l) => acc + l.qty * l.unit_price_eur, 0);
  const vat = lines.reduce((acc, l) => acc + l.qty * l.unit_price_eur * l.vat_rate, 0);

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl">Vendor &amp; misc line items</h3>
            <p className="text-xs text-stone-500">
              Bus A→B, decor, photo+video, DJ, MUA, mehndi, priest, sound, lounge furniture,
              stationery — anything Astha quotes that isn't venue hire or catering.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
            No line items yet. Click "Add line" to start dropping in vendor quotes.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Label</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit (€)</th>
                  <th className="px-3 py-2 text-left">VAT</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const sub = l.qty * l.unit_price_eur;
                  return (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="px-2 py-2">
                        <Select
                          value={l.category}
                          onValueChange={(v) => update(l.id, { category: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOM_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          className="h-8"
                          placeholder="e.g. Coach Sitges → MSL"
                          value={l.label}
                          onChange={(e) => update(l.id, { label: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          className="h-8 w-16 text-right"
                          inputMode="numeric"
                          value={l.qty}
                          onChange={(e) =>
                            update(l.id, {
                              qty: Number(e.target.value.replace(/[^\d]/g, "") || 0),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          className="h-8 w-24 text-right"
                          inputMode="decimal"
                          value={l.unit_price_eur}
                          onChange={(e) =>
                            update(l.id, {
                              unit_price_eur: Number(
                                e.target.value.replace(/[^\d.]/g, "") || 0,
                              ),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Select
                          value={l.vat_rate.toString()}
                          onValueChange={(v) => update(l.id, { vat_rate: Number(v) })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value.toString()}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2 text-right font-medium">
                        {formatMoney(toDisplay(sub), currency)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove"
                          onClick={() => remove(l.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-stone-200 bg-stone-50/50 text-sm">
                  <td colSpan={5} className="px-3 py-2 text-right font-medium">
                    Custom subtotal (net + VAT)
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatMoney(toDisplay(subtotal + vat), currency)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TotalsCard({
  calc,
  currency,
  toDisplay,
}: {
  calc: ReturnType<typeof calcScenario>;
  currency: "EUR" | "USD";
  toDisplay: (eur: number) => number;
}) {
  const [showAccom, setShowAccom] = useState(false);

  return (
    <Card className="border-stone-300 bg-stone-900 text-stone-100">
      <CardContent className="space-y-4 py-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-400">
            Hosts' direct cost
          </div>
          <div className="font-serif text-4xl font-light leading-none">
            {formatMoney(toDisplay(calc.hosts_grand_eur), currency)}
          </div>
          <div className="mt-1 text-xs text-stone-400">
            Excl. accommodation. Incl. all VAT.
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <Row label="Venue hire (net)" value={toDisplay(calc.venue_net_eur)} currency={currency} />
          <Row
            label="Catering + shortfall (net)"
            value={toDisplay(calc.catering_net_eur)}
            currency={currency}
          />
          {calc.vendors_net_eur > 0 && (
            <Row
              label={`Vendors (net) · ${calc.vendors_count}`}
              value={toDisplay(calc.vendors_net_eur)}
              currency={currency}
            />
          )}
          {calc.custom_lines_net_eur > 0 && (
            <Row
              label="Custom lines (net)"
              value={toDisplay(calc.custom_lines_net_eur)}
              currency={currency}
            />
          )}
          <Row
            label="VAT 21% (venue)"
            value={toDisplay(calc.venue_vat_eur)}
            currency={currency}
            muted
          />
          <Row
            label="VAT 10% (F&B)"
            value={toDisplay(calc.catering_vat_eur)}
            currency={currency}
            muted
          />
          {calc.vendors_vat_eur > 0 && (
            <Row
              label="VAT 21% (vendors)"
              value={toDisplay(calc.vendors_vat_eur)}
              currency={currency}
              muted
            />
          )}
          {calc.custom_lines_vat_eur > 0 && (
            <Row
              label="VAT (custom lines)"
              value={toDisplay(calc.custom_lines_vat_eur)}
              currency={currency}
              muted
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAccom((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-stone-700 bg-stone-800 px-3 py-2 text-xs"
        >
          <span className="text-stone-400">Family accommodation (informational)</span>
          <span className="flex items-center gap-1 font-medium">
            {formatMoney(toDisplay(calc.accommodation_grand_eur), currency)}
            <ChevronDown className={cn("h-3 w-3 transition", showAccom && "rotate-180")} />
          </span>
        </button>
        {showAccom && (
          <div className="space-y-1 rounded-md bg-stone-800 p-3 text-xs">
            <Row
              label="Room block (net)"
              value={toDisplay(calc.room_block_net_eur)}
              currency={currency}
              muted
            />
            <Row
              label="VAT 10%"
              value={toDisplay(calc.room_block_vat_eur)}
              currency={currency}
              muted
            />
            <div className="border-t border-stone-700 pt-1 text-stone-300">
              Guests pay their own — not a host cost.
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-stone-700 pt-3 text-sm">
          <span className="font-medium">Combined (everything)</span>
          <span className="font-serif text-xl font-medium">
            {formatMoney(toDisplay(calc.combined_grand_eur), currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  currency,
  muted,
}: {
  label: string;
  value: number;
  currency: "EUR" | "USD";
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        muted ? "text-stone-400" : "text-stone-200",
      )}
    >
      <span>{label}</span>
      <span>{formatMoney(value, currency)}</span>
    </div>
  );
}
