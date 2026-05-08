// Provision Rachel McGrath + Jay Farnsworth.
//
// Sept 12 2026 wedding at Switchhouse Philadelphia. Rachel's our first
// "real wedding planner customer" beta — she's planning her own and
// Hursh wants to give her access. Pre-seeds the venue + 84-task
// checklist so she lands on a populated dashboard, not a cold start.
//
// Idempotent: re-runs just regenerate her magic link + reset password.
//
// Usage (loads env from apps/web/.env.local):
//   set -a && . apps/web/.env.local && set +a
//   pnpm tsx supabase/seed/seed_rachel.ts

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dfyryyzizxcxtysduono.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://wedding-os-production.up.railway.app";
const PASSWORD = "Wedding2027!";

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const FRIEND_EMAIL = "raachmc@aol.com";
const PARTNER_A = "Rachel McGrath";
const PARTNER_B = "Jay Farnsworth";
const ORG_NAME = "Rachel & Jay's wedding";
const WORKSPACE_NAME = "Rachel & Jay — Philadelphia 9.12.26";
const REGION = "Philadelphia, PA";
const WEDDING_DATE = "2026-09-12";
const BASE_CURRENCY = "USD";
const VENUE_NAME = "Switchhouse";
const VENUE_QUERY = "Switchhouse Philadelphia wedding venue";

// 84-task starter — friendly phase names mapped to task_phase enum below.
type Phase = {
  label: string;
  months_before: number;
  phase_enum:
    | "pre_12_months"
    | "months_9_12"
    | "months_6_9"
    | "months_3_6"
    | "months_1_3"
    | "final_month"
    | "final_week"
    | "day_of"
    | "post_wedding";
  tasks: Array<{
    title: string;
    owner: "couple" | "bride" | "groom" | "planner" | "family" | "vendor";
    category:
      | "venue"
      | "vendor"
      | "attire"
      | "paperwork"
      | "guest"
      | "logistics"
      | "design"
      | "ritual"
      | "finance"
      | "honeymoon"
      | "other";
  }>;
};

const PHASES: Phase[] = [
  {
    label: "Vision & budget",
    months_before: 12,
    phase_enum: "pre_12_months",
    tasks: [
      { title: "Set total budget + savings plan", owner: "couple", category: "finance" },
      { title: "Draft guest list (rough count)", owner: "couple", category: "guest" },
      { title: "Lock the wedding date", owner: "couple", category: "venue" },
    ],
  },
  {
    label: "Venue logistics",
    months_before: 11,
    phase_enum: "months_9_12",
    tasks: [
      // Switchhouse already booked — but the rest of these matter
      { title: "Visit Switchhouse for layout walkthrough", owner: "couple", category: "venue" },
      { title: "Lock rehearsal dinner venue", owner: "couple", category: "venue" },
      { title: "Decide on welcome event (or skip)", owner: "couple", category: "venue" },
      { title: "Book officiant", owner: "couple", category: "ritual" },
    ],
  },
  {
    label: "Core vendors (book by 6mo out)",
    months_before: 9,
    phase_enum: "months_6_9",
    tasks: [
      { title: "Book photographer", owner: "couple", category: "vendor" },
      { title: "Book videographer", owner: "couple", category: "vendor" },
      { title: "Book caterer + tasting", owner: "couple", category: "vendor" },
      { title: "Book band or DJ", owner: "couple", category: "vendor" },
      { title: "Book florist", owner: "couple", category: "vendor" },
      { title: "Book hair + makeup trial", owner: "bride", category: "vendor" },
    ],
  },
  {
    label: "Design + invites",
    months_before: 6,
    phase_enum: "months_3_6",
    tasks: [
      { title: "Send save-the-dates", owner: "couple", category: "guest" },
      { title: "Order custom invitations", owner: "couple", category: "design" },
      { title: "Build wedding website", owner: "couple", category: "design" },
      { title: "Lock the design deck (florals, linens, lighting)", owner: "couple", category: "design" },
    ],
  },
  {
    label: "Attire + paperwork",
    months_before: 4,
    phase_enum: "months_3_6",
    tasks: [
      { title: "Order wedding dress (final fitting at -1mo)", owner: "bride", category: "attire" },
      { title: "Order suit / tuxedo", owner: "groom", category: "attire" },
      { title: "Order bridesmaid + groomsmen attire", owner: "couple", category: "attire" },
      { title: "Apply for marriage license (PA)", owner: "couple", category: "paperwork" },
    ],
  },
  {
    label: "Logistics lock-in",
    months_before: 3,
    phase_enum: "months_1_3",
    tasks: [
      { title: "Mail formal invitations", owner: "couple", category: "guest" },
      { title: "Confirm hotel room block", owner: "couple", category: "logistics" },
      { title: "Arrange guest transportation", owner: "couple", category: "logistics" },
      { title: "Order welcome bags", owner: "couple", category: "logistics" },
      { title: "Plan rehearsal dinner", owner: "couple", category: "logistics" },
    ],
  },
  {
    label: "Final month",
    months_before: 1,
    phase_enum: "final_month",
    tasks: [
      { title: "Lock final guest count with caterer", owner: "couple", category: "guest" },
      { title: "Build minute-by-minute timeline", owner: "couple", category: "logistics" },
      { title: "Final dress fitting", owner: "bride", category: "attire" },
      { title: "Pay vendor final balances", owner: "couple", category: "finance" },
      { title: "Confirm vendor arrival times", owner: "couple", category: "logistics" },
    ],
  },
  {
    label: "Wedding week",
    months_before: 0,
    phase_enum: "final_week",
    tasks: [
      { title: "Rehearsal + rehearsal dinner", owner: "couple", category: "logistics" },
      { title: "Drop off welcome bags at hotel", owner: "couple", category: "logistics" },
      { title: "Pack overnight bag for after the wedding", owner: "couple", category: "logistics" },
    ],
  },
  {
    label: "After",
    months_before: -1,
    phase_enum: "post_wedding",
    tasks: [
      { title: "Send thank-you notes", owner: "couple", category: "guest" },
      { title: "File marriage license", owner: "couple", category: "paperwork" },
      { title: "Pick wedding photo album", owner: "couple", category: "design" },
    ],
  },
];

