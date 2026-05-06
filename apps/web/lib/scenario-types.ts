// Rich scenario shape — stored as JSONB in pricing_scenarios.inputs.
// Mirrors Hursh's Excel: 3 events × hire+catering+shortfall, room block, custom lines, VAT split.

export type DayKind = "weekend" | "weekday" | "sunday";

export interface SpaceSelection {
  label: string;
  price_eur: number;
  selected: boolean;
}

export interface EventSlot {
  key: "welcome" | "sangeet" | "wedding";
  label: string;
  enabled: boolean;
  date?: string | null;
  venue_id: string | null;
  day: DayKind;
  // For composite-priced venues like Mas de Sant Llei, planner can toggle individual spaces.
  // If undefined, the venue's flat hire fee is used.
  spaces?: SpaceSelection[];
  // Override of hire fee (admin can edit ad hoc); if null we look up from VENUE_HIRE.
  hire_override_eur?: number | null;
  // Catering per-pax + label. Defaults set by event type but planner can override.
  catering_per_pax_eur: number;
  catering_label: string;
  // Per-event guest count — defaults to scenario.guest_count if linked.
  guests: number;
  notes?: string;
}

export interface RoomBlock {
  enabled: boolean;
  hotel_venue_id: string | null;
  rooms: number;
  nights: number;
  online_rate_eur: number;
  discount_pct: number; // 0.20 = 20% off
}

export interface CustomLine {
  id: string;
  category: string; // 'transport' | 'decor' | 'photo' | 'video' | 'mua' | 'mehndi' | 'priest' | 'sound' | 'lounge' | 'stationery' | 'other'
  label: string;
  qty: number;
  unit_price_eur: number;
  vat_rate: number; // 0.21 venue / 0.10 F&B+accom / 0
  notes?: string;
}

export interface ScenarioInputs {
  version: 1;
  description: string;
  date_range: { from: string; to: string };
  guest_count: number;
  link_guest_count: boolean; // when true, all events use scenario.guest_count
  events: EventSlot[];
  room_block: RoomBlock | null;
  custom_lines: CustomLine[];
  open_items: string[];
}

export interface CalcEventLine {
  key: EventSlot["key"];
  label: string;
  venue_name: string | null;
  day: DayKind;
  hire_eur: number;
  hire_note?: string;
  catering_subtotal_eur: number;
  shortfall_eur: number;
  shortfall_note?: string;
  net_eur: number; // hire + catering + shortfall
}

export interface VendorRollup {
  count: number;
  net_eur: number;
  vat_eur: number;
}

export interface CalcResult {
  events: CalcEventLine[];
  custom_lines_net_eur: number;
  custom_lines_vat_eur: number;
  vendors_net_eur: number;
  vendors_vat_eur: number;
  vendors_count: number;
  room_block_net_eur: number;
  room_block_vat_eur: number;
  // VAT applied per category at the right Spanish IVA rate
  venue_net_eur: number; // hire only
  catering_net_eur: number; // catering + MSL shortfall (treated as F&B)
  venue_vat_eur: number; // 21%
  catering_vat_eur: number; // 10%
  // Hosts' direct cost (excl. accommodation)
  hosts_net_eur: number;
  hosts_vat_eur: number;
  hosts_grand_eur: number;
  // Accommodation is informational (guests pay)
  accommodation_net_eur: number;
  accommodation_vat_eur: number;
  accommodation_grand_eur: number;
  // Combined (for an everything-in number)
  combined_grand_eur: number;
}

export const VAT_RATES = {
  venue: 0.21, // Spanish IVA standard
  catering: 0.1, // reduced rate hospitality
  accommodation: 0.1,
} as const;
