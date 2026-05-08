"use client";

// /pricing — Full Pricing Planner
//
// Multi-event venue picker with EDITABLE line items per event. Built so a
// couple (or their planner) can model "Casa Del Mar Sangeet + Mas de Sant
// Wedding" and then override any line as quotes shift.
//
// Per-event surface:
//   1. Pick a venue (filtered by event_roles)
//   2. Pick a day-of-week (drives default venue hire from HIRE_FEES seed)
//   3. Set guest count (linked to the global slider, or per-event)
//   4. Override venue hire + per-guest catering rate inline
//   5. Add custom line items (e.g. "Floral allowance €4,000") with their
//      own labels and amounts
//   6. Subtotal recomputes live
//
// Grand total at the bottom: subtotal + 21% Spain VAT + grand-with-VAT.
//
// Persistence: localStorage key "acquired-planner.pricing.v1" so refreshing
// the page doesn't wipe the in-laws' carefully-built scenario. Saving named
// scenarios to the DB is a follow-up.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_ROLE_SHORT } from "@/lib/event-roles";
import { formatMoney } from "@/lib/utils";
import type { Database } from "@wedding-os/db";

type Venue = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  | "id"
  | "name"
  | "address"
  | "status"
  | "capacity_min"
  | "capacity_max"
  | "indoor_outdoor"
  | "in_house_catering"
  | "has_accommodation"
  | "event_roles"
  | "planner_notes"
  | "hero_photo_url"
>;

type EventRole = Database["public"]["Enums"]["event_role"];

// The events you might plan for. Order matches the day-of-the-wedding sequence.
type EventSlotKey = "welcome" | "sangeet" | "wedding";

interface EventSlotConfig {
  key: EventSlotKey;
  label: string;
  matches: EventRole[];
  per_guest_eur: number;
  per_guest_label: string;
}

const EVENT_SLOTS: EventSlotConfig[] = [
  {
    key: "welcome",
    label: "Welcome / cocktail",
    matches: ["welcome"],
    per_guest_eur: 60,
    per_guest_label: "Cocktail menu",
  },
  {
    key: "sangeet",
    label: "Sangeet / pre-wedding party",
    matches: ["sangeet", "welcome"],
    per_guest_eur: 180,
    per_guest_label: "Sangeet menu (food + drink + service)",
  },
  {
    key: "wedding",
    label: "Wedding (ceremony + reception)",
    matches: ["wedding", "ceremony", "reception"],
    per_guest_eur: 220,
    per_guest_label: "Wedding menu (food + drink + service + furniture)",
  },
];

// Astha's quoted hire fees per venue, EUR before VAT. These are the SEED
// defaults — the user can override them inline per event.
const HIRE_FEES: Record<
  string,
  { weekday: number | null; weekend: number | null; note?: string }
> = {
  "Casa Del Mar": { weekday: 12400, weekend: 14000 },
  "Xalet Del Nin": {
    weekday: 19000,
    weekend: 22000,
    note: "Sun €19k / Sat €22k — Friday not quoted",
  },
  "ME Sitges Terramar": {
    weekday: null,
    weekend: null,
    note: "Rooftop event space — quote pending",
  },
  "Marina Port Vell": {
    weekday: 9500,
    weekend: 6500,
    note: "Weekday is more expensive at this venue",
  },
  "Mas de Sant Llei": {
    weekday: 9000,
    weekend: 9000,
    note: "Composite: orange courtyard €2k + cocktail courtyard €2.5k + indoor 2h dance €4.5k",
  },
  "Sant Esteve": {
    weekday: 9000,
    weekend: 9000,
    note: "(same property as Mas de Sant Llei)",
  },
  "ME Barcelona": { weekday: 5200, weekend: 5200 },
};

type DayOfWeek = "weekday" | "weekend";

interface CustomLine {
  id: string;
  label: string;
  amount: number;
}

