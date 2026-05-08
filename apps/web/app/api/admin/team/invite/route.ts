// POST /api/admin/team/invite
//
// Invite a new collaborator to the planner team. Mirrors the magic-link
// pattern in /api/admin/clients/new.
//
// Steps:
//   1. Caller must be org_admin AND team_role='owner'.
//   2. Validate email shape + team_role ∈ {planner, assistant}.
//   3. service.auth.admin.generateLink({ type: 'magiclink' }) — creates the
//      auth.users row implicitly when the email isn't already present.
//   4. Upsert public.users with role='admin', org_role='org_admin',
//      team_role=req.team_role, workspace_id pinned to the owner's
//      workspace_id (placeholder — team members aren't tied to one couple).
//   5. Return { user_id, magic_link, warnings[] }.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import { isValidEmail } from "@/lib/lead-types";
import type {
  InviteTeammateRequest,
  InviteTeammateResponse,
} from "@/lib/admin-team-types";

export const runtime = "nodejs";

function buildServiceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase service role key not configured on the server." },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Look up caller's profile (org admin + owner gate, plus we need the
  // workspace_id placeholder for the new row).
  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: {
              org_role?: string | null;
              org_id?: string | null;
              workspace_id?: string | null;
              team_role?: string | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id, workspace_id, team_role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return NextResponse.json(
      { error: "no profile / org for caller" },
      { status: 403 },
    );
  }
  if (profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }
  if (profile.team_role !== "owner") {
    return NextResponse.json(
      { error: "only the studio owner can invite team members" },
      { status: 403 },
    );
  }

  let body: InviteTeammateRequest;
  try {
    body = (await request.json()) as InviteTeammateRequest;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const inviteEmail = body.email?.trim().toLowerCase();
  if (!inviteEmail || !isValidEmail(inviteEmail)) {
    return NextResponse.json(
      { error: "valid email is required" },
      { status: 400 },
    );
  }
  if (body.team_role !== "planner" && body.team_role !== "assistant") {
    return NextResponse.json(
      { error: "team_role must be 'planner' or 'assistant'" },
      { status: 400 },
    );
  }

  const service = buildServiceClient();
  const warnings: string[] = [];

  // 1. Magic link / auth user creation.
  let magicLink: string | null = null;
  let authUserId: string | null = null;
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"}/auth/callback`;
  try {
    const { data: linkData, error: linkErr } =
      await service.auth.admin.generateLink({
        type: "magiclink",
        email: inviteEmail,
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

  // 2. Resolve auth user id by email if generateLink didn't return it.
  if (!authUserId) {
    try {
      const { data: list, error: listErr } =
        await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        warnings.push(`listUsers failed: ${listErr.message}`);
      } else {
        const match = list.users.find(
          (u) => (u.email ?? "").toLowerCase() === inviteEmail,
        );
        authUserId = match?.id ?? null;
      }
    } catch (err) {
      warnings.push(`listUsers error: ${(err as Error).message}`);
    }
  }

  // 3. Upsert the public.users row.
  if (authUserId) {
    // team_role isn't yet in the generated Database types — cast through
    // unknown so the Supabase client accepts the extra column.
    const userRow = {
      id: authUserId,
      email: inviteEmail,
      role: "admin" as const,
      org_role: "org_admin" as const,
      org_id: profile.org_id,
      // The owner's workspace is used as a placeholder so the NOT NULL
      // workspace_id column has something. Team members aren't tied to a
      // specific couple — they have org-wide org_admin access via RLS.
      workspace_id: profile.workspace_id,
      team_role: body.team_role,
    };
    const { error: userErr } = await (
      service as unknown as {
        from: (t: string) => {
          upsert: (
            row: unknown,
            opts: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .from("users")
      .upsert(userRow, { onConflict: "id" });

    if (userErr) {
      warnings.push(`Couldn't link teammate user: ${userErr.message}`);
    }
  } else {
    warnings.push(
      "auth.user could not be resolved — invite the user manually after they sign in once.",
    );
  }

  const response: InviteTeammateResponse = {
    user_id: authUserId,
    magic_link: magicLink,
    warnings,
  };
  return NextResponse.json(response);
}
