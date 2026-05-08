import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import { sendAndLogEmail } from "@/lib/email-send";

export const runtime = "nodejs";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface ProposalLite {
  id: string;
  org_id: string;
  workspace_id: string | null;
  lead_id: string | null;
  title: string;
  status: string;
}

interface LeadLite {
  email: string | null;
  couple_names: string | null;
  partner_a_name: string | null;
  partner_b_name: string | null;
}

interface OrgLite {
  contact_email: string | null;
  name: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isUuid(params.token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  let body: { reason?: string | null };
  try {
    body = (await request.json()) as { reason?: string | null };
  } catch {
    body = {};
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.slice(0, 2000)
      : null;

  const sb = adminClient();

  const { data: prop } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: ProposalLite | null }>;
          };
        };
      };
    }
  )
    .from("proposals")
    .select("id, org_id, workspace_id, lead_id, title, status")
    .eq("public_token", params.token)
    .maybeSingle();

  if (!prop) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (prop.status === "rejected") {
    return NextResponse.json({ ok: true, already: true });
  }
  if (prop.status !== "sent" && prop.status !== "viewed") {
    return NextResponse.json(
      { error: `cannot decline a ${prop.status} proposal` },
      { status: 409 },
    );
  }

  const { error } = await (
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
    .from("proposals")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", prop.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the planner only — no point pinging a couple who just declined.
  try {
    await notifyPlannerOfDecline(sb, prop, reason);
  } catch (e) {
    console.warn(
      "[proposal-decline] planner notification failed (non-fatal):",
      (e as Error).message,
    );
  }

  return NextResponse.json({ ok: true });
}

async function notifyPlannerOfDecline(
  sb: ReturnType<typeof adminClient>,
  prop: ProposalLite,
  reason: string | null,
): Promise<void> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3200";
  const adminLink = `${siteUrl}/admin/proposals/${prop.id}`;

  const { data: org } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: OrgLite | null }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select("contact_email, name")
    .eq("id", prop.org_id)
    .maybeSingle();

  const plannerEmail = org?.contact_email?.trim() ?? null;
  if (!plannerEmail) return;

  let coupleName: string | null = null;
  if (prop.lead_id) {
    const { data: lead } = await (
      sb as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{ data: LeadLite | null }>;
            };
          };
        };
      }
    )
      .from("leads")
      .select("email, couple_names, partner_a_name, partner_b_name")
      .eq("id", prop.lead_id)
      .maybeSingle();
    if (lead) {
      coupleName =
        lead.couple_names ||
        [lead.partner_a_name, lead.partner_b_name]
          .filter((s): s is string => Boolean(s))
          .join(" & ") ||
        null;
    }
  }

  const couple = coupleName ?? "A client";
  const threadKey = `proposal:${prop.id}`;

  const bodyText = [
    `${couple} declined "${prop.title}".`,
    "",
    ...(reason ? [`Reason given:`, reason, ""] : []),
    "Open the proposal:",
    adminLink,
  ].join("\n");

  const bodyHtml = `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#292524;">
  <p style="font-size:15px;line-height:1.6;">
    <strong>${escapeHtml(couple)}</strong> declined <strong>${escapeHtml(prop.title)}</strong>.
  </p>
  ${reason ? `<div style="margin:16px 0;padding:12px 16px;background:#fafaf9;border-left:3px solid #d6d3d1;font-size:14px;color:#44403c;white-space:pre-wrap;">${escapeHtml(reason)}</div>` : ""}
  <p style="margin:24px 0;">
    <a href="${adminLink}" style="display:inline-block;padding:10px 18px;background:#1c1917;color:#fff;text-decoration:none;border-radius:9999px;font-size:13px;">
      Open proposal
    </a>
  </p>
</div>`.trim();

  await sendAndLogEmail(
    sb,
    {
      to: plannerEmail,
      subject: `${couple} declined ${prop.title}`,
      bodyText,
      bodyHtml,
    },
    {
      org_id: prop.org_id,
      workspace_id: prop.workspace_id,
      kind: "proposal_declined_planner",
      thread_key: threadKey,
      related_lead_id: prop.lead_id,
    },
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
