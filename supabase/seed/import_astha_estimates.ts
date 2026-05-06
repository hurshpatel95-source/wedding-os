// Estimator seed — hardcodes Astia's two "Estimated Initial Budget" PDFs
// (06.05.2026) into the budget_estimates table as two scenarios.
//
//   • Scenario A — Casa Del Mar (Sat Sept 11 Sangeet) + MSL ("Sant Esteve",
//     Sun Sept 12 Hindu Ceremony + Reception). Total €222,685.80.
//   • Scenario B — Casa Del Mar (Sun Sept 5 Sangeet) + Xalet del Nin
//     (Mon Sept 6 Hindu Ceremony + Reception). Total €229,725.80.
//
// Idempotent on (workspace_id, source_label, name).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/db/src/types.gen";
import type {
  EstimateDocument,
  EstimateLine,
  EstimateSection,
} from "../../apps/web/lib/estimator-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

const sb = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const SOURCE_LABEL = "Astia Estimated Initial Budget · 06.05.2026";

// ─── shared "miscellaneous" section (identical across both PDFs) ────────

function miscSection(prefix: string): EstimateSection {
  const lines: EstimateLine[] = [
    {
      id: `${prefix}-misc-dj`,
      label: "DJ for all events",
      unit_label: "flat",
      unit: "flat",
      astha_eur: 4500,
      override_eur: null,
      included: true,
      evidence: { quote: "DJ for all events @ 4,500.00", page: 4 },
    },
    {
      id: `${prefix}-misc-bridal-mehendi`,
      label: "Bridal mehendi",
      unit_label: "flat",
      unit: "flat",
      astha_eur: 550,
      override_eur: null,
      included: true,
      evidence: { quote: "Bridal Mehendi @ 550.00", page: 4 },
    },
    {
      id: `${prefix}-misc-family-mehendi`,
      label: "Family mehendi",
      unit_label: "€100/person × 5",
      unit: "per_person",
      qty: 5,
      unit_price_eur: 100,
      astha_eur: 500,
      override_eur: null,
      included: true,
      evidence: { quote: "Family mehendi @ €100 per person, allow for 5 people", page: 4 },
    },
    {
      id: `${prefix}-misc-bridal-hmu`,
      label: "Bridal hair & makeup (2 looks)",
      unit_label: "2 looks",
      unit: "per_look",
      qty: 2,
      astha_eur: 2500,
      override_eur: null,
      included: true,
      evidence: { quote: "Birdal hair & make-up @ allow for 2 looks", page: 4 },
    },
    {
      id: `${prefix}-misc-family-hmu`,
      label: "Family hair & makeup",
      unit_label: "€180/look × 2 looks × 5 people",
      unit: "per_look",
      qty: 10,
      unit_price_eur: 180,
      astha_eur: 1800,
      override_eur: null,
      included: true,
      evidence: {
        quote: "Family members hair & make-up @ €180 per look, allow 2 looks for 5 people",
        page: 4,
      },
    },
    {
      id: `${prefix}-misc-photo-video`,
      label: "Photographer & videographer (all events)",
      unit_label: "flat",
      unit: "flat",
      astha_eur: 10500,
      override_eur: null,
      included: true,
      evidence: { quote: "Photographer & videographer for all events @ 10,500.00", page: 4 },
    },
    {
      id: `${prefix}-misc-guest-transport`,
      label: "Guest transportation (both events)",
      unit_label: "flat",
      unit: "flat",
      astha_eur: 7000,
      override_eur: null,
      included: true,
      evidence: { quote: "Guest transportation for both events @ allow", page: 4 },
    },
    {
      id: `${prefix}-misc-family-transport`,
      label: "Bride, groom & direct family transport",
      unit_label: "flat",
      unit: "flat",
      astha_eur: 2800,
      override_eur: null,
      included: true,
      evidence: {
        quote: "Bride, groom & direct family transportation for both events @ allow",
        page: 4,
      },
    },
    {
      id: `${prefix}-misc-team-flights`,
      label: "Flights — planners + priest + DJ",
      unit_label: "€300/person × 6",
      unit: "per_person",
      qty: 6,
      unit_price_eur: 300,
      astha_eur: 1800,
      override_eur: null,
      included: true,
      evidence: { quote: "Flights for planners, priest and DJ @ €300 per person, allow 6", page: 4 },
    },
    {
      id: `${prefix}-misc-team-accom`,
      label: "Accommodation — DJ & priest",
      unit_label: "€190/night × 3 nights",
      unit: "per_night",
      qty: 3,
      unit_price_eur: 190,
      astha_eur: 1140,
      override_eur: null,
      included: true,
      evidence: { quote: "Accommodation for DJ & priest @ €190.00 per night, allow 3 nights", page: 4 },
    },
  ];
  return {
    id: `${prefix}-miscellaneous`,
    label: "Cross-event miscellaneous",
    subtitle: "Vendors and logistics that span both days",
    lines,
    notes: "Planner accommodation is FOC (free of charge).",
  };
}

