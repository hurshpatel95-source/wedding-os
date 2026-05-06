import type { Database } from "@wedding-os/db";

type PricingUnit = Database["public"]["Enums"]["pricing_unit"];
type PricingTier = Database["public"]["Enums"]["pricing_tier"];

export type { PricingUnit, PricingTier };

export type EventKey = "mehndi" | "sangeet" | "haldi" | "ceremony" | "reception";

export interface ScenarioInputs {
  guest_count: number;
  events_selected: EventKey[];
  dietary_mix: { veg: number; jain: number; halal: number };
  decor_tier: PricingTier;
  photo_tier: PricingTier;
  video_tier: PricingTier;
  music_tier: PricingTier;
  transport_included: boolean;
}

export interface PricingLineItem {
  id: string;
  category_id: string;
  category_label: string;
  label: string;
  unit: PricingUnit;
  default_unit_price: number;
  tier: PricingTier | null;
}

export interface VenueOverride {
  unit_price?: number;
  included?: boolean;
  notes?: string;
}

export type Overrides = Record<string, VenueOverride>;

export interface CalcLine {
  line_item_id: string;
  category_label: string;
  label: string;
  unit: PricingUnit;
  unit_price: number;
  quantity: number;
  subtotal: number;
  included: boolean;
  notes?: string;
}

export interface CalcResult {
  lines: CalcLine[];
  total: number;
  currency: string;
}

export function calculateScenario(
  lineItems: PricingLineItem[],
  overrides: Overrides,
  inputs: ScenarioInputs,
  currency: string,
): CalcResult {
  const lines: CalcLine[] = [];

  for (const li of lineItems) {
    const ov = overrides[li.id] ?? {};
    const included = ov.included ?? true;
    const unit_price = ov.unit_price ?? li.default_unit_price;

    if (!included) continue;

    if (li.tier) {
      const tier = tierForCategory(li.category_label, inputs);
      if (tier && li.tier !== tier) continue;
    }

    if (li.category_label.toLowerCase().includes("transport") && !inputs.transport_included) {
      continue;
    }

    const quantity = quantityForUnit(li.unit, inputs);
    const subtotal = unit_price * quantity;

    lines.push({
      line_item_id: li.id,
      category_label: li.category_label,
      label: li.label,
      unit: li.unit,
      unit_price,
      quantity,
      subtotal,
      included,
      notes: ov.notes,
    });
  }

  const total = lines.reduce((acc, l) => acc + l.subtotal, 0);
  return { lines, total, currency };
}

function quantityForUnit(unit: PricingUnit, inputs: ScenarioInputs): number {
  switch (unit) {
    case "per_guest":
      return inputs.guest_count;
    case "per_event":
      return inputs.events_selected.length;
    case "flat":
      return 1;
    case "per_hour":
    case "per_day":
      return 1;
  }
}

function tierForCategory(category: string, inputs: ScenarioInputs): PricingTier | null {
  const c = category.toLowerCase();
  if (c.includes("decor")) return inputs.decor_tier;
  if (c.includes("photo")) return inputs.photo_tier;
  if (c.includes("video")) return inputs.video_tier;
  if (c.includes("music") || c.includes("dj")) return inputs.music_tier;
  return null;
}

export function convertCurrency(amount: number, fromEUR: number = 1, fxEurUsd: number): number {
  return amount * fromEUR * fxEurUsd;
}
