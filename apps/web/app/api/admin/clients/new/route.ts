// POST /api/admin/clients/new
//
// Creates a fresh couple workspace inside the calling org_admin's organization.
// Steps:
//   1. Validate the caller is an org_admin (via auth_org_role()).
//   2. Insert workspaces row.
//   3. Use Supabase admin API to invite or generate a magic link for the couple
//      (mirrors `supabase/seed/gen_magic_link.ts`).
//   4. Insert the linked public.users row (role='couple', org_role='member').
//   5. Insert the default workspace_branding row.
//   6. (Optional) call the playbook-apply route owned by Agent C.
//
// Magic-link / admin-create-user need service_role; everything else can ride on
// the caller's authenticated cookie session and stay RLS-safe.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type {
  NewClientRequest,
  NewClientResponse,
} from "@/lib/admin-onboarding-types";

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

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
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

  if (!profile?.org_id) {
    return NextResponse.json(
      { error: "no profile / org for caller" },
      { status: 403 },
    );
  }
  if (profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }

  let body: NewClientRequest;
  try {
    body = (await request.json()) as NewClientRequest;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const coupleEmail = body.couple_email?.trim().toLowerCase();
  const workspaceName = body.workspace_name?.trim();
  if (!coupleEmail || !workspaceName) {
    return NextResponse.json(
      { error: "couple_email and workspace_name are required" },
      { status: 400 },
    );
  }
  // light email shape check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coupleEmail)) {
    return NextResponse.json(
      { error: "couple_email looks invalid" },
      { status: 400 },
    );
  }

  const service = buildServiceClient();
  const warnings: string[] = [];

  // 1. Insert the workspaces row (service-role to keep this transactional from
  //    the planner's session, since the admin already passed the org-admin gate
  //    above). org_id pinned to caller's org.
  const { data: workspace, error: wsErr } = await service
    .from("workspaces")
    .insert({
      org_id: profile.org_id,
      name: workspaceName,
      wedding_date: body.wedding_date ?? null,
    })
    .select("id, org_id")
    .single();
  if (wsErr || !workspace) {
    return NextResponse.json(
      { error: `Couldn't create workspace: ${wsErr?.message}` },
      { status: 500 },
    );
  }

  // 2. Magic link / user creation. We use generateLink with type=magiclink.
  //    Supabase's generateLink will create the auth.users row implicitly when
  //    the email isn't found, and return the action_link to share manually.
  let magicLink: string | null = null;
  let authUserId: string | null = null;
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"}/auth/callback`;
  try {
    const { data: linkData, error: linkErr } =
      await service.auth.admin.generateLink({
        type: "magiclink",
        email: coupleEmail,
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

  // 3. Resolve auth user id by email if we didn't get it back from generateLink.
  if (!authUserId) {
    try {
      const { data: list, error: listErr } =
        await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        warnings.push(`listUsers failed: ${listErr.message}`);
      } else {
        const match = list.users.find(
          (u) => (u.email ?? "").toLowerCase() === coupleEmail,
        );
        authUserId = match?.id ?? null;
      }
    } catch (err) {
      warnings.push(`listUsers error: ${(err as Error).message}`);
    }
  }

  // 4. Insert the public.users row linking auth → workspace.
  if (authUserId) {
    const { error: userErr } = await service.from("users").upsert(
      {
        id: authUserId,
        email: coupleEmail,
        role: "couple",
        org_role: "member",
        org_id: workspace.org_id,
        workspace_id: workspace.id,
      },
      { onConflict: "id" },
    );
    if (userErr) {
      warnings.push(`Couldn't link couple user: ${userErr.message}`);
    }
  } else {
    warnings.push(
      "Couple auth.user could not be resolved — link the user manually after they sign in once.",
    );
  }

  // 5. Default branding row.
  {
    const { error: brandErr } = await service
      .from("workspace_branding")
      .upsert(
        { workspace_id: workspace.id },
        { onConflict: "workspace_id" },
      );
    if (brandErr) {
      warnings.push(`Branding default insert failed: ${brandErr.message}`);
    }
  }

  // 6. Optional: apply playbook (stub — graceful 404 if Agent C hasn't merged).
  let playbookApplied = false;
  if (body.apply_playbook) {
    try {
      const origin =
        request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        "localhost:3200";
      const proto =
        request.headers.get("x-forwarded-proto") ??
        (origin.startsWith("localhost") ? "http" : "https");
      const url = `${proto}://${origin}/api/admin/playbook/apply`;
      const cookie = request.headers.get("cookie") ?? "";
      const playbookRes = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // forward the planner's auth so Agent C's route can run RLS as them
          cookie,
        },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      if (playbookRes.status === 404) {
        warnings.push(
          "Playbook editor not yet live — skipped applying default playbook.",
        );
      } else if (!playbookRes.ok) {
        const t = await playbookRes.text();
        warnings.push(`Playbook apply returned ${playbookRes.status}: ${t}`);
      } else {
        playbookApplied = true;
      }
    } catch (err) {
      warnings.push(`Playbook apply call failed: ${(err as Error).message}`);
    }
  }

  const response: NewClientResponse = {
    workspace_id: workspace.id,
    user_id: authUserId,
    magic_link: magicLink,
    playbook_applied: playbookApplied,
    warnings,
  };
  return NextResponse.json(response);
}
