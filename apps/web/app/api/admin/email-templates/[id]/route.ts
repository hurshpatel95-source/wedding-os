// Email-template library single-record actions.
//   PATCH  /api/admin/email-templates/:id   → update fields
//   DELETE /api/admin/email-templates/:id   → hard delete (RLS-scoped, org_admin)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbUpdate,
  dbDelete,
  dbWriteErrorResponse,
} from "@/lib/db-write-guard";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set([
  "vendor_rfp",
  "vendor_followup",
  "guest_save_the_date",
  "guest_rsvp_nudge",
  "guest_update",
  "contract_followup",
  "custom",
]);

async function ensureAdmin(userId: string) {
  const supabase = createClient();
  const sb = supabase as unknown as {
    from: (table: string) => {
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
  const { data } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.org_role === "org_admin" ? data : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await ensureAdmin(user.id);
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    name?: string;
    kind?: string | null;
    subject?: string;
    body?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = (body.name ?? "").trim();
    if (!n) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    patch.name = n.slice(0, 240);
  }
  if (body.subject !== undefined) {
    const s = (body.subject ?? "").trim();
    if (!s) {
      return NextResponse.json({ error: "subject cannot be empty" }, { status: 400 });
    }
    patch.subject = s.slice(0, 500);
  }
  if (body.body !== undefined) {
    const t = (body.body ?? "").toString();
    if (!t.trim()) {
      return NextResponse.json({ error: "body cannot be empty" }, { status: 400 });
    }
    patch.body = t.slice(0, 32_000);
  }
  if (body.kind !== undefined) {
    if (body.kind === null) {
      patch.kind = null;
    } else if (typeof body.kind === "string" && ALLOWED_KINDS.has(body.kind)) {
      patch.kind = body.kind;
    } else {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sb = supabase as unknown as {
    from: (table: string) => {
      update: (row: unknown) => {
        eq: (
          col: string,
          val: string,
        ) => {
          select: (cols: string) => PromiseLike<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  try {
    await dbUpdate(
      "update email_template",
      sb.from("email_templates").update(patch).eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await ensureAdmin(user.id);
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = supabase as unknown as {
    from: (table: string) => {
      delete: () => {
        eq: (
          col: string,
          val: string,
        ) => {
          select: (cols: string) => PromiseLike<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  try {
    await dbDelete(
      "delete email_template",
      sb.from("email_templates").delete().eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
