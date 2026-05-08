// POST /api/alerts/test
//
// Creates a test alert in the caller's workspace so QA / dev / a couple
// can verify the autopilot pipeline is wired correctly. Auth: signed-in
// user must belong to a workspace; the alert is inserted via the user's
// session (RLS will enforce workspace scope).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAlert } from "@/lib/alert-helpers";
import type { AlertSeverity, AlertAudience } from "@/lib/autopilot-types";

export const runtime = "nodejs";

interface TestAlertBody {
  title?: string;
  body?: string;
  severity?: AlertSeverity;
  audience?: AlertAudience;
  action_url?: string;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Only org_admins or members of a workspace can create test alerts.
  // We pull workspace_id + org_id off the users row.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              workspace_id?: string | null;
              org_id?: string | null;
              org_role?: string | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await sb
    .from("users")
    .select("workspace_id, org_id, org_role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.workspace_id || !profile.org_id) {
    return NextResponse.json(
      { error: "no workspace bound to your user" },
      { status: 400 },
    );
  }

  // Restrict to org_admins so couples can't spam this in prod. (They
  // wouldn't know the URL anyway; this is belt-and-braces.)
  if (profile.org_role !== "org_admin") {
    return NextResponse.json(
      { error: "org admin only" },
      { status: 403 },
    );
  }

  let body: TestAlertBody = {};
  try {
    body = (await request.json()) as TestAlertBody;
  } catch {
    body = {};
  }

  const result = await createAlert(supabase, {
    workspace_id: profile.workspace_id,
    org_id: profile.org_id,
    audience: body.audience ?? "both",
    kind: "test",
    severity: body.severity ?? "info",
    title:
      body.title ?? "Hey, autopilot wired itself up correctly",
    body:
      body.body ??
      "If you can see this in your alerts feed, the wave-3 pipeline is alive. You can dismiss this — it's just a hello.",
    action_url: body.action_url ?? "/autopilot",
    payload: { test: true, created_by: user.id },
  }).catch((err: Error) => ({ id: null, error: err.message }) as never);

  if (!("id" in result) || !result.id) {
    return NextResponse.json(
      { error: "alert creation failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: result.id });
}