interface SlotState {
  enabled: boolean;
  venueId: string | null;
  day: DayOfWeek;
  guests: number;
  // Overrides — null means "use seed default from HIRE_FEES / per_guest_eur"
  hireOverride: number | null;
  perGuestOverride: number | null;
  // Free-form additional line items
  extraLines: CustomLine[];
}

interface PersistedState {
  currency: "EUR" | "USD";
  globalGuests: number;
  linkGuests: boolean;
  slots: Record<EventSlotKey, SlotState>;
}

const STORAGE_KEY = "acquired-planner.pricing.v1";
const DEFAULT_GUESTS = 150;

const DEFAULT_SLOTS: Record<EventSlotKey, SlotState> = {
  welcome: {
    enabled: false,
    venueId: null,
    day: "weekend",
    guests: DEFAULT_GUESTS,
    hireOverride: null,
    perGuestOverride: null,
    extraLines: [],
  },
  sangeet: {
    enabled: true,
    venueId: null,
    day: "weekend",
    guests: DEFAULT_GUESTS,
    hireOverride: null,
    perGuestOverride: null,
    extraLines: [],
  },
  wedding: {
    enabled: true,
    venueId: null,
    day: "weekend",
    guests: DEFAULT_GUESTS,
    hireOverride: null,
    perGuestOverride: null,
    extraLines: [],
  },
};

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // Defensive: ensure every slot has all expected fields (forward-compat)
    const slots = { ...DEFAULT_SLOTS };
    for (const k of Object.keys(slots) as EventSlotKey[]) {
      const persisted = parsed.slots?.[k];
      if (persisted) {
        slots[k] = {
          ...slots[k],
          ...persisted,
          extraLines: Array.isArray(persisted.extraLines)
            ? persisted.extraLines
            : [],
        };
      }
    }
    return {
      currency: parsed.currency === "USD" ? "USD" : "EUR",
      globalGuests: Number.isFinite(parsed.globalGuests)
        ? parsed.globalGuests
        : DEFAULT_GUESTS,
      linkGuests: parsed.linkGuests !== false,
      slots,
    };
  } catch {
    return null;
  }
}

