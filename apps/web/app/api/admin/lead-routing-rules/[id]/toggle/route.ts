import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function requireOrgAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 as const };

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };

  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return { error: "org admin only", status: 403 as const };
  }
  return { supabase, user, profile };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, profile } = auth;

  let body: { enabled?: boolean } = {};
  try {
    body = (await request.json()) as { enabled?: boolean };
  } catch {
    // empty body — flip semantics handled below
  }

  // If caller passes an explicit boolean, honour it. Otherwise, toggle.
  let nextEnabled: boolean;
  if (typeof body.enabled === "boolean") {
    nextEnabled = body.enabled;
  } else {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: { enabled?: boolean } | null;
              }>;
            };
          };
        };
      };
    };
    const { data: existing } = await sb
      .from("lead_routing_rules")
      .select("enabled")
      .eq("id", params.id)
      .eq("org_id", profile.org_id!)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    nextEnabled = !existing.enabled;
  }

  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          eq: (col: string, val: string) => {
            eq: (
              col: string,
              val: string,
            ) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    }
  )
    .from("lead_routing_rules")
    .update({ enabled: nextEnabled })
    .eq("id", params.id)
    .eq("org_id", profile.org_id!);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enabled: nextEnabled });
}