function planneFeeSection(prefix: string): EstimateSection {
  return {
    id: `${prefix}-planner-fee`,
    label: "Planner fee",
    subtitle: "Astia Events agency fee",
    lines: [
      {
        id: `${prefix}-planner-fee-line`,
        label: "Astia Events agency fee",
        unit_label: "flat",
        unit: "flat",
        astha_eur: 14640,
        override_eur: null,
        included: true,
        evidence: { quote: "Astia Events Agency fee @ 14,640.00", page: 5 },
      },
    ],
  };
}

// ─── Scenario A — Casa + MSL (Sat Sept 11 + Sun Sept 12) ───────────────

function scenarioA(): EstimateDocument {
  const sangeet: EstimateSection = {
    id: "A-sangeet",
    label: "Casa Del Mar — Welcome / Sangeet",
    subtitle: "Saturday Sept 11, 2027 · 220 guests",
    guest_count: 220,
    date_label: "Sat Sept 11, 2027",
    lines: [
      {
        id: "A-cdm-hire",
        label: "Casa Del Mar exclusive hire",
        unit_label: "flat (Sat)",
        unit: "flat",
        astha_eur: 13915,
        override_eur: null,
        included: true,
        evidence: { quote: "Exclusive hire of Casa Del Mar is based on a fee of @ 13,915.00", page: 2 },
      },
      {
        id: "A-cdm-siae",
        label: "SIAE (DJ permission)",
        unit_label: "flat",
        astha_eur: 350,
        override_eur: null,
        included: true,
        evidence: { quote: "SIAE for the DJ @ 350.00", page: 2 },
      },
      {
        id: "A-cdm-fnb",
        label: "F&B — buffet, open bar 5h30, staff",
        unit_label: "€180/pp × 220",
        unit: "per_guest",
        qty: 220,
        unit_price_eur: 180,
        astha_eur: 36000,
        override_eur: null,
        included: true,
        evidence: { quote: "Total for 220 guests @ 36,000.00", page: 2 },
      },
      {
        id: "A-cdm-cleaning",
        label: "Cleaning + staff meal",
        unit_label: "flat",
        astha_eur: 400,
        override_eur: null,
        included: true,
        evidence: { quote: "Miscellaneous such cleaning, staff meal @ 400.00", page: 2 },
      },
      {
        id: "A-cdm-sgae",
        label: "SGAE (local permission fee)",
        unit_label: "flat",
        astha_eur: 278,
        override_eur: null,
        included: true,
        evidence: { quote: "SGAE (Local permission fee) @ 278.00", page: 2 },
      },
      {
        id: "A-cdm-vat",
        label: "VAT (10%)",
        unit_label: "10% F&B",
        astha_eur: 3667.8,
        override_eur: null,
        included: true,
        evidence: { quote: "10% Vat @ 3,667.80", page: 2 },
      },
      {
        id: "A-cdm-floral",
        label: "Floral decoration allowance",
        unit_label: "allow",
        astha_eur: 4000,
        override_eur: null,
        included: true,
        evidence: { quote: "Floral decoration allowance @ 4,000.00", page: 2 },
      },
      {
        id: "A-cdm-sound-light",
        label: "Sound & light allowance",
        unit_label: "allow",
        astha_eur: 6000,
        override_eur: null,
        included: true,
        evidence: { quote: "Sound and light allowance @ 6,000.00", page: 2 },
      },
      {
        id: "A-cdm-stage",
        label: "Stage & dancefloor",
        unit_label: "TBC",
        astha_eur: 0,
        override_eur: null,
        included: false,
        tbc: true,
        evidence: { quote: "Stage and Dancefloor @ (subject to final requirements) TBC", page: 2 },
      },
      {
        id: "A-cdm-djbooth",
        label: "DJ booth",
        unit_label: "flat",
        astha_eur: 350,
        override_eur: null,
        included: true,
        evidence: { quote: "DJ booth @ 350.00", page: 2 },
      },
      {
        id: "A-cdm-cart",
        label: "Indian accessory cart",
        unit_label: "flat",
        astha_eur: 800,
        override_eur: null,
        included: true,
        evidence: { quote: "Indian Accessory cart @ 800.00", page: 2 },
      },
      {
        id: "A-cdm-lounge",
        label: "Additional lounge furniture",
        unit_label: "allow",
        astha_eur: 3500,
        override_eur: null,
        included: true,
        evidence: { quote: "Additional lounge furntiure @ allow 3,500.00", page: 2 },
      },
      {
        id: "A-cdm-stationery",
        label: "Stationery",
        unit_label: "flat",
        astha_eur: 300,
        override_eur: null,
        included: true,
        evidence: { quote: "Stationery @ 300.00", page: 2 },
      },
      {
        id: "A-cdm-mehendi-artists",
        label: "Mehendi artists for guests",
        unit_label: "€110/hr × 2 artists × 3h",
        unit: "per_hour",
        qty: 6,
        unit_price_eur: 110,
        astha_eur: 660,
        override_eur: null,
        included: true,
        evidence: {
          quote: "Mehendi artsits for guests @ €110.00 per hour, per artist, allow 2 for 3h",
          page: 2,
        },
      },
    ],
    notes: "All costs estimated and subject to final requirements. Costs include VAT unless stated.",
  };

  const wedding: EstimateSection = {
    id: "A-wedding",
    label: "MSL (Mas de Sant Llei) — Hindu Ceremony + Reception",
    subtitle: "Sunday Sept 12, 2027 · 220 guests · venue listed as \"Sant Esteve\" by Astha",
    guest_count: 220,
    date_label: "Sun Sept 12, 2027",
    lines: [
      {
        id: "A-msl-hire",
        label: "MSL venue hire (Sun)",
        unit_label: "flat",
        astha_eur: 9000,
        override_eur: null,
        included: true,
        evidence: { quote: "Venue hire @ 9,000.00", page: 3 },
      },
      {
        id: "A-msl-sgae",
        label: "SGAE",
        unit_label: "flat",
        astha_eur: 350,
        override_eur: null,
        included: true,
        evidence: { quote: "SGAE @ 350.00", page: 3 },
      },
      {
        id: "A-msl-vat-hire",
        label: "VAT on venue hire (Astha quoted 22%)",
        unit_label: "22% (note: Spanish IVA is 21%)",
        astha_eur: 1980,
        override_eur: null,
        included: true,
        evidence: { quote: "VAT @ 22% 1,980.00", page: 3 },
        notes: "Astha quoted 22% — actual Spanish IVA on venue hire is 21%. Override if needed.",
      },
      {
        id: "A-msl-catering",
        label: "Catering — sharing menu (3h bar, cocktail, wine, transport)",
        unit_label: "€220/pp × 220",
        unit: "per_guest",
        qty: 220,
        unit_price_eur: 220,
        astha_eur: 48400,
        override_eur: null,
        included: true,
        evidence: { quote: "Priced @ allow €220.00 per person 48,400.00", page: 3 },
      },
      {
        id: "A-msl-cake",
        label: "Wedding cake",
        unit_label: "flat",
        astha_eur: 650,
        override_eur: null,
        included: true,
        evidence: { quote: "Wedding cake @ 650.00", page: 3 },
      },
      {
        id: "A-msl-vat-fnb",
        label: "VAT on F&B (10%)",
        unit_label: "10%",
        astha_eur: 4905,
        override_eur: null,
        included: true,
        evidence: { quote: "VAT @ 10% 4,905.00", page: 3 },
      },
      {
        id: "A-msl-mandap",
        label: "Mandap",
        unit_label: "flat",
        astha_eur: 3500,
        override_eur: null,
        included: true,
        evidence: { quote: "Mandap @ 3,500.00", page: 3 },
      },
      {
        id: "A-msl-sound-light",
        label: "Sound & light (ceremony, dinner, after-party)",
        unit_label: "allow",
        astha_eur: 9500,
        override_eur: null,
        included: true,
        evidence: {
          quote: "Sound and light covers ceremony area, diner area and after-party area @ allow 9,500.00",
          page: 3,
        },
      },
      {
        id: "A-msl-stage-df",
        label: "Stage, dancefloor & DJ booth",
        unit_label: "allow",
        astha_eur: 3000,
        override_eur: null,
        included: true,
        evidence: { quote: "Stage, dancefloor & DJ booth @ allow 3,000.00", page: 3 },
      },
      {
        id: "A-msl-floral",
        label: "Floral decoration (mandap, aisle, dining table, stage)",
        unit_label: "allow",
        astha_eur: 15000,
        override_eur: null,
        included: true,
        evidence: {
          quote: "Floral decoration to include mandap, aisle, dining table, stage @ allow 15,000.00",
          page: 3,
        },
      },
      {
        id: "A-msl-furniture",
        label: "Additional furniture",
        unit_label: "allow",
        astha_eur: 5000,
        override_eur: null,
        included: true,
        evidence: { quote: "Additional furniture @ allow 5,000.00", page: 3 },
      },
      {
        id: "A-msl-band",
        label: "Music band (optional)",
        unit_label: "optional",
        astha_eur: 4000,
        override_eur: null,
        included: false,
        evidence: { quote: "Option of Music band @ (4,000.00)", page: 3 },
        notes: "Bracketed in Astha's PDF — NOT included in the printed total. Toggle on if you want it.",
      },
      {
        id: "A-msl-priest",
        label: "Priest from the UK",
        unit_label: "flat",
        astha_eur: 2100,
        override_eur: null,
        included: true,
        evidence: { quote: "Priest from the UK @ 2,100.00", page: 3 },
      },
      {
        id: "A-msl-stationery",
        label: "Stationery",
        unit_label: "flat",
        astha_eur: 900,
        override_eur: null,
        included: true,
        evidence: { quote: "Stationery @ 900.00", page: 3 },
      },
      {
        id: "A-msl-dhol",
        label: "Dhol player",
        unit_label: "flat",
        astha_eur: 450,
        override_eur: null,
        included: true,
        evidence: { quote: "Dhol player @ 450.00", page: 3 },
      },
    ],
  };

  return {
    version: 1,
    sections: [sangeet, wedding, miscSection("A"), planneFeeSection("A")],
  };
}

