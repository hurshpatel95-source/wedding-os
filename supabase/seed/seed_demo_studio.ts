// Make Astia's studio FEEL ALIVE for the sales pitch.
//
// Builds out a 60-day picture across leads, planner invoices (with real
// revenue YTD), additional demo client workspaces, and one marketing
// scorecard. Re-runnable: deletes Astia's leads + planner_invoices +
// marketing_scorecards before reseeding so the dashboard reflects exactly
// what this script intends.
//
// Usage:
//   pnpm db:seed-demo-studio
// Requires SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dfyryyzizxcxtysduono.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const sbAny = sb as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, val: string) => Promise<{ data: unknown[] | null }>;
    };
    insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
    update: (row: unknown) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function daysAhead(n: number, hour = 10, minute = 0): Date {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const { data: orgs } = await sb.from("organizations").select("id, name").limit(5);
  if (!orgs || orgs.length === 0) {
    console.error("No org found");
    return;
  }
  const astia = orgs[0];
  console.log("Using org:", astia);

  // ─── Wipe what we'll reseed (Astia-scoped) ───────────────────────
  await sbAny.from("leads").delete().eq("org_id", astia.id);
  await sbAny.from("planner_invoices").delete().eq("org_id", astia.id);
  await sbAny.from("marketing_scorecards").delete().eq("org_id", astia.id);
  console.log("✓ Cleared existing demo data");

  // ─── Find / make 2 additional demo workspaces ────────────────────
  const { data: existingWs } = await sb
    .from("workspaces")
    .select("id, name, wedding_date, created_at")
    .eq("org_id", astia.id)
    .order("created_at", { ascending: true });

  const primaryWs = (existingWs ?? [])[0];
  if (!primaryWs) {
    console.error("No primary workspace");
    return;
  }

  // Add Sara&Marcus + Jennifer&Liam if they don't already exist
  const wantWorkspaces = [
    { name: "Sara & Marcus — Costa Brava 2027", wedding_date: "2027-05-22" },
    { name: "Jennifer & Liam — Sitges 2026", wedding_date: "2026-09-12" },
    { name: "Anaya & Rohan — Barcelona 2027", wedding_date: "2027-07-10" },
  ];

  const newWorkspaceIds: string[] = [];
  for (const w of wantWorkspaces) {
    const exists = (existingWs ?? []).some((x) => x.name === w.name);
    if (exists) continue;
    const { data: ws, error } = await sb
      .from("workspaces")
      .insert({ org_id: astia.id, ...w })
      .select("id")
      .single();
    if (error) {
      console.error("Workspace insert failed:", error);
    } else if (ws) {
      newWorkspaceIds.push(ws.id);
      // default branding row
      await (sb as unknown as {
        from: (t: string) => {
          upsert: (
            row: unknown,
            opts: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        };
      })
        .from("workspace_branding")
        .upsert({ workspace_id: ws.id }, { onConflict: "workspace_id" });
    }
  }
  if (newWorkspaceIds.length) console.log(`✓ Added ${newWorkspaceIds.length} demo workspaces`);

  // Re-fetch workspaces (now including the new ones)
  const { data: allWs } = await sb
    .from("workspaces")
    .select("id, name, wedding_date")
    .eq("org_id", astia.id);
  const wsList = allWs ?? [];
  const wsByName = new Map(wsList.map((w) => [w.name, w]));

  // ─── Leads (10 across stages, spread over 60 days) ────────────────
  const leads = [
    {
      created_offset: 1,
      source: "booking_page",
      status: "booked_call",
      couple_names: "Sofía & Mateo",
      email: "sofia@example.com",
      phone: "+34 612 345 678",
      wedding_date: "2027-06-12",
      guest_count: 110,
      budget_band: "€40–80k",
      city_or_region: "Barcelona",
      notes: "Sunset-on-the-water sangeet + Sunday brunch wedding. Have a venue we love but need vendor help.",
      scheduled_call_offset: 2,
    },
    {
      created_offset: 3,
      source: "public_wedding_site",
      referring: "Nisha & Hursh — Barcelona 2027",
      status: "new",
      couple_names: "Priya & James",
      email: "priya@example.com",
      wedding_date: "2027-09-25",
      guest_count: 200,
      budget_band: "€80–150k",
      city_or_region: "Sitges",
      notes: "Loved Nisha & Hursh's site! Considering similar style.",
    },
    {
      created_offset: 5,
      source: "booking_page",
      status: "booked_call",
      couple_names: "Maya & Devang",
      email: "maya@example.com",
      wedding_date: "2027-04-17",
      guest_count: 250,
      budget_band: "€150k+",
      city_or_region: "Barcelona",
      notes: "Three-day Indian wedding. Sangeet + ceremony + reception. Budget flexible.",
      scheduled_call_offset: 4,
    },
    {
      created_offset: 8,
      source: "manual",
      status: "qualified",
      couple_names: "Amelia & Tom",
      email: "amelia@example.com",
      phone: "+44 7700 900123",
      wedding_date: "2026-09-19",
      guest_count: 80,
      budget_band: "€20–40k",
      city_or_region: "Costa Brava",
      notes: "Met at vendor showcase. Intimate, food-focused, full weekend.",
    },
    {
      created_offset: 12,
      source: "booking_page",
      status: "contacted",
      couple_names: "Elena & Marco",
      email: "elena@example.com",
      wedding_date: "2027-10-03",
      guest_count: 140,
      budget_band: "€40–80k",
      city_or_region: "Mallorca",
      notes: "Italian + Spanish family. Need bilingual planner. Open to whole-island weekend.",
    },
    {
      created_offset: 14,
      source: "public_wedding_site",
      referring: "Nisha & Hursh — Barcelona 2027",
      status: "qualified",
      couple_names: "Aanya & Vikram",
      email: "aanya@example.com",
      phone: "+1 415 555 0142",
      wedding_date: "2027-11-14",
      guest_count: 180,
      budget_band: "€80–150k",
      city_or_region: "Barcelona",
      notes: "From SF, want destination wedding. Tech couple, very organized, want clear timeline.",
    },
    {
      created_offset: 18,
      source: "booking_page",
      status: "converted",
      couple_names: "Sara & Marcus",
      email: "sara@example.com",
      wedding_date: "2027-05-22",
      guest_count: 95,
      budget_band: "€40–80k",
      city_or_region: "Costa Brava",
      notes: "Locked in. Booked retainer. See workspace.",
      converted_to: "Sara & Marcus — Costa Brava 2027",
    },
    {
      created_offset: 22,
      source: "manual",
      status: "lost",
      couple_names: "Dana & Jules",
      email: "dana@example.com",
      wedding_date: "2026-08-08",
      guest_count: 60,
      budget_band: "Under €20k",
      city_or_region: "Sitges",
      notes: "Decided to elope.",
    },
    {
      created_offset: 28,
      source: "booking_page",
      status: "converted",
      couple_names: "Jennifer & Liam",
      email: "jennifer@example.com",
      wedding_date: "2026-09-12",
      guest_count: 70,
      budget_band: "€20–40k",
      city_or_region: "Sitges",
      notes: "Closed in week 4. Month-of coordination only.",
      converted_to: "Jennifer & Liam — Sitges 2026",
    },
    {
      created_offset: 35,
      source: "public_wedding_site",
      referring: "Nisha & Hursh — Barcelona 2027",
      status: "converted",
      couple_names: "Anaya & Rohan",
      email: "anaya@example.com",
      wedding_date: "2027-07-10",
      guest_count: 220,
      budget_band: "€150k+",
      city_or_region: "Barcelona",
      notes: "Big Indian wedding. Full-service. Highest-value lead this quarter.",
      converted_to: "Anaya & Rohan — Barcelona 2027",
    },
    {
      created_offset: 45,
      source: "booking_page",
      status: "lost",
      couple_names: "Lucy & Ethan",
      email: "lucy@example.com",
      wedding_date: "2027-08-15",
      guest_count: 60,
      budget_band: "Under €20k",
      city_or_region: "Mallorca",
      notes: "Budget mismatch. Sent friendly decline.",
    },
  ];

  const refWs = wsByName.get("Nisha & Hursh — Barcelona 2027") ?? primaryWs;
  const leadRows = leads.map((l) => {
    const created_at = daysAgo(l.created_offset).toISOString();
    const referring_workspace_id = l.referring
      ? wsByName.get(l.referring)?.id ?? null
      : null;
    const convertedWs = l.converted_to ? wsByName.get(l.converted_to) : null;
    return {
      org_id: astia.id,
      source: l.source,
      status: l.status,
      couple_names: l.couple_names,
      email: l.email,
      phone: l.phone ?? null,
      wedding_date: l.wedding_date,
      guest_count: l.guest_count,
      budget_band: l.budget_band,
      city_or_region: l.city_or_region,
      notes: l.notes,
      referring_workspace_id,
      scheduled_call_at: l.scheduled_call_offset
        ? daysAhead(l.scheduled_call_offset, 10 + (l.scheduled_call_offset % 6)).toISOString()
        : null,
      scheduled_call_duration_minutes: l.scheduled_call_offset ? 30 : null,
      converted_workspace_id: convertedWs?.id ?? null,
      converted_at: convertedWs ? daysAgo(Math.max(1, l.created_offset - 4)).toISOString() : null,
      created_at,
      updated_at: created_at,
      metadata: {},
    };
  });

  const { error: leadErr } = await sbAny.from("leads").insert(leadRows);
  if (leadErr) {
    console.error("Lead insert failed:", leadErr);
  } else {
    console.log(`✓ Seeded ${leadRows.length} leads`);
  }
  // Use refWs to silence the lint that demos referrals
  void refWs;

  // ─── Planner invoices (revenue YTD!) ──────────────────────────────
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  const invoices: Array<{
    workspace_name: string;
    label: string;
    amount: number;
    issued_offset: number;
    paid_offset: number | null;
    due_offset: number | null;
    note?: string;
  }> = [
    // Hursh+Nisha — primary client, retainer paid + milestone outstanding
    {
      workspace_name: "Nisha & Hursh — Barcelona 2027",
      label: "Retainer · 50%",
      amount: 9000,
      issued_offset: 90,
      paid_offset: 88,
      due_offset: 60,
      note: "Bank transfer received",
    },
    {
      workspace_name: "Nisha & Hursh — Barcelona 2027",
      label: "Milestone 2 · venue locked",
      amount: 4500,
      issued_offset: 30,
      paid_offset: 28,
      due_offset: 0,
    },
    {
      workspace_name: "Nisha & Hursh — Barcelona 2027",
      label: "Milestone 3 · vendor contracts",
      amount: 4500,
      issued_offset: 5,
      paid_offset: null,
      due_offset: 25,
    },
    // Sara & Marcus — recently converted
    {
      workspace_name: "Sara & Marcus — Costa Brava 2027",
      label: "Retainer · 50%",
      amount: 7500,
      issued_offset: 12,
      paid_offset: 10,
      due_offset: -3,
    },
    // Jennifer & Liam — month-of coordination, paid in full
    {
      workspace_name: "Jennifer & Liam — Sitges 2026",
      label: "Month-of coordination",
      amount: 4500,
      issued_offset: 25,
      paid_offset: 20,
      due_offset: -5,
    },
    // Anaya & Rohan — biggest client, retainer just paid
    {
      workspace_name: "Anaya & Rohan — Barcelona 2027",
      label: "Retainer · 50%",
      amount: 16000,
      issued_offset: 35,
      paid_offset: 33,
      due_offset: 5,
    },
    {
      workspace_name: "Anaya & Rohan — Barcelona 2027",
      label: "Milestone 2 · design deck",
      amount: 8000,
      issued_offset: 8,
      paid_offset: null,
      due_offset: 14,
    },
    // Last year revenue (for YoY)
    {
      workspace_name: "Nisha & Hursh — Barcelona 2027",
      label: `${lastYear} · Initial deposit`,
      amount: 3000,
      issued_offset: 365 + 90,
      paid_offset: 365 + 87,
      due_offset: 365 + 60,
    },
    {
      workspace_name: "Jennifer & Liam — Sitges 2026",
      label: `${lastYear} · Discovery + scoping`,
      amount: 1500,
      issued_offset: 365 + 30,
      paid_offset: 365 + 28,
      due_offset: 365 + 0,
    },
  ];

  const invoiceRows = invoices
    .map((inv) => {
      const ws = wsByName.get(inv.workspace_name);
      if (!ws) return null;
      const issuedAt = daysAgo(inv.issued_offset).toISOString();
      const paidAt = inv.paid_offset ? daysAgo(inv.paid_offset).toISOString() : null;
      const dueAt =
        inv.due_offset != null
          ? daysAgo(inv.due_offset).toISOString().slice(0, 10)
          : null;
      return {
        org_id: astia.id,
        workspace_id: ws.id,
        label: inv.label,
        amount_eur: inv.amount,
        due_at: dueAt,
        sent_at: issuedAt,
        paid_at: paidAt,
        paid_via: paidAt ? "Bank transfer" : null,
        notes: inv.note ?? null,
        external_url: null,
        created_at: issuedAt,
        updated_at: paidAt ?? issuedAt,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error: invErr } = await sbAny
    .from("planner_invoices")
    .insert(invoiceRows);
  if (invErr) {
    console.error("Invoice insert failed:", invErr);
  } else {
    console.log(`✓ Seeded ${invoiceRows.length} planner invoices`);
  }

  // ─── Marketing scorecard demo (no AI cost — pre-canned) ───────────
  const scorecard = {
    org_id: astia.id,
    url: "https://astiaevents.com/",
    title_text: "Astia Events — Destination wedding planning, Barcelona",
    meta_description:
      "Full-service destination wedding planning in Barcelona, Costa Brava, and Sitges. Indian, multi-cultural, and intimate weddings.",
    h1_count: 1,
    word_count: 612,
    has_call_to_action: true,
    has_contact_info: true,
    has_schema_org: false,
    page_speed_seconds: 2.1,
    scorecard_md: `## What's working

Your homepage opens with a strong, specific tagline and the gallery above the fold immediately tells couples what kind of weddings you do. The "Book a consult" button is visible without scrolling — that's exactly right.

## What's costing you couples

The site doesn't tell Google what kind of business you are. Without **schema.org structured data** (LocalBusiness + Organization markup), search engines can't put your phone number, hours, or service area in the rich result. Half the planners in Barcelona have this; you don't yet.

Your meta description is fine but doesn't say *Barcelona* — that's the highest-volume search term for couples planning here. A 5-word edit could double click-through from organic search.

The "About" page is where you lose the longest read times. The bio is long but doesn't show pricing ranges or process. Couples who like the work but bounce on this page are couples whose budget might fit but think it doesn't.

## Quick wins

The phone number isn't clickable on mobile. One line of HTML change.

Your Instagram embed pulls 10MB on first load — that's two-thirds of your speed budget. Lazy-load it below the fold.`,
    recommendations: [
      {
        title: "Add LocalBusiness + Organization schema.org JSON-LD",
        detail:
          "Drop a JSON-LD script in the head with your name, phone, address, opening hours, and service area (Barcelona, Costa Brava, Sitges, Mallorca). This is the highest-leverage SEO change you can make in an afternoon.",
        effort: "medium",
      },
      {
        title: "Edit homepage meta description to lead with 'Barcelona'",
        detail:
          "Current: 'Full-service destination wedding planning…'. Better: 'Barcelona-based destination wedding planner — Indian, multi-cultural, intimate weddings on the Costa Brava coast.' Targets the search couples actually type.",
        effort: "low",
      },
      {
        title: "Add a pricing strip to /about",
        detail:
          "Even one line — 'Full-service from €18k · month-of from €4.5k' — qualifies leads before they email. You'll get fewer total inquiries but a much higher % will be in budget.",
        effort: "low",
      },
      {
        title: "Make phone numbers tap-to-call on mobile",
        detail:
          "Wrap the phone number in <a href='tel:+34600000000'>. One line of HTML. Mobile bounce rate will drop ~15% on contact intent.",
        effort: "low",
      },
      {
        title: "Lazy-load the Instagram embed",
        detail:
          "Defer the script until scroll-into-view. Will cut your Largest Contentful Paint from 2.1s to under 1.2s. Google Core Web Vitals reward this.",
        effort: "medium",
      },
    ],
    raw_excerpt:
      "Astia Events designs and runs destination weddings across Barcelona, the Costa Brava, and Sitges. We specialize in Indian, multi-cultural, and intimate weddings…",
    fetched_at: daysAgo(2).toISOString(),
  };

  const { error: scErr } = await sbAny
    .from("marketing_scorecards")
    .insert(scorecard);
  if (scErr) console.error("Scorecard insert failed:", scErr);
  else console.log("✓ Seeded 1 marketing scorecard");

  // ─── Booking windows + org public fields (re-run-safe) ───────────
  const orgUpdate = {
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
  };
  await sbAny.from("organizations").update(orgUpdate).eq("id", astia.id);
  console.log("✓ Org marketing fields refreshed");

  await sbAny.from("booking_windows").delete().eq("org_id", astia.id);
  const windows = [
    { org_id: astia.id, day_of_week: 2, start_minute: 600, end_minute: 720, label: "Morning consults" },
    { org_id: astia.id, day_of_week: 2, start_minute: 960, end_minute: 1080, label: "Afternoon consults" },
    { org_id: astia.id, day_of_week: 3, start_minute: 960, end_minute: 1080, label: "Afternoon consults" },
    { org_id: astia.id, day_of_week: 4, start_minute: 600, end_minute: 720, label: "Morning consults" },
    { org_id: astia.id, day_of_week: 4, start_minute: 960, end_minute: 1080, label: "Afternoon consults" },
  ];
  await sbAny.from("booking_windows").insert(windows);
  console.log("✓ Booking windows refreshed:", windows.length);

  // ─── Make sure new client workspaces have public slugs so /w/ works ──
  for (const name of [
    "Sara & Marcus — Costa Brava 2027",
    "Jennifer & Liam — Sitges 2026",
    "Anaya & Rohan — Barcelona 2027",
  ]) {
    const ws = wsByName.get(name);
    if (!ws) continue;
    const slug = name
      .split("—")[0]
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    await sbAny
      .from("workspaces")
      .update({
        public_slug: slug,
        public_published_at: new Date().toISOString(),
      })
      .eq("id", ws.id);
  }
  console.log("✓ Public slugs set on demo workspaces");

  console.log("\n✓✓ Demo studio seeded.");
  console.log("   /admin           Studio dashboard (now ALIVE)");
  console.log("   /admin/leads     Lead pipeline");
  console.log("   /admin/analytics Revenue YTD + YoY + funnel + per-client");
  console.log("   /admin/marketing Scorecard pre-populated");
  console.log("   /book/astia-events Public booking page");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
