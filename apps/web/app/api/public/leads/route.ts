import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import { isValidEmail, sanitizeText, type LeadRow } from "@/lib/lead-types";
import { pickMatchingRule } from "@/lib/lead-routing";
import type { LeadRoutingRuleRow } from "@/lib/wave2-types";

export const runtime = "nodejs";

// Lead capture is anon → service-role. We never expose the leads table to
// the anon role; instead this route validates the payload, enforces a soft
// rate limit per IP, and inserts via service-role. The org is identified
// by public_slug (booking_page) or public_workspace_slug (public_wedding_site).
function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// In-memory soft rate limit (process-local; Railway-friendly because each
// dyno is independent — defence-in-depth against the obvious form spam).
const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_HOUR = 8;

function ratelimit(key: string): boolean {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key);
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_PER_HOUR) return false;
  bucket.count += 1;
  return true;
}

interface LeadInsertBody {
  // Required identifying scope
  orgSlug?: string;                 // /book/<slug> path
  workspaceSlug?: string;           // /w/<slug> referral
  source: "booking_page" | "public_wedding_site";
  // Couple data (all sanitized)
  couple_names?: string;
  partner_a_name?: string;
  partner_b_name?: string;
  email?: string;
  phone?: string;
  wedding_date?: string;            // YYYY-MM-DD
  guest_count?: number;
  budget_band?: string;
  city_or_region?: string;
  notes?: string;
  // Optional — set when they pick a slot
  scheduled_call_at?: string;       // ISO
  scheduled_call_duration_minutes?: number;
  // Optional honeypot — bots will fill this; humans won't
  website?: string;
  // utm/page metadata
  page_path?: string;
  utm?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  let body: LeadInsertBody;
  try {
    body = (await request.json()) as LeadInsertBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Honeypot — silent reject so bots don't learn
  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (body.source !== "booking_page" && body.source !== "public_wedding_site") {
    return NextResponse.json({ error: "invalid source" }, { status: 400 });
  }

  // IP rate-limit (header is best-effort behind Railway's proxy)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!ratelimit(ip)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const sb = adminClient();

  // Resolve org_id from the identifying slug
  let org_id: string | null = null;
  let referring_workspace_id: string | null = null;

  if (body.source === "booking_page") {
    if (!body.orgSlug) {
      return NextResponse.json({ error: "missing orgSlug" }, { status: 400 });
    }
    const { data: org } = await sb
      .from("organizations" as never)
      .select("id")
      .eq("public_slug" as never, body.orgSlug as never)
      .maybeSingle();
    org_id = (org as { id?: string } | null)?.id ?? null;
  } else {
    if (!body.workspaceSlug) {
      return NextResponse.json({ error: "missing workspaceSlug" }, { status: 400 });
    }
    const { data: ws } = await sb
      .from("workspaces")
      .select("id, org_id")
      .eq("public_slug", body.workspaceSlug)
      .maybeSingle();
    if (ws) {
      org_id = (ws as { org_id?: string }).org_id ?? null;
      referring_workspace_id = (ws as { id?: string }).id ?? null;
    }
  }

  if (!org_id) {
    return NextResponse.json({ error: "org not found" }, { status: 404 });
  }

  // Validate email shape (we accept missing email — phone-only is fine)
  if (body.email && !isValidEmail(body.email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  // Need at least ONE of email or phone OR couple_names — otherwise it's a noise row
  const hasContact =
    !!body.email ||
    !!body.phone ||
    !!body.couple_names ||
    !!body.partner_a_name;
  if (!hasContact) {
    return NextResponse.json(
      { error: "need at least one contact field" },
      { status: 400 },
    );
  }

  // Reasonable bounds — we don't trust the client
  let guestCount: number | null = null;
  if (typeof body.guest_count === "number" && Number.isFinite(body.guest_count)) {
    guestCount = Math.max(0, Math.min(2000, Math.floor(body.guest_count)));
  }

  let weddingDate: string | null = null;
  if (typeof body.wedding_date === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(body.wedding_date)) {
      weddingDate = body.wedding_date;
    }
  }

  let scheduledCallAt: string | null = null;
  let scheduledDuration: number | null = null;
  if (body.scheduled_call_at) {
    const d = new Date(body.scheduled_call_at);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
      scheduledCallAt = d.toISOString();
      scheduledDuration =
        typeof body.scheduled_call_duration_minutes === "number"
          ? Math.max(15, Math.min(180, body.scheduled_call_duration_minutes))
          : 45;
    }
  }

  const metadata: Record<string, unknown> = {};
  if (body.page_path) metadata.page_path = sanitizeText(body.page_path, 256);
  if (body.utm && typeof body.utm === "object") {
    metadata.utm = Object.fromEntries(
      Object.entries(body.utm).slice(0, 10).map(([k, v]) => [
        k.slice(0, 32),
        sanitizeText(v, 256),
      ]),
    );
  }

  const insertRow = {
    org_id,
    referring_workspace_id,
    source: body.source,
    status: scheduledCallAt ? "booked_call" : "new",
    couple_names: sanitizeText(body.couple_names, 200),
    partner_a_name: sanitizeText(body.partner_a_name, 100),
    partner_b_name: sanitizeText(body.partner_b_name, 100),
    email: sanitizeText(body.email, 254),
    phone: sanitizeText(body.phone, 60),
    wedding_date: weddingDate,
    guest_count: guestCount,
    budget_band: sanitizeText(body.budget_band, 60),
    city_or_region: sanitizeText(body.city_or_region, 200),
    notes: sanitizeText(body.notes, 4000),
    scheduled_call_at: scheduledCallAt,
    scheduled_call_duration_minutes: scheduledDuration,
    metadata,
  };

  const { data, error } = await (
    sb as unknown as {
      from: (t: string) => {
        insert: (row: unknown) => {
          select: (cols: string) => {
            single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
          };
        };
      };
    }
  )
    .from("leads")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ─── Auto-routing ────────────────────────────────────────────────
  // Best-effort: pull the org's enabled rules ordered by priority asc and
  // assign the first match. Failures here MUST NOT fail the lead capture.
  const newLeadId = data?.id ?? null;
  if (newLeadId) {
    try {
      const rulesSb = sb as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (
                col: string,
                val: boolean,
              ) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => Promise<{ data: LeadRoutingRuleRow[] | null }>;
              };
            };
          };
        };
      };
      const { data: rulesData } = await rulesSb
        .from("lead_routing_rules")
        .select(
          "id, org_id, name, priority, match_conditions, assignee_user_id, enabled, created_by, created_at, updated_at",
        )
        .eq("org_id", org_id)
        .eq("enabled", true)
        .order("priority", { ascending: true });

      const rules = (rulesData ?? []) as LeadRoutingRuleRow[];
      if (rules.length > 0) {
        const leadShape: Partial<LeadRow> = {
          source: insertRow.source as LeadRow["source"],
          budget_band: insertRow.budget_band ?? null,
          city_or_region: insertRow.city_or_region ?? null,
          guest_count: insertRow.guest_count ?? null,
        };
        const match = pickMatchingRule(leadShape, rules);
        if (match) {
          await (
            sb as unknown as {
              from: (t: string) => {
                update: (row: unknown) => {
                  eq: (
                    col: string,
                    val: string,
                  ) => Promise<{ error: { message: string } | null }>;
                };
              };
            }
          )
            .from("leads")
            .update({ assigned_to_user_id: match.assignee_user_id })
            .eq("id", newLeadId);
        }
      }
    } catch (routingErr) {
      // Log and continue — routing failures must never block lead creation.
      console.error("lead routing failed", routingErr);
    }
  }

  return NextResponse.json({ ok: true, id: newLeadId });
}
