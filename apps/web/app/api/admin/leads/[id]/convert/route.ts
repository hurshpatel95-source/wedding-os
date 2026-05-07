// POST /api/admin/leads/[id]/convert
//
// Convert a lead row into a new client workspace. Mirrors the create-client
// flow at /api/admin/clients/new but pulls the workspace name + email
// directly from the lead, and stamps lead.converted_workspace_id +
// converted_at + status='converted' so the lead tracker stays consistent.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";

export const runtime = "nodejs";

function buildServiceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profileSb = supabase as unknown as {
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
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }

  // Load the lead via service role so we can read it regardless of session
  const service = buildServiceClient();
  const { data: leadRaw } = await (
    service as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: {
                id: string;
                org_id: string;
                couple_names: string | null;
                partner_a_name: string | null;
                partner_b_name: string | null;
                email: string | null;
                wedding_date: string | null;
                converted_workspace_id: string | null;
              } | null;
            }>;
          };
        };
      };
    }
  )
    .from("leads")
    .select(
      "id, org_id, couple_names, partner_a_name, partner_b_name, email, wedding_date, converted_workspace_id",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!leadRaw) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }
  if (leadRaw.org_id !== profile.org_id) {
    return NextResponse.json({ error: "lead in another org" }, { status: 403 });
  }
  if (leadRaw.converted_workspace_id) {
    return NextResponse.json(
      { error: "already converted", workspace_id: leadRaw.converted_workspace_id },
      { status: 409 },
    );
  }

  const warnings: string[] = [];

  const workspaceName =
    leadRaw.couple_names ||
    [leadRaw.partner_a_name, leadRaw.partner_b_name].filter(Boolean).join(" & ") ||
    `Lead ${params.id.slice(0, 8)}`;

  // 1. Create workspace
  const { data: workspace, error: wsErr } = await service
    .from("workspaces")
    .insert({
      org_id: profile.org_id,
      name: workspaceName,
      wedding_date: leadRaw.wedding_date ?? null,
    })
    .select("id, org_id")
    .single();
  if (wsErr || !workspace) {
    return NextResponse.json(
      { error: `Couldn't create workspace: ${wsErr?.message}` },
      { status: 500 },
    );
  }

  // 2. Magic-link the couple if they gave us an email
  let magicLink: string | null = null;
  let authUserId: string | null = null;
  if (leadRaw.email) {
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"}/auth/callback`;
    try {
      const { data: linkData, error: linkErr } =
        await service.auth.admin.generateLink({
          type: "magiclink",
          email: leadRaw.email,
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

    if (authUserId) {
      const { error: userErr } = await service.from("users").upsert(
        {
          id: authUserId,
          email: leadRaw.email,
          role: "couple",
          org_role: "member",
          org_id: workspace.org_id,
          workspace_id: workspace.id,
        },
        { onConflict: "id" },
      );
      if (userErr) warnings.push(`Couldn't link couple user: ${userErr.message}`);
    }
  } else {
    warnings.push("No email on the lead — couple wasn't invited.");
  }

  // 3. Default branding row
  await service
    .from("workspace_branding")
    .upsert({ workspace_id: workspace.id }, { onConflict: "workspace_id" });

  // 4. Stamp the lead
  const { error: updErr } = await (
    service as unknown as {
      from: (t: string) => {
        update: (row: unknown) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("leads")
    .update({
      status: "converted",
      converted_workspace_id: workspace.id,
      converted_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  if (updErr) warnings.push(`Lead status update failed: ${updErr.message}`);

  return NextResponse.json({
    ok: true,
    workspace_id: workspace.id,
    magic_link: magicLink,
    warnings,
  });
}
