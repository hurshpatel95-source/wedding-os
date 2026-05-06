// Seed library_venues from Astia's "Nisha & Hursh — Venue Proposal V3" PDF.
// Adds 13 venues to the planner's library on top of the 6 already imported
// from the demo workspace. Text-only — photos can be added via the
// /admin/library/venues/[id] media manager (drop-folder upload) later
// since the PDF was 91MB and macOS Python 3.15 wheels for Pillow aren't
// available for byte-level image extraction.
//
// Idempotent — UPSERT keyed on (org_id, name).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface SeedVenue {
  name: string;
  city: string | null;
  region: string | null;
  country: string;
  capacity_seated: number | null;
  capacity_standing: number | null;
  hire_fee_eur: number | null;
  hire_fee_notes: string | null;
  event_roles: string[];
  description: string;
  internal_notes: string;
}

// Sourced from Astia's V3 venue proposal PDF (44 pages). Names in caps in
// the PDF have been normalized; key facts pulled from the price/dates/
// notes lines on each venue page.
const VENUES: SeedVenue[] = [
  {
    name: "Torre dels Lleons",
    city: "Esplugues de Llobregat",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: null,
    hire_fee_notes:
      "Exclusive hire based on F&B selection — menus average €180/person. Indian caterer permitted.",
    event_roles: ["welcome", "sangeet"],
    description:
      "19th-century Catalan farmhouse on the ruins of Castell de Picalqués, with its stately air and family coat of arms still visible at the door. Available on both requested dates.",
    internal_notes:
      "Sangeet venue · in the city · Indian-caterer-friendly. Hire price scales with food spend.",
  },
  {
    name: "La Baronia",
    city: "Sant Feliu de Codines",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: 8500,
    hire_fee_notes: "€8,500 + VAT. Welcome-party / Sangeet only.",
    event_roles: ["welcome", "sangeet"],
    description:
      "Surrounded by woods and views over Sant Feliu de Codines and the Vallès Oriental — on clear days the Mediterranean glares on the horizon. Baroque ballrooms, gardens for ceremonies, snacks and cocktails.",
    internal_notes:
      "Tight date window — only 15th & 19th September 2027. 15 min from Barcelona.",
  },
  {
    name: "Bel Reco",
    city: "Maresme",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: 9500,
    hire_fee_notes: "From €9,500 + VAT. Indian caterers permitted.",
    event_roles: ["wedding", "ceremony", "reception"],
    description:
      "Manor estate of the Catalan bourgeoisie, built 1940-1952. Polychrome sgraffito facades, three-tiered garden. Available both requested dates.",
    internal_notes: "30 min from Barcelona. Indian-caterer-friendly.",
  },
  {
    name: "Can Ramonet",
    city: "Sant Pere de Ribes",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: null,
    hire_fee_notes: "Pricing subject to availability.",
    event_roles: ["welcome", "wedding", "ceremony", "reception"],
    description:
      "Mediterranean rustic villa in the heart of Garraf Natural Park, near Sitges. Four buildings forming a small village with courtyards, vineyards, and 1+ hectare of landscaped land.",
    internal_notes:
      "Unavailable on Hursh+Nisha's chosen dates — can shift to nearby dates. 30 min from Barcelona.",
  },
  {
    name: "Masia Cabellut",
    city: "Vilafranca del Penedès",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: 200,
    capacity_standing: null,
    hire_fee_eur: 23000,
    hire_fee_notes:
      "€23,000 exclusive hire — INCLUDES a block of 2 nights and 3 days. Must use their catering company.",
    event_roles: ["welcome", "wedding", "ceremony", "reception"],
    description:
      "Rated 'best vineyard wedding venue' by bridal editors and wedding magazines worldwide. Up to 200 guests. Ceremony spots include the Cabellut gardens, almond-tree garden, the forest, the vineyard, and the cliffside Ermita de Santa Cristina chapel.",
    internal_notes:
      "Available all requested dates. 50 min from Barcelona. Sleep-on-site weekend format. Catering tied to in-house company.",
  },
  {
    name: "Eurostars Sitges",
    city: "Sitges",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: null,
    hire_fee_notes: "Room rates not yet available for 2027.",
    event_roles: ["stay", "wedding", "ceremony", "reception"],
    description:
      "5-star Mediterranean-sea wedding venue near Barcelona. Coastal charm + luxury resort comfort: panoramic sea views, landscaped gardens, terraces, indoor event spaces. 307 rooms.",
    internal_notes: "307 rooms — full hotel takeover possible. Awaiting 2027 rate sheet.",
  },
  {
    name: "Torre Melina Gran Melia",
    city: "Pedralbes, Barcelona",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: null,
    hire_fee_notes: "Awaiting response on rates + event spaces.",
    event_roles: ["stay", "wedding"],
    description:
      "Urban resort in elegant Pedralbes district. 25,000m² of centuries-old gardens, two outdoor pools, gym, SeaSkin Life Holistic Club with indoor pool. Erre de Urrechu and Beso Pedralbes restaurants.",
    internal_notes: "Hotel — pending rate confirmation from Astha.",
  },
  {
    name: "Hoxton Hotel Barcelona",
    city: "Poblenou, Barcelona",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: null,
    hire_fee_notes:
      "Room rate €315/night with breakfast. Event-space minimum spend €11,000 on F&B.",
    event_roles: ["stay", "welcome"],
    description:
      "Local-flavoured corner of Poblenou. 240 rooms, rooftop pool + taqueria, lobby, sunny pizza terrace + slice shop, multi-functional basement event space.",
    internal_notes:
      "240 rooms. €11k F&B minimum on event hire. Modern boutique vibe.",
  },
  {
    name: "ME Hotel Barcelona",
    city: "Passeig de Gràcia, Barcelona",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: 5200,
    hire_fee_notes:
      "Hire fee €5,200 + VAT, minimum spend €7,000 + VAT on F&B. Room rate ~€349/night with breakfast (20% off official site).",
    event_roles: ["stay", "wedding", "reception"],
    description:
      "Cultural epicenter on Passeig de Gràcia. 600m²+ of versatile event space, rooftop pool, spa, urban garden, two Mediterranean restaurants, cocktail bar.",
    internal_notes:
      "Note: a separate 'ME Sitges Terramar' venue exists in our workspace — this is the BARCELONA branch.",
  },
  {
    name: "W Hotel Barcelona",
    city: "Barceloneta, Barcelona",
    region: "Barcelona",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: null,
    hire_fee_notes: "Rates to be confirmed.",
    event_roles: ["stay", "wedding"],
    description:
      "Ricardo Bofill–designed luxury beachfront hotel on the Barceloneta Boardwalk. 473 guestrooms + suites with panoramic Mediterranean and city views. Spa, beachfront access.",
    internal_notes: "473 rooms · iconic sail-shape silhouette · awaiting pricing.",
  },
  {
    name: "El Convent",
    city: "Blanes",
    region: "Costa Brava",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: 11700,
    hire_fee_notes:
      "Friday €10,000 / Saturday €11,700. Menus from €150/person. No on-site accommodation.",
    event_roles: ["wedding", "ceremony", "reception"],
    description:
      "16th-century convent (1583) on Punta de Santa Anna at the start of the Costa Brava. Heritage site with sea views, aromatic plants, pine gardens. 70 km from Barcelona.",
    internal_notes:
      "Heritage venue. No accommodation on-site. Available both requested dates. 70 km north of Barcelona.",
  },
  {
    name: "Santa Marta Hotel",
    city: "Blanes",
    region: "Costa Brava",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: 90000,
    hire_fee_notes:
      "Exclusive buyout ~€90,000 — INCLUDES all 75 rooms with breakfast and 2 events.",
    event_roles: ["stay", "wedding", "welcome"],
    description:
      "5-star beachfront hotel within a Mediterranean pine forest overlooking Santa Cristina beach. Spa, outdoor pool, gourmet dining, direct cove access. Costa Brava.",
    internal_notes:
      "Exclusive-hire only (75 rooms). Premium price point — full takeover format.",
  },
  {
    name: "Jardin Santa Clotilde",
    city: "Blanes",
    region: "Costa Brava",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: 7500,
    hire_fee_notes:
      "Full day €7,500 (10am-8pm) / half day €4,500. Ceremony only — no dinner/reception on site.",
    event_roles: ["ceremony"],
    description:
      "Italian-Renaissance / noucentista garden masterpiece (1919) atop a cliff between Boadella Cove and Fenals Beach. Sculpted staircases, mermaid statues by Maria Llimona, cypresses + pines + lindens, sweeping Mediterranean views.",
    internal_notes:
      "CEREMONY ONLY — pair with a separate venue for dinner. Time-limited (10am-8pm).",
  },
  {
    name: "Casa Santa Clotilde",
    city: "Blanes",
    region: "Costa Brava",
    country: "Spain",
    capacity_seated: null,
    capacity_standing: null,
    hire_fee_eur: 19800,
    hire_fee_notes: "Exclusive hire €19,800 + VAT. No on-site rooms.",
    event_roles: ["wedding", "ceremony", "reception"],
    description:
      "Early 20th-century villa surrounded by cliff-top Italian Renaissance gardens overlooking the Mediterranean. Designed by Nicolau Maria Rubió i Tudurí. Terraces, fountains, sculptures.",
    internal_notes:
      "Same Rubió i Tudurí design DNA as Jardin Santa Clotilde — pair them for ceremony+reception. No accommodation on site.",
  },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const { data: workspace } = await sb
    .from("workspaces")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!workspace) throw new Error("no workspace; run pnpm db:seed first");
  const orgId = workspace.org_id;

  const sbAny = sb as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
      insert: (p: Record<string, unknown>) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };

  let created = 0;
  let existing = 0;

  for (const v of VENUES) {
    const { data: prior } = await sbAny
      .from("library_venues")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", v.name)
      .maybeSingle();
    if (prior) {
      existing += 1;
      console.log(`  · ${v.name} — already in library`);
      continue;
    }

    const { error } = await sbAny.from("library_venues").insert({
      org_id: orgId,
      name: v.name,
      slug: slugify(v.name),
      city: v.city,
      region: v.region,
      country: v.country,
      capacity_seated: v.capacity_seated,
      capacity_standing: v.capacity_standing,
      hire_fee_eur: v.hire_fee_eur,
      hire_fee_notes: v.hire_fee_notes,
      event_roles: v.event_roles,
      description: v.description,
      internal_notes: v.internal_notes,
    });
    if (error) {
      console.warn(`  ! ${v.name}: ${error.message}`);
      continue;
    }
    created += 1;
    console.log(`  ✓ ${v.name}`);
  }

  console.log("");
  console.log("Library seeded from venue-proposal-v3:");
  console.log(`  ${created} created, ${existing} already in library`);
  console.log(`  Total library now: ~${created + existing + 6} venues`);
  console.log("");
  console.log(
    "Photos: not extracted (PDF was 91MB and Pillow wheels aren't built for Python 3.15 on this machine).",
  );
  console.log(
    "Add photos via the venue detail page → Photos & videos drop-folder upload at /admin/library/venues/[id]",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
