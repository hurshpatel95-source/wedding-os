// Hardcoded venue hire fees + composite-space breakdowns + hotel rates,
// transcribed from Hursh's pricing spreadsheet (Nisha_Hursh_Wedding_Pricing12.xlsx)
// and Astha's Astia Events deck. Sprint 3 will move these into venue columns + override JSON.

export interface VenueHireProfile {
  weekend_eur?: number | null;
  weekday_eur?: number | null;
  sunday_eur?: number | null;
  notes?: string;
  // For composite-priced venues (e.g. Mas de Sant Llei): individual spaces.
  // Sum of `selected: true` rows replaces the flat hire fee.
  spaces?: { label: string; price_eur: number; default_selected: boolean }[];
  // MSL-style minimum-pax shortfall logic
  minimum_pax?: { weekend: number; sunday: number; weekday?: number } | null;
  shortfall_per_pax_eur?: number | null;
  // Optional extra-hour pricing
  extra_hour_eur?: number | null;
}

// keyed by venue.name (must match Supabase rows exactly)
export const VENUE_HIRE: Record<string, VenueHireProfile> = {
  "Casa Del Mar": {
    weekend_eur: 14000, // Sat per Astia deck
    weekday_eur: 12400, // Fri per Astia deck
    sunday_eur: 14000, // not separately quoted; default to Sat rate
    notes: "Bridal suite incl. to get ready. 12-guest takeover (€5k/night) is OFF per Hursh.",
  },
  "Xalet Del Nin": {
    weekend_eur: 22000,
    sunday_eur: 19000,
    weekday_eur: null,
    notes: "Sat €22k / Sun €19k. Friday rate not quoted.",
  },
  "Marina Port Vell": {
    weekend_eur: 6500,
    weekday_eur: 9500,
    notes: "Weekday is MORE expensive at this venue. Friday rate is unconfirmed.",
  },
  "Mas de Sant Llei": {
    notes: "Composite — sum of selected spaces. Full venue (all 4) = €11,500.",
    spaces: [
      { label: "Orange courtyard (ceremony)", price_eur: 2000, default_selected: true },
      { label: "Forest area (ceremony backup)", price_eur: 2500, default_selected: true },
      { label: "Courtyard in front of house (cocktail)", price_eur: 2500, default_selected: true },
      { label: "Indoor space + 2h dancing (dinner)", price_eur: 4500, default_selected: true },
    ],
    minimum_pax: { weekend: 280, sunday: 220 }, // weekend=Sat min 280, Sunday min 220
    shortfall_per_pax_eur: 80,
    extra_hour_eur: 1100,
  },
  "ME Sitges Terramar": {
    notes: "Stay venue. Rooftop event space available; no quote yet.",
    weekend_eur: null,
    weekday_eur: null,
  },
  "ME Barcelona": {
    weekend_eur: 5200,
    weekday_eur: 5200,
    notes: "Event space hire €5,200. Cocktail menus from €60/pp.",
  },
};

export interface HotelProfile {
  name: string;
  online_rate_eur: number;
  default_discount_pct: number; // 0.20 standard advance discount
  notes?: string;
}

export const HOTEL_PROFILES: Record<string, HotelProfile> = {
  "ME Sitges Terramar": {
    name: "ME Sitges Terramar",
    online_rate_eur: 436,
    default_discount_pct: 0.2,
    notes: "20% if 90+d, 15% if 89-15d, 10% if <14d. Breakfast included.",
  },
  "ME Barcelona": {
    name: "ME Barcelona",
    online_rate_eur: 408,
    default_discount_pct: 0.2,
    notes: "2026 ref rate — get 2027 quote. Tiered discount same scale.",
  },
};

// Default catering rates Astha quoted (per pax, EUR).
export const CATERING_DEFAULTS = {
  welcome: { per_pax_eur: 60, label: "Cocktail welcome menu" },
  sangeet: { per_pax_eur: 180, label: "Sangeet menu (food + drink + service + tableware)" },
  wedding: { per_pax_eur: 220, label: "Wedding menu (food + drink + service + furniture)" },
} as const;
