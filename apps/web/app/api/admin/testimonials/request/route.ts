// POST /api/admin/testimonials/request
//
// Create a testimonial row in 'requested' status and email the couple
// the public submission link (/testimonial/<public_token>). Org admin
// only — testimonials_org_admin RLS scopes the insert to the caller's org.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAndLogEmail } from "@/lib/email-send";
import type { TestimonialRow } from "@/lib/wave2-types";

export const runtime = "nodejs";

interface RequestBody {
  workspace_id?: string | null;
  couple_names?: string;
  contact_email?: string;
  subject?: string | null;
  intro?: string | null;
}

export async function POST(request: NextRequest) {
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

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const couple = body.couple_names?.trim();
  const email = body.contact_email?.trim();
  if (!couple) {
    return NextResponse.json(
      { error: "couple_names is required" },
      { status: 400 },
    );
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "valid contact_email is required" },
      { status: 400 },
    );
  }

  const insertRow = {
    org_id: profile.org_id,
    workspace_id: body.workspace_id ?? null,
    couple_names: couple,
    contact_email: email,
    status: "requested" as const,
    requested_at: new Date().toISOString(),
    created_by: user.id,
  };

  const insSb = supabase as unknown as {
    from: (t: string) => {
      insert: (row: unknown) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: TestimonialRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data: created, error: insErr } = await insSb
    .from("testimonials")
    .insert(insertRow)
    .select(
      "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
    )
    .single();

  if (insErr || !created) {
    return NextResponse.json(
      { error: `Couldn't create testimonial: ${insErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
  const submitLink = `${siteUrl}/testimonial/${created.public_token}`;

  const subject =
    body.subject?.trim() ||
    `Would you mind sharing a few words about your wedding?`;
  const introLine =
    body.intro?.trim() ||
    "It would mean the world if you'd share a couple of sentences about your experience — future couples will read it on our site as they decide who to plan with.";

  const greeting = `Hi ${couple.split("&")[0]?.trim() || couple},`;

  const bodyText = [
    greeting,
    "",
    introLine,
    "",
    "Use the link below — it takes about a minute. You can include a photo if you like.",
    submitLink,
    "",
    "Thank you so much.",
    "",
    "— The team",
  ].join("\n");

  const bodyHtml = `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#292524;">
  <p style="font-size:16px;margin-bottom:16px;">${escapeHtml(greeting)}</p>
  <p style="font-size:15px;line-height:1.6;">${escapeHtml(introLine)}</p>
  <p style="font-size:15px;line-height:1.6;">
    Use the link below — it takes about a minute. You can include a photo if you like.
  </p>
  <p style="margin:28px 0;">
    <a href="${submitLink}" style="display:inline-block;padding:12px 22px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:9999px;font-size:14px;font-weight:500;">
      Share your testimonial &rarr;
    </a>
  </p>
  <p style="font-size:13px;color:#78716c;line-height:1.6;">
    Or paste this link into your browser:<br />
    <a href="${submitLink}" style="color:#9f1239;">${submitLink}</a>
  </p>
  <p style="font-size:14px;color:#57534e;margin-top:32px;">Thank you so much.</p>
  <p style="font-size:14px;color:#57534e;">&mdash; The team</p>
</div>
`.trim();

  const sendResult = await sendAndLogEmail(
    supabase,
    {
      to: email,
      toName: couple,
      subject,
      bodyText,
      bodyHtml,
    },
    {
      org_id: profile.org_id,
      workspace_id: created.workspace_id,
      kind: "testimonial_request",
      created_by: user.id,
    },
  );

  return NextResponse.json({
    ok: true,
    id: created.id,
    public_token: created.public_token,
    submit_url: submitLink,
    email_ok: sendResult.ok,
    email_error: sendResult.error,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
