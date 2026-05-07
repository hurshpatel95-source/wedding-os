import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAndLogEmail } from "@/lib/email-send";

export const runtime = "nodejs";

interface ProposalLite {
  id: string;
  org_id: string;
  workspace_id: string | null;
  lead_id: string | null;
  title: string;
  status: string;
  public_token: string;
  total_eur: number | null;
  valid_until: string | null;
}

interface LeadLite {
  email: string | null;
  couple_names: string | null;
  partner_a_name: string | null;
  partner_b_name: string | null;
}

interface UserLite {
  email: string;
}

interface OrgLite {
  name: string;
}

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
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user } = auth;

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: ProposalLite | null }>;
        };
      };
    };
  };

  const { data: prop } = await sb
    .from("proposals")
    .select(
      "id, org_id, workspace_id, lead_id, title, status, public_token, total_eur, valid_until",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!prop) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (prop.status !== "draft") {
    return NextResponse.json(
      { error: "only drafts can be sent" },
      { status: 409 },
    );
  }

  // Resolve recipient email — prefer lead.email, then a workspace member email.
  let recipientEmail: string | null = null;
  let recipientName: string | null = null;
  if (prop.lead_id) {
    const { data: lead } = await (
      supabase as unknown as {
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
    if (lead?.email) {
      recipientEmail = lead.email;
      recipientName =
        lead.couple_names ||
        [lead.partner_a_name, lead.partner_b_name].filter(Boolean).join(" & ") ||
        null;
    }
  }
  if (!recipientEmail && prop.workspace_id) {
    const { data: member } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              order: (
                c: string,
                o: { ascending: boolean },
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{ data: UserLite | null }>;
                };
              };
            };
          };
        };
      }
    )
      .from("users")
      .select("email")
      .eq("workspace_id", prop.workspace_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (member?.email) {
      recipientEmail = member.email;
    }
  }

  if (!recipientEmail) {
    return NextResponse.json(
      {
        error:
          "no recipient email — link the proposal to a lead with an email or a workspace with at least one member",
      },
      { status: 400 },
    );
  }

  // Org name for the body
  const { data: org } = await (
    supabase as unknown as {
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
    .select("name")
    .eq("id", prop.org_id)
    .maybeSingle();

  const orgName = org?.name ?? "your planner";
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const link = `${siteUrl}/proposal/${prop.public_token}`;
  const greeting = recipientName ? `Hi ${recipientName.split("&")[0]?.trim()},` : "Hi,";

  const totalLine =
    prop.total_eur != null
      ? `Total: ${formatEur(prop.total_eur)}.`
      : "";
  const validLine = prop.valid_until ? ` Valid until ${prop.valid_until}.` : "";

  const bodyText = `${greeting}

We've put together a proposal for "${prop.title}". You can review it (and accept or decline in one click) at the private link below.

${link}

${totalLine}${validLine}

Reach out if you'd like anything tweaked.

— ${orgName}`.trim();

  const bodyHtml = `<p>${greeting}</p>
<p>We&rsquo;ve put together a proposal for &ldquo;${escapeHtml(prop.title)}&rdquo;. You can review it (and accept or decline in one click) at the private link below.</p>
<p><a href="${link}">${link}</a></p>
${totalLine ? `<p>${escapeHtml(totalLine)}${escapeHtml(validLine)}</p>` : ""}
<p>Reach out if you&rsquo;d like anything tweaked.</p>
<p>— ${escapeHtml(orgName)}</p>`;

  const sendResult = await sendAndLogEmail(
    supabase,
    {
      to: recipientEmail,
      toName: recipientName,
      subject: `Your proposal from ${orgName}: ${prop.title}`,
      bodyText,
      bodyHtml,
    },
    {
      org_id: prop.org_id,
      workspace_id: prop.workspace_id,
      kind: "proposal_sent",
      thread_key: `proposal:${prop.id}`,
      related_lead_id: prop.lead_id,
      created_by: user.id,
    },
  );

  // Stamp sent regardless of provider success — the email_messages row records
  // delivery status; the planner can resend if needed.
  const { error } = await (
    supabase as unknown as {
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
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    email: { ok: sendResult.ok, error: sendResult.error ?? null },
  });
}

function formatEur(n: number): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `€${n.toFixed(2)}`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
