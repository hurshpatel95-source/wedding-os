// Seed Astia's marketing-surface fields so we can demo:
//   /book/astia-events           — public booking page
//   /admin/leads                 — pre-populated lead inbox
//   /admin/booking               — already-published listing
// Re-runnable: clears + re-inserts windows, upserts leads.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dfyryyzizxcxtysduono.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing — copy from apps/web/.env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: orgs } = await sb.from("organizations").select("id, name").limit(5);
  console.log("Orgs:", orgs);
  if (!orgs || orgs.length === 0) {
    console.error("No org found");
    return;
  }
  const astia = orgs[0];
  console.log("Using org:", astia);

  const { error: updErr } = await (sb as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  })
    .from("organizations")
    .update({
      public_slug: "astia-events",
      public_tagline: "Destination + intimate weddings, planned with calm, run with care.",
      public_brand_md: `## What we do

We design + run destination and intimate weddings — venue shortlist, vendor curation, design + production, day-of execution.

## Where we work

Barcelona, Costa Brava, Sitges. We've also done Mallorca, Tuscany, and Mexico City when the couple's heart was set.

## What working with us looks like

- A 30-minute intro call to meet you both and hear the story
- A custom proposal within 5 business days
- One planner from inquiry to wedding day — no hand-offs
- A private wedding-os dashboard for venues, vendors, schedule, RSVPs

## Pricing

Full-service planning starts at €18k. Month-of coordination from €4.5k. Custom packages for elopements + intimate dinners.`,
      contact_email: "hello@astiaevents.com",
      contact_phone: "+34 600 000 000",
      booking_slot_minutes: 30,
      booking_buffer_minutes: 15,
      public_published_at: new Date().toISOString(),
    })
    .eq("id", astia.id);
  if (updErr) {
    console.error("Org update failed:", updErr);
    return;
  }
  console.log("✓ Org updated with marketing fields");

  // Booking windows: Tue/Thu 10-12 + 16-18, Wed 16-18
  await (sb as unknown as {
    from: (t: string) => {
      delete: () => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  })
    .from("booking_windows")
    .delete()
    .eq("org_id", astia.id);
  const windows = [
    { org_id: astia.id, day_of_week: 2, start_minute: 600, end_minute: 720, label: "Morning consults" },
    { org_id: astia.id, day_of_week: 2, start_minute: 960, end_minute: 1080, label: "Afternoon consults" },
    { org_id: astia.id, day_of_week: 3, start_minute: 960, end_minute: 1080, label: "Afternoon consults" },
    { org_id: astia.id, day_of_week: 4, start_minute: 600, end_minute: 720, label: "Morning consults" },
    { org_id: astia.id, day_of_week: 4, start_minute: 960, end_minute: 1080, label: "Afternoon consults" },
  ];
  const { error: insErr } = await (sb as unknown as {
    from: (t: string) => {
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("booking_windows")
    .insert(windows);
  if (insErr) {
    console.error("Windows insert failed:", insErr);
    return;
  }
  console.log("✓ Booking windows seeded:", windows.length);

  // Demo leads — only insert if there are 0 existing leads (idempotent-ish)
  const { data: existing } = await (sb as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{ data: unknown[] | null }>;
      };
    };
  })
    .from("leads")
    .select("id")
    .eq("org_id", astia.id);

  if ((existing ?? []).length > 0) {
    console.log(`⏭  ${existing!.length} leads already exist; skipping demo lead seed.`);
    return;
  }

  const { data: ws } = await sb.from("workspaces").select("id, name").eq("org_id", astia.id).limit(1);
  const referringId = ws?.[0]?.id ?? null;

  const demoLeads = [
    {
      org_id: astia.id,
      source: "booking_page",
      status: "booked_call",
      couple_names: "Sofía & Mateo",
      email: "sofia@example.com",
      phone: "+34 612 345 678",
      wedding_date: "2027-06-12",
      guest_count: 110,
      budget_band: "€40–80k",
      city_or_region: "Barcelona",
      notes: "Looking for a sunset-on-the-water sangeet venue + Sunday brunch wedding. Have a venue we love but need vendor help.",
      scheduled_call_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      scheduled_call_duration_minutes: 30,
    },
    {
      org_id: astia.id,
      source: "public_wedding_site",
      referring_workspace_id: referringId,
      status: "new",
      couple_names: "Priya & James",
      email: "priya@example.com",
      wedding_date: "2027-09-25",
      guest_count: 200,
      budget_band: "€80–150k",
      city_or_region: "Sitges",
      notes: "We loved Nisha & Hursh's wedding site! Considering a similar style for ours.",
    },
    {
      org_id: astia.id,
      source: "manual",
      status: "qualified",
      couple_names: "Amelia & Tom",
      email: "amelia@example.com",
      phone: "+44 7700 900123",
      wedding_date: "2026-09-19",
      guest_count: 80,
      budget_band: "€20–40k",
      city_or_region: "Costa Brava",
      notes: "Met at a vendor showcase. They want intimate, food-focused, full weekend.",
    },
    {
      org_id: astia.id,
      source: "booking_page",
      status: "contacted",
      couple_names: "Maya & Devang",
      email: "maya@example.com",
      wedding_date: "2027-04-17",
      guest_count: 250,
      budget_band: "€150k+",
      city_or_region: "Barcelona",
      notes: "Three-day Indian wedding. Sangeet + ceremony + reception. Budget flexible if right venues.",
    },
    {
      org_id: astia.id,
      source: "public_wedding_site",
      referring_workspace_id: referringId,
      status: "lost",
      couple_names: "Dana & Jules",
      email: "dana@example.com",
      wedding_date: "2026-08-08",
      guest_count: 60,
      budget_band: "Under €20k",
      city_or_region: "Sitges",
      notes: "Decided to elope.",
    },
  ];
  const { error: leadErr } = await (sb as unknown as {
    from: (t: string) => {
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("leads")
    .insert(demoLeads);
  if (leadErr) {
    console.error("Leads insert failed:", leadErr);
    return;
  }
  console.log("✓ Demo leads seeded:", demoLeads.length);

  console.log("\nDone!");
  console.log("  Public booking page: /book/astia-events");
  console.log("  Admin leads:         /admin/leads");
  console.log("  Booking config:      /admin/booking");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
