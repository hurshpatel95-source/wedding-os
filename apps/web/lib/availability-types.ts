// Shared types + labels for the venue availability calendar.

export type VenueDateStatus =
  | "available"
  | "tentative"
  | "held_by_us"
  | "booked_by_us"
  | "unavailable"
  | "unknown";

export const STATUS_OPTIONS: VenueDateStatus[] = [
  "available",
  "tentative",
  "held_by_us",
  "booked_by_us",
  "unavailable",
  "unknown",
];

export const STATUS_LABEL: Record<VenueDateStatus, string> = {
  available: "Available",
  tentative: "Tentative",
  held_by_us: "Held by us",
  booked_by_us: "Booked by us",
  unavailable: "Unavailable",
  unknown: "Unknown",
};

// Tailwind classes for the matrix cells. Tailwind needs full class names
// to be visible at build time, so we hard-code them here rather than
// composing from a base.
export const STATUS_CELL_CLASS: Record<VenueDateStatus, string> = {
  available: "bg-emerald-200 hover:bg-emerald-300 text-emerald-900",
  tentative: "bg-amber-200 hover:bg-amber-300 text-amber-900",
  held_by_us: "bg-rose-300 hover:bg-rose-400 text-rose-900",
  booked_by_us: "bg-rose-600 hover:bg-rose-700 text-white",
  unavailable: "bg-stone-300 hover:bg-stone-400 text-stone-700",
  unknown: "bg-stone-100 hover:bg-stone-200 text-stone-500",
};

// Solid color swatches for the legend (ignore hover/text overrides).
export const STATUS_SWATCH_CLASS: Record<VenueDateStatus, string> = {
  available: "bg-emerald-200",
  tentative: "bg-amber-200",
  held_by_us: "bg-rose-300",
  booked_by_us: "bg-rose-600",
  unavailable: "bg-stone-300",
  unknown: "bg-stone-100 border border-stone-200",
};

export interface VenueLite {
  id: string;
  name: string;
  status: string;
  is_lead_pick: boolean;
}

export interface VenueDateMark {
  id: string;
  venue_id: string;
  date: string; // ISO yyyy-mm-dd
  status: VenueDateStatus;
  notes: string | null;
  source: string | null;
}
