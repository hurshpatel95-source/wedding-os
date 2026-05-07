// Couple-side mass guest email send.
//
// POST /api/guests/messages
//   body: { subject, body, segment_filter, kind, channel='email' }
//
// Workflow:
//   1. Authenticate workspace member (admin OR couple — both can blast guests)
//   2. Resolve guests in their workspace matching the segment filter
//   3. Filter to those with email present
//   4. Insert a guest_messages "campaign" row (status='sending')
//   5. Loop through each guest → sendAndLogEmail
//      - per-recipient token substitution on subject + body
//   6. Update guest_messages row → status='sent', delivered_count = N successful
//
// Token substitution (per recipient):
//   {first_name}  → first word of guest.full_name
//   {full_name}   → guest.full_name
//   {couple_name} → workspace.name with " — Wedding" suffix stripped (split on em-dash)

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendAndLogEmail } from "@/lib/email-send";
import type { GuestSide, RsvpStatus } from "@/lib/guest-types";
import type { GuestMessageRow } from "@/lib/tier1-types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface SegmentFilter {
  rsvp?: "all" | RsvpStatus;
  side?: "all" | GuestSide;
  has_email?: "all" | "yes" | "no"; // for the segment count UI; we always
                                    // require email at send time anyway
}

interface SendBody {
  subject: string;
  body: string;
  kind: string;             // 'guest_save_the_date', 'guest_rsvp_nudge', 'guest_update', 'custom', etc.
  channel?: "email" | "sms";
  segment_filter: SegmentFilter;
}

/**
 * Substitute simple {tokens} for one recipient.
 * Replaces all occurrences (replaceAll-equivalent via split/join to keep
 * the string literal predictable — no regex meta-character escapes).
 */
function substitute(
  text: string,
  vars: { first_name: string; full_name: string; couple_name: string },
): string {
  return text
    .split("{first_name}")
    .join(vars.first_name)
    .split("{full_name}")
    .join(vars.full_name)
    .split("{couple_name}")
    .join(vars.couple_name);
}

function deriveCoupleName(workspaceName: string | null | undefined): string {
  if (!workspaceName) return "the couple";
  // "Hursh & Nisha — Wedding" → "Hursh & Nisha"
  // also handle hyphen / en-dash variants just in case
  for (const sep of [" — ", " – ", " - "]) {
    const idx = workspaceName.indexOf(sep);
    if (idx > 0) return workspaceName.slice(0, idx).trim();
  }
  return workspaceName.trim();
}

interface GuestPick {
  id: string;
  full_name: string;
  email: string | null;
  side: GuestSide | null;
  overall_rsvp: RsvpStatus;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role, workspace_id, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "no profile" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<SendBody>;
  const subject = (body.subject ?? "").trim();
  const bodyText = (body.body ?? "").trim();
  const kind = (body.kind ?? "guest_update").trim();
  const channel = body.channel ?? "email";
  const segment: SegmentFilter = body.segment_filter ?? {};

  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!bodyText) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (channel !== "email") {
    return NextResponse.json(
      { error: "only email channel is supported right now" },
      { status: 400 },
    );
  }

  // Workspace context — for {couple_name} substitution
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", profile.workspace_id)
    .maybeSingle();
  const coupleName = deriveCoupleName(workspace?.name);

  // Resolve guest segment
  let q = supabase
    .from("guests")
    .select("id, full_name, email, side, overall_rsvp")
    .eq("workspace_id", profile.workspace_id);
  if (segment.rsvp && segment.rsvp !== "all") {
    q = q.eq("overall_rsvp", segment.rsvp);
  }
  if (segment.side && segment.side !== "all") {
    q = q.eq("side", segment.side);
  }
  const { data: guests, error: guestsErr } = await q;
  if (guestsErr) {
    return NextResponse.json({ error: guestsErr.message }, { status: 500 });
  }
  const eligible: GuestPick[] = ((guests ?? []) as GuestPick[]).filter(
    (g) => g.email && g.email.trim().length > 0,
  );

  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "no guests with email match this segment" },
      { status: 400 },
    );
  }

  // Insert the campaign row (cast — guest_messages not in generated types yet)
  const sbCast = supabase as unknown as {
    from: (t: string) => {
      insert: (row: unknown) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: GuestMessageRow | null;
            error: { message: string } | null;
          }>;
        };
      };
      update: (row: unknown) => {
        eq: (
          col: string,
          v: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const campaignInsert = {
    org_id: profile.org_id,
    workspace_id: profile.workspace_id,
    channel,
    kind,
    subject,
    body: bodyText,
    segment_filter: segment as unknown as Record<string, unknown>,
    recipient_count: eligible.length,
    delivered_count: 0,
    bounced_count: 0,
    status: "sending" as const,
    created_by: user.id,
  };
  const { data: campaign, error: campaignErr } = await sbCast
    .from("guest_messages")
    .insert(campaignInsert)
    .select("id")
    .single();
  if (campaignErr || !campaign) {
    return NextResponse.json(
      { error: campaignErr?.message ?? "could not create guest_messages row" },
      { status: 500 },
    );
  }

  // Send each one. Sequential to stay polite with Resend's rate limits.
  let delivered = 0;
  let bounced = 0;
  const errors: string[] = [];
  for (const guest of eligible) {
    const fullName = guest.full_name ?? "";
    const firstName = fullName.split(/\s+/)[0] ?? fullName;
    const personalSubject = substitute(subject, {
      first_name: firstName,
      full_name: fullName,
      couple_name: coupleName,
    });
    const personalBody = substitute(bodyText, {
      first_name: firstName,
      full_name: fullName,
      couple_name: coupleName,
    });

    const result = await sendAndLogEmail(
      supabase as unknown as SupabaseClient,
      {
        to: guest.email!,
        toName: fullName || null,
        subject: personalSubject,
        bodyText: personalBody,
      },
      {
        org_id: profile.org_id,
        workspace_id: profile.workspace_id,
        kind,
        related_guest_id: guest.id,
        created_by: user.id,
      },
    );
    if (result.ok) {
      delivered += 1;
    } else {
      bounced += 1;
      if (result.error) errors.push(`${guest.email}: ${result.error}`);
    }
  }

  const finalStatus: GuestMessageRow["status"] = delivered > 0 ? "sent" : "failed";
  const { error: updateErr } = await sbCast
    .from("guest_messages")
    .update({
      status: finalStatus,
      delivered_count: delivered,
      bounced_count: bounced,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);
  if (updateErr) {
    // Don't fail the request — the emails were sent, only the log row update failed.
    console.error("guest_messages update failed", updateErr.message);
  }

  return NextResponse.json({
    ok: delivered > 0,
    guest_message_id: campaign.id,
    recipient_count: eligible.length,
    delivered_count: delivered,
    bounced_count: bounced,
    errors: errors.slice(0, 10),
  });
}
