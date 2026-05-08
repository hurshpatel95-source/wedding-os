// Email-template library: list + create.
//
//   GET  /api/admin/email-templates              → list (org-scoped, RLS).
//        Optional ?kind=vendor_rfp filter for the inline composer dropdown.
//   POST /api/admin/email-templates              → create (org_admin only).
//
// Note: this is the SAVED-DRAFT library that planners build up over time —
// distinct from /lib/email-templates.ts which is the AI prompt template
// catalogue used by /api/email/draft.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailTemplateRow } from "@/lib/wave2-types";

export const runtime = "nodejs";

// Allowed kinds for the saved-template library. Mirrors the dropdown in
// the editor UI. `null` is also allowed in the DB but the editor always
// writes a concrete value.
const ALLOWED_KINDS = new Set([
  "vendor_rfp",
  "vendor_followup",
  "guest_save_the_date",
  "guest_rsvp_nudge",
  "guest_update",
  "contract_followup",
  "custom",
]);

interface ProfileRow {
  org_role?: string | null;
  org_id?: string | null;
}

async function loadProfile(userId: string) {
  const supabase = createClient();
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{ data: ProfileRow | null }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await loadProfile(user.id);
  if (!profile?.org_id) {
    return NextResponse.json({ error: "no org" }, { status: 403 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");

  type ListBuilder = {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: EmailTemplateRow[] | null }> & {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: EmailTemplateRow[] | null }>;
          };
        };
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: EmailTemplateRow[] | null }>;
      };
    };
  };

  const sb = supabase as unknown as ListBuilder;

  // RLS already restricts to org_id = auth_org_id(); the explicit eq is
  // defensive and lets us filter by kind too.
  let query = sb
    .from("email_templates")
    .select(
      "id, org_id, name, kind, subject, body, is_shared, use_count, last_used_at, created_by, created_at, updated_at",
    )
    .eq("org_id", profile.org_id);

  if (kind && ALLOWED_KINDS.has(kind)) {
    query = (
      query as unknown as {
        eq: (col: string, val: string) => typeof query;
      }
    ).eq("kind", kind);
  }

  const { data } = await query.order("name", { ascending: true });
  return NextResponse.json({ templates: (data ?? []) as EmailTemplateRow[] });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await loadProfile(user.id);
  if (profile?.org_role !== "org_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!profile.org_id) {
    return NextResponse.json({ error: "no org" }, { status: 400 });
  }

  let body: {
    name?: string;
    kind?: string | null;
    subject?: string;
    body?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const bodyText = (body.body ?? "").toString();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!bodyText.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const kind =
    typeof body.kind === "string" && ALLOWED_KINDS.has(body.kind)
      ? body.kind
      : null;

  const insertRow = {
    org_id: profile.org_id,
    name: name.slice(0, 240),
    kind,
    subject: subject.slice(0, 500),
    body: bodyText.slice(0, 32_000),
    created_by: user.id,
  };

  const sb = supabase as unknown as {
    from: (table: string) => {
      insert: (row: unknown) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data, error } = await sb
    .from("email_templates")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
