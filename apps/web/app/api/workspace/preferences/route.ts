// PATCH /api/workspace/preferences
//
// Couple-side knobs that don't deserve their own endpoints. We accept a small
// allowlist of fields and refuse anything else so this can't accidentally
// become a way to flip planner-only flags from the couple shell.
//
// Allowed fields:
//   - name                   → workspaces.name (max 200)
//   - wedding_date           → workspaces.wedding_date (yyyy-mm-dd or null)
//   - wedding_region         → workspaces.wedding_region (max 200, nullable)
//   - guest_count_estimate   → workspaces.guest_count_estimate (positive int or null)
//   - budget_target_eur      → workspaces.budget_target_eur (positive int or null,
//                              column name is "_eur" but stores whatever the
//                              workspace's base_currency is)
//   - base_currency          → workspaces.base_currency ("USD" | "EUR")

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_CURRENCIES = ["USD", "EUR"] as const;
type Currency = (typeof ALLOWED_CURRENCIES)[number];

const ALLOWED_FIELDS = new Set([
  "name",
  "wedding_date",
  "wedding_region",
  "guest_count_estimate",
  "budget_target_eur",
  "base_currency",
]);

interface PatchBody {
  name?: unknown;
  wedding_date?: unknown;
  wedding_region?: unknown;
  guest_count_estimate?: unknown;
  budget_target_eur?: unknown;
  base_currency?: unknown;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Reject anything outside the allowlist — couples shouldn't be able to flip
  // planner-only fields like autopilot_enabled, org_id, etc.
  for (const k of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(k)) {
      return NextResponse.json(
        { error: `field '${k}' is not allowed` },
        { status: 400 },
      );
    }
  }

  const patch: Record<string, unknown> = {};

  // ─── name ────────────────────────────────────────────────────────────
  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return NextResponse.json(
        { error: "name must be a string" },
        { status: 400 },
      );
    }
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: "name can't be empty" },
        { status: 400 },
      );
    }
    if (trimmed.length > 200) {
      return NextResponse.json(
        { error: "name is too long (max 200)" },
        { status: 400 },
      );
    }
    patch.name = trimmed;
  }

  // ─── wedding_date ────────────────────────────────────────────────────
  if (body.wedding_date !== undefined) {
    if (body.wedding_date === null || body.wedding_date === "") {
      patch.wedding_date = null;
    } else if (typeof body.wedding_date === "string") {
      if (!ISO_DATE_RE.test(body.wedding_date)) {
        return NextResponse.json(
          { error: "wedding_date must be yyyy-mm-dd" },
          { status: 400 },
        );
      }
      const d = new Date(`${body.wedding_date}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "wedding_date is not a valid date" },
          { status: 400 },
        );
      }
      patch.wedding_date = body.wedding_date;
    } else {
      return NextResponse.json(
        { error: "wedding_date must be a string or null" },
        { status: 400 },
      );
    }
  }

  // ─── wedding_region ──────────────────────────────────────────────────
  if (body.wedding_region !== undefined) {
    if (body.wedding_region === null) {
      patch.wedding_region = null;
    } else if (typeof body.wedding_region === "string") {
      const trimmed = body.wedding_region.trim();
      if (trimmed.length === 0) {
        patch.wedding_region = null;
      } else if (trimmed.length > 200) {
        return NextResponse.json(
          { error: "wedding_region is too long (max 200)" },
          { status: 400 },
        );
      } else {
        patch.wedding_region = trimmed;
      }
    } else {
      return NextResponse.json(
        { error: "wedding_region must be a string or null" },
        { status: 400 },
      );
    }
  }

  // ─── guest_count_estimate ────────────────────────────────────────────
  if (body.guest_count_estimate !== undefined) {
    if (body.guest_count_estimate === null || body.guest_count_estimate === "") {
      patch.guest_count_estimate = null;
    } else {
      const n = Number(body.guest_count_estimate);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > 100000) {
        return NextResponse.json(
          { error: "guest_count_estimate must be a positive integer" },
          { status: 400 },
        );
      }
      patch.guest_count_estimate = n;
    }
  }

  // ─── budget_target_eur ───────────────────────────────────────────────
  if (body.budget_target_eur !== undefined) {
    if (body.budget_target_eur === null || body.budget_target_eur === "") {
      patch.budget_target_eur = null;
    } else {
      const n = Number(body.budget_target_eur);
      if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) {
        return NextResponse.json(
          { error: "budget_target_eur must be a positive number" },
          { status: 400 },
        );
      }
      // Round to integer — the column is numeric(14,2) but we treat it as a
      // round number for budget targets.
      patch.budget_target_eur = Math.round(n);
    }
  }

  // ─── base_currency ───────────────────────────────────────────────────
  if (body.base_currency !== undefined) {
    if (typeof body.base_currency !== "string") {
      return NextResponse.json(
        { error: "base_currency must be a string" },
        { status: 400 },
      );
    }
    const c = body.base_currency.toUpperCase().trim() as Currency;
    if (!(ALLOWED_CURRENCIES as readonly string[]).includes(c)) {
      return NextResponse.json(
        {
          error: `base_currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    patch.base_currency = c;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  // Cast — wedding_region / guest_count_estimate / budget_target_eur aren't
  // in the generated types yet (added in 20260507000002_wave3_autopilot).
  const sbWs = supabase as unknown as {
    from: (t: string) => {
      update: (payload: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error: updErr } = await sbWs
    .from("workspaces")
    .update(patch)
    .eq("id", profile.workspace_id);
  if (updErr) {
    return NextResponse.json(
      { error: `Couldn't update: ${updErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ...patch });
}
