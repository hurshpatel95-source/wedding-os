// Pure calc engine for scenario inputs → totals.
// No I/O. Same shape used by the live calculator and any future PDF/email export.

import type {
  CalcResult,
  CalcEventLine,
  ScenarioInputs,
  EventSlot,
  RoomBlock,
  CustomLine,
  DayKind,
} from "./scenario-types";
import { VAT_RATES } from "./scenario-types";
import { VENUE_HIRE, type VenueHireProfile } from "./venue-pricing";

interface VenueLite {
  id: string;
  name: string;
  capacity_min: number | null;
  capacity_max: number | null;
  // Optional DB-stored hire-fee data — when present, takes priority over the
  // VENUE_HIRE constants. Lets admin edit a venue's pricing in-app.
  hire_fee_weekend_eur?: number | null;
  hire_fee_weekday_eur?: number | null;
  hire_fee_sunday_eur?: number | null;
  minimum_pax_weekend?: number | null;
  minimum_pax_sunday?: number | null;
  minimum_pax_weekday?: number | null;
  shortfall_per_pax_eur?: number | null;
  spaces?: { label: string; price_eur: number }[] | null;
  hire_fee_notes?: string | null;
}

// Build a hire-fee profile from either the DB venue row (preferred) or fall
// back to the constants in VENUE_HIRE for any field the DB doesn't have.
function profileFor(venue: VenueLite | null): VenueHireProfile | undefined {
  if (!venue) return undefined;
  const fallback = VENUE_HIRE[venue.name];
  return {
    weekend_eur: venue.hire_fee_weekend_eur ?? fallback?.weekend_eur ?? null,
    weekday_eur: venue.hire_fee_weekday_eur ?? fallback?.weekday_eur ?? null,
    sunday_eur: venue.hire_fee_sunday_eur ?? fallback?.sunday_eur ?? null,
    minimum_pax: venue.minimum_pax_weekend != null || venue.minimum_pax_sunday != null
      ? {
          weekend: venue.minimum_pax_weekend ?? 0,
          sunday: venue.minimum_pax_sunday ?? 0,
          weekday: venue.minimum_pax_weekday ?? undefined,
        }
      : fallback?.minimum_pax ?? null,
    shortfall_per_pax_eur:
      venue.shortfall_per_pax_eur ?? fallback?.shortfall_per_pax_eur ?? null,
    notes: venue.hire_fee_notes ?? fallback?.notes,
    extra_hour_eur: fallback?.extra_hour_eur ?? null,
    spaces: venue.spaces && venue.spaces.length > 0
      ? venue.spaces.map((s) => ({ ...s, default_selected: true }))
      : fallback?.spaces,
  };
}

interface VendorLite {
  id: string;
  quoted_price_eur: number | null;
  include_in_pricing: boolean;
}

export function calcScenario(
  inputs: ScenarioInputs,
  venuesById: Record<string, VenueLite>,
  vendors: VendorLite[] = [],
): CalcResult {
  const eventLines: CalcEventLine[] = [];
  let venueNet = 0;
  let cateringNet = 0;

  for (const ev of inputs.events) {
    if (!ev.enabled) continue;
    const venue = ev.venue_id ? venuesById[ev.venue_id] : null;
    const profile = profileFor(venue);
    const hire = computeHireForEvent(ev, profile);
    const guests = inputs.link_guest_count ? inputs.guest_count : ev.guests;
    const cateringSubtotal = ev.catering_per_pax_eur * guests;
    const shortfall = computeShortfall(ev, profile, guests);

    eventLines.push({
      key: ev.key,
      label: ev.label,
      venue_name: venue?.name ?? null,
      day: ev.day,
      hire_eur: hire.amount,
      hire_note: hire.note,
      catering_subtotal_eur: cateringSubtotal,
      shortfall_eur: shortfall.amount,
      shortfall_note: shortfall.note,
      net_eur: hire.amount + cateringSubtotal + shortfall.amount,
    });

    venueNet += hire.amount;
    cateringNet += cateringSubtotal + shortfall.amount; // shortfall taxed as F&B
  }

  // Custom lines — VAT applied per row at its own rate.
  let customNetTotal = 0;
  let customVatTotal = 0;
  for (const c of inputs.custom_lines) {
    const subtotal = c.qty * c.unit_price_eur;
    customNetTotal += subtotal;
    customVatTotal += subtotal * c.vat_rate;
  }

  // Room block — informational; guests pay
  const room = inputs.room_block;
  let accomNet = 0;
  let accomVat = 0;
  if (room?.enabled) {
    const discounted = room.online_rate_eur * (1 - room.discount_pct);
    accomNet = discounted * room.rooms * room.nights;
    accomVat = accomNet * VAT_RATES.accommodation;
  }

  // Vendors with quoted prices that are flagged for pricing rollup
  let vendorsNet = 0;
  let vendorsCount = 0;
  for (const v of vendors) {
    if (!v.include_in_pricing) continue;
    if (v.quoted_price_eur == null) continue;
    vendorsNet += Number(v.quoted_price_eur);
    vendorsCount++;
  }
  const vendorsVat = vendorsNet * VAT_RATES.venue; // 21% catch-all for vendor services in Spain

  const venueVat = venueNet * VAT_RATES.venue;
  const cateringVat = cateringNet * VAT_RATES.catering;

  const hostsNet = venueNet + cateringNet + customNetTotal + vendorsNet;
  const hostsVat = venueVat + cateringVat + customVatTotal + vendorsVat;
  const hostsGrand = hostsNet + hostsVat;

  const accomGrand = accomNet + accomVat;
  const combinedGrand = hostsGrand + accomGrand;

  return {
    events: eventLines,
    custom_lines_net_eur: customNetTotal,
    custom_lines_vat_eur: customVatTotal,
    vendors_net_eur: vendorsNet,
    vendors_vat_eur: vendorsVat,
    vendors_count: vendorsCount,
    room_block_net_eur: accomNet,
    room_block_vat_eur: accomVat,
    venue_net_eur: venueNet,
    catering_net_eur: cateringNet,
    venue_vat_eur: venueVat,
    catering_vat_eur: cateringVat,
    hosts_net_eur: hostsNet,
    hosts_vat_eur: hostsVat,
    hosts_grand_eur: hostsGrand,
    accommodation_net_eur: accomNet,
    accommodation_vat_eur: accomVat,
    accommodation_grand_eur: accomGrand,
    combined_grand_eur: combinedGrand,
  };
}

