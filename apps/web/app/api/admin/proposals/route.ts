import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProposalSection } from "@/lib/tier1-types";

export const runtime = "nodejs";

interface OrgProfile {
  org_id: string;
  org_role: "org_admin" | "member" | null;
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
  return {
    supabase,
    user,
    profile: profile as OrgProfile,
  };
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
    out.push({
      title,
      body_md,
      items,
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  const auth = await requireOrgAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, user, profile } = auth;

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

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const sections = sanitizeSections(body.sections ?? []);
  if (!sections) {
    return NextResponse.json({ error: "invalid sections" }, { status: 400 });
  }

  const total_eur =
    typeof body.total_eur === "number" && Number.isFinite(body.total_eur)
      ? body.total_eur
      : sections
          .flatMap((s) => s.items ?? [])
          .reduce((acc, it) => acc + (it.total_eur ?? 0), 0);

  const insertRow = {
    org_id: profile.org_id,
    workspace_id: body.workspace_id || null,
    lead_id: body.lead_id || null,
    title: title.slice(0, 240),
    intro_md:
      typeof body.intro_md === "string"
        ? body.intro_md.slice(0, 16_000) || null
        : null,
    sections,
    total_eur,
    valid_until: body.valid_until || null,
    status: "draft",
    created_by: user.id,
  };

  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (row: unknown) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("proposals")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
