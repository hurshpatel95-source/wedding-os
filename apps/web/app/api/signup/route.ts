// POST /api/signup
//
// Self-serve planner signup. Creates a brand-new organization, magic-links
// the planner's email, links them as the org_admin user. They land in
// /admin on first sign-in.
//
// SECURITY: anyone can hit this — soft rate-limited per IP. The org is
// created via service-role.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import { isValidEmail, sanitizeText } from "@/lib/lead-types";

export const runtime = "nodejs";

function buildServiceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

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

interface SignupBody {
  studio_name?: string;
  your_name?: string;
  email?: string;
  website?: string | null;
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!ratelimit(ip)) {
    return NextResponse.json({ error: "rate limited — try again soon" }, { status: 429 });
  }

  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const studioName = sanitizeText(body.studio_name, 120);
  const yourName = sanitizeText(body.your_name, 120);
  const email = (body.email ?? "").trim().toLowerCase();
  const website = sanitizeText(body.website, 256);

  if (!studioName) {
    return NextResponse.json({ error: "studio_name required" }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const service = buildServiceClient();
  const warnings: string[] = [];

  // 1. Create the organization
  const { data: org, error: orgErr } = await service
    .from("organizations")
    .insert({ name: studioName })
    .select("id")
    .single();
  if (orgErr || !org) {
    return NextResponse.json(
      { error: `Couldn't create org: ${orgErr?.message}` },
      { status: 500 },
    );
  }

  // 1b. Default sandbox workspace. The DB schema requires every user to have
  // a workspace_id; org_admins typically work cross-workspace via the /admin
  // shell, but we still need a row to satisfy the FK. They can rename or
  // delete this once they create a real client.
  const { data: defaultWs, error: defaultWsErr } = await service
    .from("workspaces")
    .insert({
      org_id: org.id,
      name: "Sandbox",
    })
    .select("id")
    .single();
  if (defaultWsErr || !defaultWs) {
    return NextResponse.json(
      { error: `Couldn't create default workspace: ${defaultWsErr?.message}` },
      { status: 500 },
    );
  }

  // 2. Magic-link the planner
  let magicLink: string | null = null;
  let authUserId: string | null = null;
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"}/auth/callback`;

  try {
    const { data: linkData, error: linkErr } =
      await service.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
    if (linkErr) {
      warnings.push(`Magic link generation failed: ${linkErr.message}`);
    } else {
      magicLink = linkData.properties?.action_link ?? null;
      authUserId = linkData.user?.id ?? null;
    }
  } catch (err) {
    warnings.push(`Magic link error: ${(err as Error).message}`);
  }

  // 3. Resolve auth user id if needed
  if (!authUserId) {
    try {
      const { data: list } = await service.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const match = list.users.find(
        (u) => (u.email ?? "").toLowerCase() === email,
      );
      authUserId = match?.id ?? null;
    } catch (err) {
      warnings.push(`listUsers error: ${(err as Error).message}`);
    }
  }

  // 4. Insert public.users row as org_admin
  if (authUserId) {
    const { error: userErr } = await service.from("users").upsert(
      {
        id: authUserId,
        email,
        role: "admin",
        org_role: "org_admin",
        org_id: org.id,
        workspace_id: defaultWs.id,
      },
      { onConflict: "id" },
    );
    if (userErr) {
      warnings.push(`User link failed: ${userErr.message}`);
    }
  } else {
    warnings.push("Auth user could not be resolved");
  }

  // 5. Stash the website so a marketing scorecard can later be run against it
  if (website) {
    try {
      await (
        service as unknown as {
          from: (t: string) => {
            insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
          };
        }
      )
        .from("marketing_scorecards")
        .insert({
          org_id: org.id,
          url: website,
          // Empty stub; the agent will fill these in when run
          scorecard_md: null,
          recommendations: [],
        });
    } catch (err) {
      warnings.push(`Scorecard stub failed: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    org_id: org.id,
    user_id: authUserId,
    magic_link: magicLink,
    warnings,
    your_name: yourName,
  });
}