// ─── Scenario B — Casa + Xalet (Sun Sept 5 + Mon Sept 6) ────────────────

function scenarioB(): EstimateDocument {
  const sangeet: EstimateSection = {
    id: "B-sangeet",
    label: "Casa Del Mar — Welcome / Sangeet",
    subtitle: "Sunday Sept 5, 2027 · 220 guests",
    guest_count: 220,
    date_label: "Sun Sept 5, 2027",
    lines: [
      {
        id: "B-cdm-hire",
        label: "Casa Del Mar exclusive hire",
        unit_label: "flat (Sun)",
        astha_eur: 12100,
        override_eur: null,
        included: true,
        evidence: { quote: "Exclusive hire of Casa Del Mar is based on a fee of @ 12,100.00", page: 2 },
        notes: "Sunday rate (€1,815 cheaper than Saturday).",
      },
      {
        id: "B-cdm-siae",
        label: "SIAE (DJ permission)",
        unit_label: "flat",
        astha_eur: 350,
        override_eur: null,
        included: true,
        evidence: { quote: "SIAE for the DJ @ 350.00", page: 2 },
      },
      {
        id: "B-cdm-fnb",
        label: "F&B — buffet, open bar 5h30, staff",
        unit_label: "€180/pp × 220",
        unit: "per_guest",
        qty: 220,
        unit_price_eur: 180,
        astha_eur: 36000,
        override_eur: null,
        included: true,
        evidence: { quote: "Total for 220 guests @ 36,000.00", page: 2 },
      },
      {
        id: "B-cdm-cleaning",
        label: "Cleaning + staff meal",
        unit_label: "flat",
        astha_eur: 400,
        override_eur: null,
        included: true,
        evidence: { quote: "Miscellaneous such cleaning, staff meal @ 400.00", page: 2 },
      },
      {
        id: "B-cdm-sgae",
        label: "SGAE (local permission fee)",
        unit_label: "flat",
        astha_eur: 278,
        override_eur: null,
        included: true,
        evidence: { quote: "SGAE (Local permission fee) @ 278.00", page: 2 },
      },
      {
        id: "B-cdm-vat",
        label: "VAT (10%)",
        unit_label: "10% F&B",
        astha_eur: 3667.8,
        override_eur: null,
        included: true,
        evidence: { quote: "10% Vat @ 3,667.80", page: 2 },
      },
      {
        id: "B-cdm-floral",
        label: "Floral decoration allowance",
        unit_label: "allow",
        astha_eur: 4000,
        override_eur: null,
        included: true,
        evidence: { quote: "Floral decoration allowance @ 4,000.00", page: 2 },
      },
      {
        id: "B-cdm-sound-light",
        label: "Sound & light allowance",
        unit_label: "allow",
        astha_eur: 6000,
        override_eur: null,
        included: true,
        evidence: { quote: "Sound and light allowance @ 6,000.00", page: 2 },
      },
      {
        id: "B-cdm-stage",
        label: "Stage & dancefloor",
        unit_label: "TBC",
        astha_eur: 0,
        override_eur: null,
        included: false,
        tbc: true,
        evidence: { quote: "Stage and Dancefloor @ (subject to final requirements) TBC", page: 2 },
      },
      {
        id: "B-cdm-djbooth",
        label: "DJ booth",
        unit_label: "flat",
        astha_eur: 350,
        override_eur: null,
        included: true,
        evidence: { quote: "DJ booth @ 350.00", page: 2 },
      },
      {
        id: "B-cdm-cart",
        label: "Indian accessory cart",
        unit_label: "flat",
        astha_eur: 800,
        override_eur: null,
        included: true,
        evidence: { quote: "Indian Accessory cart @ 800.00", page: 2 },
      },
      {
        id: "B-cdm-lounge",
        label: "Additional lounge furniture",
        unit_label: "allow",
        astha_eur: 3500,
        override_eur: null,
        included: true,
        evidence: { quote: "Additional lounge furntiure @ allow 3,500.00", page: 2 },
      },
      {
        id: "B-cdm-stationery",
        label: "Stationery",
        unit_label: "flat",
        astha_eur: 300,
        override_eur: null,
        included: true,
        evidence: { quote: "Stationery @ 300.00", page: 2 },
      },
      {
        id: "B-cdm-mehendi-artists",
        label: "Mehendi artists for guests",
        unit_label: "€110/hr × 2 artists × 3h",
        unit: "per_hour",
        qty: 6,
        unit_price_eur: 110,
        astha_eur: 660,
        override_eur: null,
        included: true,
        evidence: {
          quote: "Mehendi artsits for guests @ €110.00 per hour, per artist, allow 2 for 3h",
          page: 2,
        },
      },
    ],
  };

  const wedding: EstimateSection = {
    id: "B-wedding",
    label: "Xalet del Nin — Hindu Ceremony + Reception",
    subtitle: "Monday Sept 6, 2027 · 220 guests",
    guest_count: 220,
    date_label: "Mon Sept 6, 2027",
    lines: [
      {
        id: "B-xalet-hire",
        label: "Xalet del Nin venue hire (Monday)",
        unit_label: "flat (Mon)",
        astha_eur: 18000,
        override_eur: null,
        included: true,
        evidence: { quote: "Venue hire on a Monday @ 18,000.00", page: 3 },
      },
      {
        id: "B-xalet-sgae",
        label: "SGAE",
        unit_label: "flat",
        astha_eur: 350,
        override_eur: null,
        included: true,
        evidence: { quote: "SGAE @ 350.00", page: 3 },
      },
      {
        id: "B-xalet-vat-hire",
        label: "VAT on venue hire (10%)",
        unit_label: "10%",
        astha_eur: 1835,
        override_eur: null,
        included: true,
        evidence: { quote: "VAT @ 10% 1,835.00", page: 3 },
      },
      {
        id: "B-xalet-catering",
        label: "Catering — sharing menu (3h bar, cocktail, wine, transport)",
        unit_label: "€220/pp × 220",
        unit: "per_guest",
        qty: 220,
        unit_price_eur: 220,
        astha_eur: 48400,
        override_eur: null,
        included: true,
        evidence: { quote: "Priced @ allow €220.00 per person 48,400.00", page: 3 },
      },
      {
        id: "B-xalet-cake",
        label: "Wedding cake",
        unit_label: "flat",
        astha_eur: 650,
        override_eur: null,
        included: true,
        evidence: { quote: "Wedding cake @ 650.00", page: 3 },
      },
      {
        id: "B-xalet-vat-fnb",
        label: "VAT on F&B (10%)",
        unit_label: "10%",
        astha_eur: 4905,
        override_eur: null,
        included: true,
        evidence: { quote: "VAT @ 10% 4,905.00", page: 3 },
      },
      {
        id: "B-xalet-mandap",
        label: "Mandap",
        unit_label: "flat",
        astha_eur: 3500,
        override_eur: null,
        included: true,
        evidence: { quote: "Mandap @ 3,500.00", page: 3 },
      },
      {
        id: "B-xalet-sound-light",
        label: "Sound & light (ceremony, dinner, after-party)",
        unit_label: "allow",
        astha_eur: 9500,
        override_eur: null,
        included: true,
        evidence: {
          quote: "Sound and light covers ceremony area, diner area and after-party area @ allow 9,500.00",
          page: 3,
        },
      },
      {
        id: "B-xalet-stage-df",
        label: "Stage, dancefloor & DJ booth",
        unit_label: "allow",
        astha_eur: 3000,
        override_eur: null,
        included: true,
        evidence: { quote: "Stage, dancefloor & DJ booth @ allow 3,000.00", page: 3 },
      },
      {
        id: "B-xalet-floral",
        label: "Floral decoration (mandap, aisle, dining table, stage)",
        unit_label: "allow",
        astha_eur: 15000,
        override_eur: null,
        included: true,
        evidence: {
          quote: "Floral decoration to include mandap, aisle, dining table, stage @ allow 15,000.00",
          page: 3,
        },
      },
      {
        id: "B-xalet-furniture",
        label: "Additional furniture",
        unit_label: "allow",
        astha_eur: 5000,
        override_eur: null,
        included: true,
        evidence: { quote: "Additional furniture @ allow 5,000.00", page: 3 },
      },
      {
        id: "B-xalet-band",
        label: "Music band (optional)",
        unit_label: "optional",
        astha_eur: 4000,
        override_eur: null,
        included: false,
        evidence: { quote: "Option of Music band @ (4,000.00)", page: 3 },
        notes: "Bracketed in Astha's PDF — NOT included in the printed total. Toggle on if you want it.",
      },
      {
        id: "B-xalet-priest",
        label: "Priest from the UK",
        unit_label: "flat",
        astha_eur: 2100,
        override_eur: null,
        included: true,
        evidence: { quote: "Priest from the UK @ 2,100.00", page: 3 },
      },
      {
        id: "B-xalet-stationery",
        label: "Stationery",
        unit_label: "flat",
        astha_eur: 900,
        override_eur: null,
        included: true,
        evidence: { quote: "Stationery @ 900.00", page: 3 },
      },
      {
        id: "B-xalet-dhol",
        label: "Dhol player",
        unit_label: "flat",
        astha_eur: 450,
        override_eur: null,
        included: true,
        evidence: { quote: "Dhol player @ 450.00", page: 3 },
      },
    ],
  };

  return {
    version: 1,
    sections: [sangeet, wedding, miscSection("B"), planneFeeSection("B")],
  };
}

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace; run pnpm db:seed first");

  const estimates = [
    {
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      name: "Casa Del Mar + MSL",
      source_label: SOURCE_LABEL,
      scenario_summary: "Sat Sept 11 Sangeet @ Casa Del Mar + Sun Sept 12 Wedding @ MSL · 220 guests",
      cover_emoji: "🌊",
      guest_count: 220,
      start_date: "2027-09-11",
      end_date: "2027-09-12",
      sections: scenarioA() as unknown,
      baseline_total_eur: 222685.8,
      sort_order: 1,
    },
    {
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      name: "Casa Del Mar + Xalet del Nin",
      source_label: SOURCE_LABEL,
      scenario_summary: "Sun Sept 5 Sangeet @ Casa Del Mar + Mon Sept 6 Wedding @ Xalet · 220 guests",
      cover_emoji: "🏔️",
      guest_count: 220,
      start_date: "2027-09-05",
      end_date: "2027-09-06",
      sections: scenarioB() as unknown,
      baseline_total_eur: 229725.8,
      sort_order: 2,
    },
  ] as const;

  for (const est of estimates) {
    // idempotent upsert by (workspace_id, name, source_label)
    const { data: existing } = await sb
      .from("budget_estimates")
      .select("id")
      .eq("workspace_id", est.workspace_id)
      .eq("name", est.name)
      .eq("source_label", est.source_label)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .from("budget_estimates")
        .update({
          scenario_summary: est.scenario_summary,
          cover_emoji: est.cover_emoji,
          guest_count: est.guest_count,
          start_date: est.start_date,
          end_date: est.end_date,
          sections: est.sections as never,
          baseline_total_eur: est.baseline_total_eur,
          sort_order: est.sort_order,
        })
        .eq("id", existing.id);
      if (error) throw error;
      console.log(`✓ updated: ${est.name}`);
    } else {
      const { error } = await sb.from("budget_estimates").insert({
        org_id: est.org_id,
        workspace_id: est.workspace_id,
        name: est.name,
        source_label: est.source_label,
        scenario_summary: est.scenario_summary,
        cover_emoji: est.cover_emoji,
        guest_count: est.guest_count,
        start_date: est.start_date,
        end_date: est.end_date,
        sections: est.sections as never,
        baseline_total_eur: est.baseline_total_eur,
        sort_order: est.sort_order,
      });
      if (error) throw error;
      console.log(`✓ inserted: ${est.name}`);
    }
  }

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
