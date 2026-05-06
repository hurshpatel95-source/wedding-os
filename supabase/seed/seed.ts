// Seed: demo workspace + planner/couple users + 6 venues + starter pricing template.
// Pricing data is extracted from Astha (Astia Events) PDF + WhatsApp messages, Apr 2026.
//
// Run: pnpm db:seed
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/db/src/types.gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
// Web app env first (where Supabase keys live), then root .env as fallback.
loadEnv({ path: path.join(repoRoot, "apps/web/.env.local") });
loadEnv({ path: path.join(repoRoot, ".env") });

type Tables = Database["public"]["Tables"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const PLANNER_EMAIL = process.env.SEED_PLANNER_EMAIL ?? "astha@astiaevents.com";
const COUPLE_HURSH_EMAIL = process.env.SEED_HURSH_EMAIL ?? "hursh@example.com";
const COUPLE_NISHA_EMAIL = process.env.SEED_NISHA_EMAIL ?? "nisha@example.com";

const sb = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAuthUser(email: string): Promise<string> {
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;

  const { data, error } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`failed to create ${email}`);
  return data.user.id;
}

async function main() {
  console.log("→ Creating organization + workspace");
  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .insert({ name: "Astia Events" })
    .select()
    .single();
  if (orgErr || !org) throw orgErr;

  const { data: workspace, error: wsErr } = await sb
    .from("workspaces")
    .insert({
      org_id: org.id,
      name: "Nisha & Hursh — Barcelona 2027",
      wedding_date: null, // TBD between 9/4, 9/5, 9/6, 9/12, 9/18
      base_currency: "EUR",
    })
    .select()
    .single();
  if (wsErr || !workspace) throw wsErr;

  console.log("→ Creating auth users (planner + couple)");
  const plannerId = await ensureAuthUser(PLANNER_EMAIL);
  const hurshId = await ensureAuthUser(COUPLE_HURSH_EMAIL);
  const nishaId = await ensureAuthUser(COUPLE_NISHA_EMAIL);

  await sb.from("users").upsert([
    {
      id: plannerId,
      email: PLANNER_EMAIL,
      role: "admin",
      org_id: org.id,
      workspace_id: workspace.id,
    },
    {
      id: hurshId,
      email: COUPLE_HURSH_EMAIL,
      role: "couple",
      org_id: org.id,
      workspace_id: workspace.id,
    },
    {
      id: nishaId,
      email: COUPLE_NISHA_EMAIL,
      role: "couple",
      org_id: org.id,
      workspace_id: workspace.id,
    },
  ]);

  console.log("→ Inserting venues");
  const venueRows: Tables["venues"]["Insert"][] = [
    {
      workspace_id: workspace.id,
      org_id: org.id,
      name: "Casa Del Mar",
      address: "Sitges, Spain",
      contact_name: "Astha Doshi",
      contact_email: "astha@astiaevents.com",
      contact_phone: "+44 74 368 474 38",
      indoor_outdoor: "both",
      in_house_catering: true,
      has_accommodation: true,
      capacity_min: 50,
      capacity_max: 180,
      planner_notes:
        "Welcome Party / Sangeet venue. Sat hire €14,000+VAT, Fri €12,400+VAT. Bridal suite included to get ready (€600/night with breakfast). Full 12-guest takeover €5,000/night. 15min from Sitges. Available 4, 5, 17 Sep 2027. No per-pax minimum.",
      status: "quoted",
    },
    {
      workspace_id: workspace.id,
      org_id: org.id,
      name: "Xalet Del Nin",
      address: "Vilanova i la Geltrú, Barcelona coast",
      contact_name: "Astha Doshi",
      contact_email: "astha@astiaevents.com",
      contact_phone: "+44 74 368 474 38",
      indoor_outdoor: "both",
      in_house_catering: true,
      has_accommodation: false,
      capacity_min: 80,
      capacity_max: 250,
      planner_notes:
        "Wedding venue. Sat hire €22,000+VAT, Sun €19,000+VAT. 15min from ME Sitges. Available Sun 6 Sep + Sat 18 Sep 2027. Historic estate by the Mediterranean. No per-pax minimum.",
      status: "quoted",
    },
    {
      workspace_id: workspace.id,
      org_id: org.id,
      name: "ME Sitges Terramar",
      address: "Sitges, Spain",
      contact_name: "Astha Doshi",
      contact_email: "astha@astiaevents.com",
      contact_phone: "+44 74 368 474 38",
      indoor_outdoor: "both",
      in_house_catering: true,
      has_accommodation: true,
      capacity_min: 50,
      capacity_max: 200,
      planner_notes:
        "Stay + Welcome Party venue option. Rooftop + connecting terrace event space (no pool event in 2027). Online room rate €436/night incl. breakfast. Booking discounts: 20% (90+ days), 15% (89-15 days), 10% (<14 days).",
      status: "shortlisted",
    },
    {
      workspace_id: workspace.id,
      org_id: org.id,
      name: "Marina Port Vell",
      address: "Barcelona waterfront",
      contact_name: "Astha Doshi",
      contact_email: "astha@astiaevents.com",
      contact_phone: "+44 74 368 474 38",
      indoor_outdoor: "outdoor",
      in_house_catering: true,
      has_accommodation: false,
      capacity_min: 80,
      capacity_max: 250,
      planner_notes:
        "Welcome Party / Sangeet venue. Weekend hire €6,500, weekday €9,500. 15-20min from ME Barcelona. Available Fri 3 Sep + Sat 4 Sep 2027.",
      status: "quoted",
    },
    {
      workspace_id: workspace.id,
      org_id: org.id,
      name: "Mas de Sant Llei",
      address: "35 min from Barcelona",
      contact_name: "Astha Doshi",
      contact_email: "astha@astiaevents.com",
      contact_phone: "+44 74 368 474 38",
      indoor_outdoor: "both",
      in_house_catering: true,
      has_accommodation: false,
      capacity_min: 100,
      capacity_max: 280,
      planner_notes:
        "Wedding venue. Sat 4 Sep whole property (280pax min), Sun 5 + 18 Sep Sant Esteve area only (250pax cap). Helipad. Spaces: Orange courtyard €2,000+VAT, Forest €2,500+VAT, cocktail courtyard €2,500+VAT, indoor 2h dancing €4,500+VAT (extra hr €1,100). Menu min €180/pp.",
      status: "quoted",
    },
    {
      workspace_id: workspace.id,
      org_id: org.id,
      name: "Yacht Charter — Marina Port Vell",
      address: "Marina Port Vell, Barcelona",
      contact_name: "Astha Doshi",
      contact_email: "astha@astiaevents.com",
      contact_phone: "+44 74 368 474 38",
      indoor_outdoor: "outdoor",
      in_house_catering: true,
      has_accommodation: false,
      capacity_min: 20,
      capacity_max: 80,
      planner_notes:
        "Private yacht charter option for an intimate Welcome Party / Sangeet on the water. No per-pax minimum (per Astha WhatsApp). Pricing TBD — awaiting quote from planner.",
      status: "shortlisted",
    },
    {
      workspace_id: workspace.id,
      org_id: org.id,
      name: "ME Barcelona",
      address: "Passeig de Gràcia, Barcelona",
      contact_name: "Astha Doshi",
      contact_email: "astha@astiaevents.com",
      contact_phone: "+44 74 368 474 38",
      indoor_outdoor: "both",
      in_house_catering: true,
      has_accommodation: true,
      capacity_min: 40,
      capacity_max: 200,
      planner_notes:
        "Stay + event space. Hire fee €5,200+VAT, cocktail menu from €60/pp. Online rates €408/night. Same booking discount tiers as ME Sitges.",
      status: "shortlisted",
    },
  ];

  const { data: venues, error: venuesErr } = await sb.from("venues").insert(venueRows).select();
  if (venuesErr || !venues) throw venuesErr;

  console.log("→ Building pricing template");
  const { data: tpl, error: tplErr } = await sb
    .from("pricing_templates")
    .insert({
      org_id: org.id,
      name: "Astia Wedding Standard 2027",
      version: 1,
      currency_default: "EUR",
    })
    .select()
    .single();
  if (tplErr || !tpl) throw tplErr;

  type Cat = { label: string; sort: number };
  const cats: Cat[] = [
    { label: "Venue Hire", sort: 10 },
    { label: "Catering", sort: 20 },
    { label: "Accommodation", sort: 30 },
    { label: "Decor & Florals", sort: 40 },
    { label: "Photo & Video", sort: 50 },
    { label: "Music & DJ", sort: 60 },
    { label: "Glam (MUA & Mehendi)", sort: 70 },
    { label: "Officiant & Stationery", sort: 80 },
    { label: "Transport", sort: 90 },
  ];

  const catRows = cats.map((c) => ({ template_id: tpl.id, label: c.label, sort_order: c.sort }));
  const { data: insertedCats, error: catsErr } = await sb
    .from("pricing_categories")
    .insert(catRows)
    .select();
  if (catsErr || !insertedCats) throw catsErr;

  const catId = (label: string) => insertedCats.find((c) => c.label === label)!.id;

  const lineItems: Tables["pricing_line_items"]["Insert"][] = [
    // Venue Hire
    { category_id: catId("Venue Hire"), label: "Venue hire fee", unit: "flat", default_unit_price: 14000, currency: "EUR", sort_order: 10 },
    { category_id: catId("Venue Hire"), label: "Per-event space surcharge", unit: "per_event", default_unit_price: 2500, currency: "EUR", sort_order: 20 },
    // Catering
    { category_id: catId("Catering"), label: "Wedding menu (drinks, service, tableware, furniture)", unit: "per_guest", default_unit_price: 220, currency: "EUR", sort_order: 10 },
    { category_id: catId("Catering"), label: "Sangeet / Welcome menu", unit: "per_guest", default_unit_price: 180, currency: "EUR", sort_order: 20 },
    { category_id: catId("Catering"), label: "Cocktail-style menu", unit: "per_guest", default_unit_price: 60, currency: "EUR", sort_order: 30 },
    // Accommodation
    { category_id: catId("Accommodation"), label: "Bridal suite", unit: "per_day", default_unit_price: 600, currency: "EUR", sort_order: 10 },
    { category_id: catId("Accommodation"), label: "Group room block (per night)", unit: "per_day", default_unit_price: 408, currency: "EUR", sort_order: 20 },
    // Decor & Florals
    { category_id: catId("Decor & Florals"), label: "Decor — basic", unit: "flat", default_unit_price: 8000, currency: "EUR", tier: "basic", sort_order: 10 },
    { category_id: catId("Decor & Florals"), label: "Decor — standard", unit: "flat", default_unit_price: 18000, currency: "EUR", tier: "standard", sort_order: 20 },
    { category_id: catId("Decor & Florals"), label: "Decor — premium", unit: "flat", default_unit_price: 35000, currency: "EUR", tier: "premium", sort_order: 30 },
    { category_id: catId("Decor & Florals"), label: "Lounge furniture", unit: "flat", default_unit_price: 2500, currency: "EUR", sort_order: 40 },
    { category_id: catId("Decor & Florals"), label: "Sound system rental", unit: "per_event", default_unit_price: 1200, currency: "EUR", sort_order: 50 },
    // Photo & Video
    { category_id: catId("Photo & Video"), label: "Photo — basic", unit: "flat", default_unit_price: 3500, currency: "EUR", tier: "basic", sort_order: 10 },
    { category_id: catId("Photo & Video"), label: "Photo — standard", unit: "flat", default_unit_price: 6500, currency: "EUR", tier: "standard", sort_order: 20 },
    { category_id: catId("Photo & Video"), label: "Photo — premium", unit: "flat", default_unit_price: 12000, currency: "EUR", tier: "premium", sort_order: 30 },
    { category_id: catId("Photo & Video"), label: "Video — basic", unit: "flat", default_unit_price: 4000, currency: "EUR", tier: "basic", sort_order: 40 },
    { category_id: catId("Photo & Video"), label: "Video — standard", unit: "flat", default_unit_price: 7500, currency: "EUR", tier: "standard", sort_order: 50 },
    { category_id: catId("Photo & Video"), label: "Video — premium", unit: "flat", default_unit_price: 14000, currency: "EUR", tier: "premium", sort_order: 60 },
    // Music & DJ
    { category_id: catId("Music & DJ"), label: "DJ — basic", unit: "flat", default_unit_price: 2500, currency: "EUR", tier: "basic", sort_order: 10 },
    { category_id: catId("Music & DJ"), label: "DJ — standard", unit: "flat", default_unit_price: 4500, currency: "EUR", tier: "standard", sort_order: 20 },
    { category_id: catId("Music & DJ"), label: "DJ — premium / live band", unit: "flat", default_unit_price: 9000, currency: "EUR", tier: "premium", sort_order: 30 },
    // Glam
    { category_id: catId("Glam (MUA & Mehendi)"), label: "MUA — bride", unit: "per_event", default_unit_price: 800, currency: "EUR", sort_order: 10 },
    { category_id: catId("Glam (MUA & Mehendi)"), label: "MUA — family", unit: "per_guest", default_unit_price: 150, currency: "EUR", sort_order: 20 },
    { category_id: catId("Glam (MUA & Mehendi)"), label: "Mehendi artist", unit: "per_event", default_unit_price: 1200, currency: "EUR", sort_order: 30 },
    // Officiant & Stationery
    { category_id: catId("Officiant & Stationery"), label: "Priest / officiant", unit: "flat", default_unit_price: 800, currency: "EUR", sort_order: 10 },
    { category_id: catId("Officiant & Stationery"), label: "Stationery & signage", unit: "flat", default_unit_price: 1500, currency: "EUR", sort_order: 20 },
    // Transport
    { category_id: catId("Transport"), label: "Guest shuttle (per coach)", unit: "per_event", default_unit_price: 950, currency: "EUR", sort_order: 10 },
    { category_id: catId("Transport"), label: "Bridal car", unit: "per_event", default_unit_price: 600, currency: "EUR", sort_order: 20 },
  ];

  const { error: liErr } = await sb.from("pricing_line_items").insert(lineItems);
  if (liErr) throw liErr;

  console.log("→ Linking each venue to the pricing template");
  const venuePricingRows: Tables["venue_pricing"]["Insert"][] = venues.map((v) => ({
    venue_id: v.id,
    template_id: tpl.id,
    overrides: {},
    source: "seed",
  }));
  const { error: vpErr } = await sb.from("venue_pricing").insert(venuePricingRows);
  if (vpErr) throw vpErr;

  console.log("✓ Seed complete");
  console.log(`   org: ${org.id}`);
  console.log(`   workspace: ${workspace.id}`);
  console.log(`   venues: ${venues.length}`);
  console.log(`   pricing template: ${tpl.id} (${lineItems.length} line items)`);
  console.log("");
  console.log("Next steps:");
  console.log(`   1. Sign in at /login with one of: ${PLANNER_EMAIL}, ${COUPLE_HURSH_EMAIL}, ${COUPLE_NISHA_EMAIL}`);
  console.log(`   2. Override SEED_*_EMAIL env vars before re-running to use real addresses.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
