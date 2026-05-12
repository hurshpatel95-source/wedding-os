import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProposalSection } from "@/lib/tier1-types";
import { dbUpdate, dbWriteErrorResponse } from "@/lib/db-write-guard";

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

function sanitizeSections(input: unknown): ProposalSection[] | null {
  if (!Array.isArray(input)) return null;
  const out: ProposalSection[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.slice(0, 240) : "";
    const body_md =
      typeof r.body_md === "string" ? r.body_md.slice(0, 8000) : undefined;
    const itemsRaw = Array.isArray(r.items) ? r.items : [];
    const items = [];
    for (const itemRaw of itemsRaw) {
      if (!itemRaw || typeof itemRaw !== "object") continue;
      const it = itemRaw as Record<string, unknown>;
      const label = typeof it.label === "string" ? it.label.slice(0, 240) : "";
      if (!label) continue;
      const qty =
        typeof it.qty === "number" && Number.isFinite(it.qty)
          ? Math.max(0, it.qty)
          : 1;
      const unit_price_eur =
        typeof it.unit_price_eur === "number" &&
        Number.isFinite(it.unit_price_eur)
          ? Math.max(0, it.unit_price_eur)
          : 0;
      const total_eur =
        typeof it.total_eur === "number" && Number.isFinite(it.total_eur)
          ? it.total_eur
          : Number((qty * unit_price_eur).toFixed(2));
      items.push({
        label,
        qty,
        unit_price_eur,
        total_eur,
        optional: !!it.optional,
        note: typeof it.note === "string" ? it.note.slice(0, 500) : undefined,
      });
    }
    out.push({ title, body_md, items });
  }
  return out;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  let body: {
    title?: string;
    intro_md?: string | null;
    lead_id?: string | null;
    workspace_id?: string | null;
    valid_until?: string | null;
    sections?: unknown;
    total_eur?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Only drafts are editable
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { status?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: existing } = await sb
    .from("proposals")
    .select("status")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "only draft proposals can be edited" },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }
    patch.title = t.slice(0, 240);
  }
  if (body.intro_md !== undefined) {
    patch.intro_md =
      typeof body.intro_md === "string"
        ? body.intro_md.slice(0, 16_000) || null
        : null;
  }
  if (body.lead_id !== undefined) patch.lead_id = body.lead_id || null;
  if (body.workspace_id !== undefined)
    patch.workspace_id = body.workspace_id || null;
  if (body.valid_until !== undefined)
    patch.valid_until = body.valid_until || null;

  if (body.sections !== undefined) {
    const sections = sanitizeSections(body.sections);
    if (!sections) {
      return NextResponse.json({ error: "invalid sections" }, { status: 400 });
    }
    patch.sections = sections;
    if (typeof body.total_eur !== "number") {
      patch.total_eur = sections
        .flatMap((s) => s.items ?? [])
        .reduce((acc, it) => acc + (it.total_eur ?? 0), 0);
    }
  }
  if (typeof body.total_eur === "number" && Number.isFinite(body.total_eur)) {
    patch.total_eur = body.total_eur;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const updSb = supabase as unknown as {
    from: (t: string) => {
      update: (row: unknown) => {
        eq: (col: string, val: string) => {
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
      "update proposal (draft)",
      updSb.from("proposals").update(patch).eq("id", params.id).select("id"),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = dbWriteErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
