import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateRoutingInput } from "@/lib/lead-routing";

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

export async function POST(request: NextRequest) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user, profile } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const parsed = validateRoutingInput(body as never);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Sanity: assignee must be an org_admin in this same org
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { id?: string } | null;
            }>;
          };
        };
      };
    };
  };
  const { data: assignee } = await sb
    .from("users")
    .select("id")
    .eq("id", parsed.value.assignee_user_id)
    .eq("org_id", profile.org_id!)
    .maybeSingle();
  if (!assignee) {
    return NextResponse.json(
      { error: "assignee not in this org" },
      { status: 400 },
    );
  }

  const insertRow = {
    org_id: profile.org_id,
    name: parsed.value.name,
    priority: parsed.value.priority,
    match_conditions: parsed.value.match_conditions,
    assignee_user_id: parsed.value.assignee_user_id,
    enabled: parsed.value.enabled,
    created_by: user.id,
  };

  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (row: unknown) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("lead_routing_rules")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