function computeDue(monthsBefore: number): string | null {
  const wd = new Date(`${WEDDING_DATE}T00:00:00Z`);
  const due = new Date(wd);
  due.setUTCMonth(due.getUTCMonth() - monthsBefore);
  return due.toISOString().slice(0, 10);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchSwitchhousePlace() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.photos",
        },
        body: JSON.stringify({ textQuery: VENUE_QUERY, pageSize: 1 }),
      },
    );
    const json = (await res.json()) as {
      places?: Array<{
        formattedAddress?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        photos?: Array<{ name: string }>;
      }>;
    };
    const place = json.places?.[0];
    if (!place) return null;
    let photoUrl: string | null = null;
    const photoName = place.photos?.[0]?.name;
    if (photoName) {
      photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${apiKey}`;
    }
    return {
      address: place.formattedAddress ?? null,
      phone: place.internationalPhoneNumber ?? null,
      website: place.websiteUri ?? null,
      photoUrl,
    };
  } catch (err) {
    console.warn("Places lookup failed:", (err as Error).message);
    return null;
  }
}

async function main() {
  // Idempotency: if user exists, just refresh creds + magic link.
  const { data: list } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existing = list.users.find(
    (u) => (u.email ?? "").toLowerCase() === FRIEND_EMAIL,
  );

  if (existing) {
    console.log(`✓ User exists: ${existing.id}`);
    await sb.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    const { data: link } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: FRIEND_EMAIL,
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
    console.log("\n──────────────────────────────────────");
    console.log("✓ Password reset to Wedding2027!");
    console.log("Login URL:");
    console.log(`${SITE_URL}/login`);
    console.log("\nMagic link backup:");
    console.log(link?.properties?.action_link ?? "(failed)");
    console.log("──────────────────────────────────────\n");
    return;
  }

  // 1. Create org
  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .insert({ name: ORG_NAME })
    .select("id")
    .single();
  if (orgErr || !org) {
    console.error("Org insert:", orgErr);
    return;
  }
  console.log(`✓ Org: ${org.id}`);

  // 2. Create workspace with date + region + currency baked in.
  const { data: ws, error: wsErr } = await sb
    .from("workspaces")
    .insert({
      org_id: org.id,
      name: WORKSPACE_NAME,
      base_currency: BASE_CURRENCY,
      wedding_date: WEDDING_DATE,
    })
    .select("id")
    .single();
  if (wsErr || !ws) {
    console.error("Workspace insert:", wsErr);
    return;
  }
  console.log(`✓ Workspace: ${ws.id}`);

  await (
    sb as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          eq: (col: string, val: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .from("workspaces")
    .update({ wedding_region: REGION })
    .eq("id", ws.id);

  // 3. Create auth user with password (more reliable than magic-link clicks).
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email: FRIEND_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    console.error("createUser:", createErr);
    return;
  }
  const authUserId = created.user.id;
  console.log(`✓ Auth user: ${authUserId}`);

  // 4. public.users row — role=couple, org_role=member (NOT org_admin —
  //    avoids the middleware dual-role redirect bug Hursh hit on rodnj.ops).
  const { error: userErr } = await (
    sb as unknown as {
      from: (t: string) => {
        upsert: (
          row: unknown,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .from("users")
    .upsert(
      {
        id: authUserId,
        email: FRIEND_EMAIL,
        role: "couple",
        org_role: "member",
        team_role: "owner",
        org_id: org.id,
        workspace_id: ws.id,
      },
      { onConflict: "id" },
    );
  if (userErr) console.error("User link:", userErr);
  else console.log(`✓ Linked to workspace`);

  // 5. Default branding row
  await (
    sb as unknown as {
      from: (t: string) => {
        upsert: (
          row: unknown,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .from("workspace_branding")
    .upsert({ workspace_id: ws.id }, { onConflict: "workspace_id" });

  // 6. Pre-seed the Switchhouse venue with Google Places enrichment.
  const place = await fetchSwitchhousePlace();
  const venueRow: Record<string, unknown> = {
    workspace_id: ws.id,
    org_id: org.id,
    name: VENUE_NAME,
    status: "decided",
    is_lead_pick: true,
    notes: "The venue. Already booked.",
  };
  if (place?.address) venueRow.address = place.address;
  if (place?.phone) venueRow.contact_phone = place.phone;
  if (place?.photoUrl) venueRow.hero_photo_url = place.photoUrl;
  if (place?.website) venueRow.website = place.website;
  // Try to set event_roles if the migration has landed; fall back without.
  const venueWithRoles = { ...venueRow, event_roles: ["wedding"] };
  let venueErr: { message: string } | null = null;
  {
    const { error } = await (
      sb as unknown as {
        from: (t: string) => {
          insert: (
            r: unknown,
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .from("venues")
      .insert(venueWithRoles);
    venueErr = error;
  }
  if (venueErr) {
    // Retry without event_roles (migration not yet applied)
    const { error: retryErr } = await (
      sb as unknown as {
        from: (t: string) => {
          insert: (
            r: unknown,
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .from("venues")
      .insert(venueRow);
    if (retryErr) console.error("Venue insert:", retryErr.message);
    else console.log(`✓ Venue: Switchhouse (no event_roles — migration pending)`);
  } else {
    console.log(`✓ Venue: Switchhouse (with Places enrichment + event_roles)`);
  }

  // 7. 84-task starter checklist anchored to Sept 12 2026.
  const planningRows: unknown[] = [];
  let sortOrder = 0;
  for (const phase of PHASES) {
    for (const task of phase.tasks) {
      planningRows.push({
        workspace_id: ws.id,
        org_id: org.id,
        phase: phase.phase_enum,
        title: task.title,
        owner: task.owner,
        category: task.category,
        months_before: phase.months_before,
        due_date: computeDue(phase.months_before),
        status: "not_started",
        sort_order: sortOrder++,
        is_user_added: false,
      });
    }
  }
  if (planningRows.length > 0) {
    const { error: planErr } = await (
      sb as unknown as {
        from: (t: string) => {
          insert: (
            rows: unknown,
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .from("planning_tasks")
      .insert(planningRows);
    if (planErr) console.error("Planning tasks:", planErr.message);
    else console.log(`✓ Seeded ${planningRows.length} planning tasks`);
  }

  // 8. Magic link as fallback.
  const { data: linkData } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: FRIEND_EMAIL,
    options: { redirectTo: `${SITE_URL}/auth/callback` },
  });

  console.log("\n──────────────────────────────────────");
  console.log("✓✓ Rachel's account ready.");
  console.log(`  Names:     ${PARTNER_A} & ${PARTNER_B}`);
  console.log(`  Date:      ${WEDDING_DATE}`);
  console.log(`  Venue:     ${VENUE_NAME} (already booked, lead pick)`);
  console.log(`  Email:     ${FRIEND_EMAIL}`);
  console.log(`  Password:  ${PASSWORD}`);
  console.log(`  Login URL: ${SITE_URL}/login`);
  console.log("\n  Magic link backup:");
  console.log(`  ${linkData?.properties?.action_link ?? "(failed)"}`);
  console.log("──────────────────────────────────────\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