function computeHireForEvent(
  ev: EventSlot,
  profile: VenueHireProfile | undefined,
): { amount: number; note?: string } {
  // Override wins
  if (ev.hire_override_eur != null) {
    return { amount: ev.hire_override_eur, note: "Manual override" };
  }
  // Composite spaces (e.g. MSL) — sum selected
  if (ev.spaces && ev.spaces.length > 0) {
    const sum = ev.spaces.filter((s) => s.selected).reduce((a, s) => a + s.price_eur, 0);
    const count = ev.spaces.filter((s) => s.selected).length;
    return { amount: sum, note: `${count} of ${ev.spaces.length} spaces selected` };
  }
  // Backstop: venue HAS composite spaces but the event slot didn't seed any
  // — sum the venue's spaces (all assumed selected). This catches the case
  // where you pick MSL via the venue dropdown on a fresh scenario.
  if (profile?.spaces && profile.spaces.length > 0) {
    const sum = profile.spaces.reduce((a, s) => a + s.price_eur, 0);
    return {
      amount: sum,
      note: `Composite — all ${profile.spaces.length} spaces (whole venue)`,
    };
  }
  if (!profile) return { amount: 0, note: "No venue selected" };

  let amount: number | null | undefined = null;
  if (ev.day === "weekend") amount = profile.weekend_eur;
  else if (ev.day === "weekday") amount = profile.weekday_eur;
  else if (ev.day === "sunday") amount = profile.sunday_eur ?? profile.weekend_eur;

  if (amount == null) return { amount: 0, note: profile.notes ?? "Hire fee TBD" };
  return { amount, note: undefined };
}

function computeShortfall(
  ev: EventSlot,
  profile: VenueHireProfile | undefined,
  guests: number,
): { amount: number; note?: string } {
  if (!profile?.minimum_pax || !profile.shortfall_per_pax_eur) {
    return { amount: 0 };
  }
  const min = pickMinimum(profile.minimum_pax, ev.day);
  if (min == null) return { amount: 0 };
  const short = Math.max(0, min - guests);
  if (short === 0) {
    return { amount: 0, note: `Above ${min}-guest minimum for ${ev.day}` };
  }
  return {
    amount: short * profile.shortfall_per_pax_eur,
    note: `Shortfall: ${guests} below ${min}-guest minimum × €${profile.shortfall_per_pax_eur}/pax`,
  };
}

function pickMinimum(
  m: NonNullable<VenueHireProfile["minimum_pax"]>,
  day: DayKind,
): number | null {
  if (day === "weekend") return m.weekend;
  if (day === "sunday") return m.sunday;
  if (day === "weekday") return m.weekday ?? null;
  return null;
}

// Helper: build a default scenario with sensible Excel-mirroring defaults.
export function makeDefaultScenario(opts?: Partial<ScenarioInputs>): ScenarioInputs {
  return {
    version: 1,
    description: "",
    date_range: { from: "", to: "" },
    guest_count: 220,
    link_guest_count: true,
    events: [
      {
        key: "welcome",
        label: "Welcome / cocktail",
        enabled: false,
        venue_id: null,
        day: "weekend",
        catering_per_pax_eur: 60,
        catering_label: "Cocktail welcome menu",
        guests: 220,
      },
      {
        key: "sangeet",
        label: "Sangeet / pre-wedding",
        enabled: true,
        venue_id: null,
        day: "weekend",
        catering_per_pax_eur: 180,
        catering_label: "Sangeet menu (food + drink + service + tableware)",
        guests: 220,
      },
      {
        key: "wedding",
        label: "Wedding (ceremony + reception)",
        enabled: true,
        venue_id: null,
        day: "weekend",
        catering_per_pax_eur: 220,
        catering_label: "Wedding menu (food + drink + service + furniture)",
        guests: 220,
      },
    ],
    room_block: null,
    custom_lines: [],
    open_items: [],
    ...opts,
  };
}
