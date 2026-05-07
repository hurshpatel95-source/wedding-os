import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailMessageRow } from "@/lib/tier1-types";

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

export async function GET(request: NextRequest) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  const url = new URL(request.url);
  const leadId = url.searchParams.get("lead_id");
  const vendorId = url.searchParams.get("vendor_id");
  const guestId = url.searchParams.get("guest_id");

  if (!leadId && !vendorId && !guestId) {
    return NextResponse.json(
      { error: "lead_id, vendor_id, or guest_id required" },
      { status: 400 },
    );
  }

  // email_messages isn't in the generated Database types yet — RLS still
  // enforces org scoping. Cast for the read.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{
            data: EmailMessageRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const filterCol = leadId
    ? "related_lead_id"
    : vendorId
    ? "related_vendor_id"
    : "related_guest_id";
  const filterVal = (leadId ?? vendorId ?? guestId) as string;

  const { data, error } = await sb
    .from("email_messages")
    .select(
      "id, org_id, workspace_id, direction, kind, thread_key, in_reply_to_message_id, provider, provider_message_id, to_email, to_name, from_email, from_name, cc, bcc, subject, body_text, body_html, related_lead_id, related_vendor_id, related_guest_id, related_contract_id, status, status_detail, sent_at, delivered_at, opened_at, created_by, created_at, updated_at",
    )
    .eq(filterCol, filterVal)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}