function newLineId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FullPricingPlanner({ venues }: { venues: Venue[] }) {
  // Hydrate from localStorage on the client only. Default state on SSR.
  const [hydrated, setHydrated] = useState(false);
  const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
  const [globalGuests, setGlobalGuests] = useState<number>(DEFAULT_GUESTS);
  const [linkGuests, setLinkGuests] = useState<boolean>(true);
  const [slots, setSlots] =
    useState<Record<EventSlotKey, SlotState>>(DEFAULT_SLOTS);

  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) {
      setCurrency(persisted.currency);
      setGlobalGuests(persisted.globalGuests);
      setLinkGuests(persisted.linkGuests);
      setSlots(persisted.slots);
    }
    setHydrated(true);
  }, []);

  // Persist on every state change (debounced via microtask).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currency, globalGuests, linkGuests, slots }),
      );
    } catch {
      /* localStorage full / disabled */
    }
  }, [hydrated, currency, globalGuests, linkGuests, slots]);

  // Static FX. The actual rate fluctuates; this is good enough for back-of-
  // envelope. If we ever want live rates, wire up a small endpoint.
  const fxEurUsd = Number(process.env.NEXT_PUBLIC_FX_EUR_USD ?? "1.08");
  const toDisplay = (eur: number) =>
    currency === "EUR" ? eur : eur * fxEurUsd;

  const updateSlot = (k: EventSlotKey, patch: Partial<SlotState>) => {
    setSlots((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  };

  const setGlobalGuestsAll = (n: number) => {
    setGlobalGuests(n);
    if (linkGuests) {
      setSlots((prev) => {
        const next = { ...prev };
        (Object.keys(next) as EventSlotKey[]).forEach((k) => {
          next[k] = { ...next[k], guests: n };
        });
        return next;
      });
    }
  };

  const addExtraLine = (k: EventSlotKey) => {
    setSlots((prev) => ({
      ...prev,
      [k]: {
        ...prev[k],
        extraLines: [
          ...prev[k].extraLines,
          { id: newLineId(), label: "", amount: 0 },
        ],
      },
    }));
  };

  const updateExtraLine = (
    k: EventSlotKey,
    lineId: string,
    patch: Partial<Pick<CustomLine, "label" | "amount">>,
  ) => {
    setSlots((prev) => ({
      ...prev,
      [k]: {
        ...prev[k],
        extraLines: prev[k].extraLines.map((l) =>
          l.id === lineId ? { ...l, ...patch } : l,
        ),
      },
    }));
  };

  const removeExtraLine = (k: EventSlotKey, lineId: string) => {
    setSlots((prev) => ({
      ...prev,
      [k]: {
        ...prev[k],
        extraLines: prev[k].extraLines.filter((l) => l.id !== lineId),
      },
    }));
  };

  // Per-event computation
  const eventTotals = useMemo(() => {
    const m = new Map<EventSlotKey, number>();
    for (const cfg of EVENT_SLOTS) {
      const s = slots[cfg.key];
      if (!s.enabled) {
        m.set(cfg.key, 0);
        continue;
      }
      const venue = venues.find((v) => v.id === s.venueId) ?? null;
      const seedHire = venue ? HIRE_FEES[venue.name]?.[s.day] ?? null : null;
      const hire = s.hireOverride ?? seedHire ?? 0;
      const perGuest = s.perGuestOverride ?? cfg.per_guest_eur;
      const cateringSubtotal = perGuest * s.guests;
      const extras = s.extraLines.reduce((acc, l) => acc + l.amount, 0);
      m.set(cfg.key, hire + cateringSubtotal + extras);
    }
    return m;
  }, [slots, venues]);

  const grandEur = Array.from(eventTotals.values()).reduce(
    (a, b) => a + b,
    0,
  );
  const vatEur = grandEur * 0.21;
  const grandWithVATEur = grandEur + vatEur;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* LEFT RAIL — controls */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Display currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as typeof currency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (Astha&apos;s quotes)</SelectItem>
                  <SelectItem value="USD">USD (~{fxEurUsd}× EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g">Guest count (all events)</Label>
              <Input
                id="g"
                inputMode="numeric"
                value={globalGuests}
                onChange={(e) =>
                  setGlobalGuestsAll(
                    Number(e.target.value.replace(/[^\d]/g, "") || 0),
                  )
                }
              />
              <input
                type="range"
                min={50}
                max={300}
                step={5}
                value={globalGuests}
                onChange={(e) => setGlobalGuestsAll(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={linkGuests}
                onChange={(e) => setLinkGuests(e.target.checked)}
              />
              Same guest count for every event
            </label>
            <div className="rounded-md border border-stone-200 bg-stone-50/50 p-3 text-[11px] text-stone-600">
              <strong className="font-medium text-stone-900">Tip:</strong> any
              number is editable — venue hire, per-guest rate, custom lines.
              Changes save automatically to your browser. Refresh-safe.
            </div>
          </CardContent>
        </Card>

        {/* Sticky grand total — always visible while scrolling */}
        <Card className="border-foreground/20">
          <CardHeader>
            <CardTitle className="font-serif">Combined total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold tabular-nums">
                {formatMoney(toDisplay(grandEur), currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>VAT (21%)</span>
              <span className="tabular-nums">
                {formatMoney(toDisplay(vatEur), currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t pt-2 text-base">
              <span className="font-medium">With VAT</span>
              <span className="font-bold tabular-nums">
                {formatMoney(toDisplay(grandWithVATEur), currency)}
              </span>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* RIGHT — event cards */}
      <div className="space-y-4">
        {EVENT_SLOTS.map((cfg) => {
          const s = slots[cfg.key];
          const compatible = venues.filter((v) =>
            (v.event_roles ?? []).some((r) =>
              cfg.matches.includes(r as EventRole),
            ),
          );
          const venue = venues.find((v) => v.id === s.venueId) ?? null;
          const hireRow = venue ? HIRE_FEES[venue.name] : null;
          const seedHire = hireRow?.[s.day] ?? null;
          const effectiveHire = s.hireOverride ?? seedHire ?? 0;
          const effectivePerGuest = s.perGuestOverride ?? cfg.per_guest_eur;
          const cateringSubtotal = effectivePerGuest * s.guests;
          const extrasSubtotal = s.extraLines.reduce(
            (acc, l) => acc + l.amount,
            0,
          );
          const eventTotal = effectiveHire + cateringSubtotal + extrasSubtotal;

          return (
            <Card key={cfg.key} className={s.enabled ? "" : "opacity-60"}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif">{cfg.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Compatible venues: {compatible.length}
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) =>
                        updateSlot(cfg.key, { enabled: e.target.checked })
                      }
                    />
                    Include
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Venue + day-of-week + per-event guest count */}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="grid gap-1.5 md:col-span-2">
                    <Label>Venue</Label>
                    <Select
                      value={s.venueId ?? "none"}
                      onValueChange={(v) =>
                        updateSlot(cfg.key, {
                          venueId: v === "none" ? null : v,
                          // Clear hire override when venue changes — new
                          // venue, new seed default
                          hireOverride: null,
                        })
                      }
                      disabled={!s.enabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a venue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— not picked —</SelectItem>
                        {compatible.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name} · cap {v.capacity_min ?? "?"}–
                            {v.capacity_max ?? "?"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Day</Label>
                    <Select
                      value={s.day}
                      onValueChange={(v) =>
                        updateSlot(cfg.key, {
                          day: v as DayOfWeek,
                          // Clear hire override on day change so seed
                          // updates correctly. User can re-edit if needed.
                          hireOverride: null,
                        })
                      }
                      disabled={!s.enabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekend">Weekend</SelectItem>
                        <SelectItem value="weekday">Weekday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!linkGuests && (
                  <div className="grid gap-1.5">
                    <Label>Guests for this event</Label>
                    <Input
                      inputMode="numeric"
                      value={s.guests}
                      onChange={(e) =>
                        updateSlot(cfg.key, {
                          guests: Number(
                            e.target.value.replace(/[^\d]/g, "") || 0,
                          ),
                        })
                      }
                      disabled={!s.enabled}
                    />
                  </div>
                )}

                {/* Editable line items */}
                {s.enabled && (
                  <div className="space-y-2 rounded-md border bg-secondary/40 p-3 text-sm">
                    {/* Venue hire row (editable) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex-1">
                        Venue hire
                        {venue && (
                          <>
                            {" · "}
                            <Link
                              href={`/venues/${venue.id}`}
                              className="hover:underline"
                            >
                              {venue.name}
                            </Link>{" "}
                            <span className="text-xs text-muted-foreground">
                              ({s.day})
                            </span>
                          </>
                        )}
                      </span>
                      <NumberInputWithReset
                        value={effectiveHire}
                        seed={seedHire}
                        currency={currency}
                        toDisplay={toDisplay}
                        onChange={(eur) =>
                          updateSlot(cfg.key, { hireOverride: eur })
                        }
                        onReset={() =>
                          updateSlot(cfg.key, { hireOverride: null })
                        }
                        placeholder={!venue ? "Pick a venue" : undefined}
                        disabled={!venue}
                      />
                    </div>
                    {hireRow?.note && (
                      <p className="text-xs italic text-muted-foreground">
                        {hireRow.note}
                      </p>
                    )}

                    {/* Per-guest catering row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex-1">
                        {cfg.per_guest_label} ·{" "}
                        <span className="text-xs text-muted-foreground">
                          {s.guests} guests ×
                        </span>
                      </span>
                      <NumberInputWithReset
                        value={effectivePerGuest}
                        seed={cfg.per_guest_eur}
                        currency={currency}
                        toDisplay={toDisplay}
                        onChange={(eur) =>
                          updateSlot(cfg.key, { perGuestOverride: eur })
                        }
                        onReset={() =>
                          updateSlot(cfg.key, { perGuestOverride: null })
                        }
                        small
                      />
                      <span className="ml-2 w-28 text-right font-medium tabular-nums">
                        ={" "}
                        {formatMoney(
                          toDisplay(cateringSubtotal),
                          currency,
                        )}
                      </span>
                    </div>

                    {/* Custom lines */}
                    {s.extraLines.map((line) => (
                      <div
                        key={line.id}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Input
                          placeholder="e.g. Floral allowance"
                          value={line.label}
                          onChange={(e) =>
                            updateExtraLine(cfg.key, line.id, {
                              label: e.target.value,
                            })
                          }
                          className="h-9 flex-1"
                        />
                        <NumberInputWithReset
                          value={line.amount}
                          seed={null}
                          currency={currency}
                          toDisplay={toDisplay}
                          onChange={(eur) =>
                            updateExtraLine(cfg.key, line.id, { amount: eur })
                          }
                          onReset={undefined}
                        />
                        <button
                          type="button"
                          onClick={() => removeExtraLine(cfg.key, line.id)}
                          className="text-stone-400 hover:text-rose-700"
                          aria-label="Remove line"
                          title="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addExtraLine(cfg.key)}
                        className="text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add line item
                      </Button>
                    </div>

                    {/* Subtotal */}
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Event subtotal</span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(toDisplay(eventTotal), currency)}
                      </span>
                    </div>
                  </div>
                )}

                {s.enabled && venue && (
                  <div className="flex flex-wrap gap-1">
                    {(venue.event_roles ?? []).map((r) => (
                      <Badge
                        key={r}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {EVENT_ROLE_SHORT[r as EventRole]}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Astha&apos;s seeded hire fees + per-guest rates load by default.
          Click any number to override — your edits stay in your browser. Add
          custom line items per event for floral allowance, sound + light,
          stationery, photography, or anything else.
        </p>
      </div>
    </div>
  );
}

// ─── Editable number input that knows about a "seed" default and shows
//     a "(reset)" affordance when the user has overridden it. ─────────
function NumberInputWithReset({
  value,
  seed,
  currency,
  toDisplay,
  onChange,
  onReset,
  placeholder,
  disabled,
  small,
}: {
  value: number;
  seed: number | null;
  currency: "EUR" | "USD";
  toDisplay: (eur: number) => number;
  onChange: (eur: number) => void;
  onReset?: () => void;
  placeholder?: string;
  disabled?: boolean;
  small?: boolean;
}) {
  const symbol = currency === "EUR" ? "€" : "$";
  const display = toDisplay(value);
  const [draft, setDraft] = useState<string>(
    Number.isFinite(display) ? String(Math.round(display)) : "",
  );

  // Keep the draft in sync when the resolved value changes (seed updates,
  // currency toggle, etc). Avoid stomping the user's in-progress input
  // mid-edit.
  useEffect(() => {
    setDraft(
      Number.isFinite(display) ? String(Math.round(display)) : "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(display)]);

  const overridden = seed != null && Math.round(value) !== Math.round(seed);

  function commit() {
    const cleaned = draft.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0) return;
    // Convert back to EUR for storage. EUR currency = identity; USD ÷ FX.
    const fx =
      currency === "EUR"
        ? 1
        : Number(process.env.NEXT_PUBLIC_FX_EUR_USD ?? "1.08");
    onChange(currency === "EUR" ? n : n / fx);
  }

  return (
    <div
      className={`flex items-center gap-1 ${small ? "" : "min-w-[8rem]"} ${disabled ? "opacity-60" : ""}`}
    >
      <span className="text-xs text-muted-foreground">{symbol}</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(Math.round(display)));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`w-${small ? "20" : "24"} rounded border border-stone-300 bg-white px-2 py-1 text-right text-sm tabular-nums focus:border-stone-900 focus:outline-none disabled:bg-stone-100`}
      />
      {overridden && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] uppercase tracking-wider text-stone-500 hover:text-stone-900"
          title={`Reset to seed (${formatMoney(toDisplay(seed!), currency)})`}
        >
          reset
        </button>
      )}
    </div>
  );
}
