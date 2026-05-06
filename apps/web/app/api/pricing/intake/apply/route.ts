import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface ApplyRequest {
  source_id: string;
  decisions: Array<{
    proposal_id: string;
    decision: "accepted" | "edited" | "rejected";
    edits?: {
      proposed_unit_price?: number;
      proposed_unit?: string;
      proposed_label?: string;
      proposed_category?: string;
      matched_line_item_id?: string;
    };
    target_venue_id?: string | null; // for override-kind: which venue to apply to
  }>;
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
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const body = (await request.json()) as ApplyRequest;
  if (!body.source_id || !Array.isArray(body.decisions)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { data: source } = await supabase
    .from("pricing_intake_sources")
    .select("id, org_id, workspace_id, template_id")
    .eq("id", body.source_id)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });

  let appliedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const d of body.decisions) {
    if (d.decision === "rejected") {
      await supabase
        .from("pricing_intake_proposals")
        .update({
          decision: "rejected",
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        })
        .eq("id", d.proposal_id);
      skippedCount++;
      continue;
    }

    const { data: proposal } = await supabase
      .from("pricing_intake_proposals")
      .select("*")
      .eq("id", d.proposal_id)
      .maybeSingle();
    if (!proposal) {
      errors.push(`proposal ${d.proposal_id} not found`);
      skippedCount++;
      continue;
    }

    const finalPrice = d.edits?.proposed_unit_price ?? proposal.proposed_unit_price;
    const finalLineItemId = d.edits?.matched_line_item_id ?? proposal.matched_line_item_id;

    let changeLogId: string | null = null;

    try {
      if (proposal.kind === "default_price" && finalLineItemId) {
        // Update the line item default price
        const { data: oldRow } = await supabase
          .from("pricing_line_items")
          .select("default_unit_price, currency")
          .eq("id", finalLineItemId)
          .maybeSingle();
        const { error: upErr } = await supabase
          .from("pricing_line_items")
          .update({
            default_unit_price: finalPrice ?? 0,
          })
          .eq("id", finalLineItemId);
        if (upErr) throw upErr;

        const { data: log } = await supabase
          .from("pricing_change_log")
          .insert({
            org_id: source.org_id,
            workspace_id: source.workspace_id,
            template_id: source.template_id,
            line_item_id: finalLineItemId,
            target: "default_price",
            old_value: oldRow as never,
            new_value: { default_unit_price: finalPrice, currency: oldRow?.currency } as never,
            actor_kind: "ai_intake",
            actor_user_id: user.id,
            source_id: source.id,
            proposal_id: proposal.id,
            evidence: proposal.evidence as never,
          })
          .select("id")
          .single();
        changeLogId = log?.id ?? null;
      } else if (proposal.kind === "override" && d.target_venue_id && finalLineItemId) {
        // Upsert venue_pricing.overrides JSONB
        const { data: existing } = await supabase
          .from("venue_pricing")
          .select("id, overrides")
          .eq("venue_id", d.target_venue_id)
          .eq("template_id", source.template_id)
          .maybeSingle();

        const oldOverrides =
          (existing?.overrides as Record<string, { unit_price?: number }> | null) ?? {};
        const newOverrides = {
          ...oldOverrides,
          [finalLineItemId]: {
            ...(oldOverrides[finalLineItemId] ?? {}),
            unit_price: finalPrice,
          },
        };

        if (existing) {
          await supabase
            .from("venue_pricing")
            .update({ overrides: newOverrides as never })
            .eq("id", existing.id);
        } else {
          await supabase.from("venue_pricing").insert({
            venue_id: d.target_venue_id,
            template_id: source.template_id,
            overrides: newOverrides as never,
            source: "ai_intake",
          });
        }

        const { data: log } = await supabase
          .from("pricing_change_log")
          .insert({
            org_id: source.org_id,
            workspace_id: source.workspace_id,
            template_id: source.template_id,
            line_item_id: finalLineItemId,
            venue_id: d.target_venue_id,
            target: "override_price",
            old_value: { unit_price: oldOverrides[finalLineItemId]?.unit_price ?? null } as never,
            new_value: { unit_price: finalPrice } as never,
            actor_kind: "ai_intake",
            actor_user_id: user.id,
            source_id: source.id,
            proposal_id: proposal.id,
            evidence: proposal.evidence as never,
          })
          .select("id")
          .single();
        changeLogId = log?.id ?? null;
      } else if (proposal.kind === "new_line_item") {
        // For a new line item we need a category — use the matched/proposed
        // category as text, and find or create the corresponding row.
        const targetCategory =
          d.edits?.proposed_category ?? proposal.proposed_category ?? "Other";
        const { data: cat } = await supabase
          .from("pricing_categories")
          .select("id")
          .eq("template_id", source.template_id)
          .ilike("label", targetCategory)
          .maybeSingle();
        let catId = cat?.id;
        if (!catId) {
          const { data: created } = await supabase
            .from("pricing_categories")
            .insert({ template_id: source.template_id, label: targetCategory })
            .select("id")
            .single();
          catId = created?.id;
        }
        if (catId) {
          const { data: newLi } = await supabase
            .from("pricing_line_items")
            .insert({
              category_id: catId,
              label: d.edits?.proposed_label ?? proposal.proposed_label ?? "(unnamed)",
              description: proposal.proposed_description,
              unit: (d.edits?.proposed_unit ?? proposal.proposed_unit ?? "flat") as
                | "per_guest"
                | "per_event"
                | "flat"
                | "per_hour"
                | "per_day",
              default_unit_price: finalPrice ?? 0,
              currency: proposal.proposed_currency ?? "EUR",
              tier: proposal.proposed_tier,
            })
            .select("id")
            .single();

          if (newLi) {
            const { data: log } = await supabase
              .from("pricing_change_log")
              .insert({
                org_id: source.org_id,
                workspace_id: source.workspace_id,
                template_id: source.template_id,
                line_item_id: newLi.id,
                target: "new_line_item",
                old_value: null,
                new_value: {
                  label: proposal.proposed_label,
                  unit: proposal.proposed_unit,
                  default_unit_price: finalPrice,
                } as never,
                actor_kind: "ai_intake",
                actor_user_id: user.id,
                source_id: source.id,
                proposal_id: proposal.id,
                evidence: proposal.evidence as never,
              })
              .select("id")
              .single();
            changeLogId = log?.id ?? null;
          }
        }
      } else {
        errors.push(`proposal ${proposal.id}: unsupported kind/missing context`);
        skippedCount++;
        continue;
      }

      await supabase
        .from("pricing_intake_proposals")
        .update({
          decision: d.decision,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          applied_change_log_id: changeLogId,
        })
        .eq("id", d.proposal_id);

      appliedCount++;
    } catch (err) {
      errors.push(`proposal ${proposal.id}: ${(err as Error).message}`);
      skippedCount++;
    }
  }

  // Mark source as applied if all proposals are non-pending
  const { count: pending } = await supabase
    .from("pricing_intake_proposals")
    .select("id", { count: "exact", head: true })
    .eq("source_id", source.id)
    .eq("decision", "pending");
  if ((pending ?? 0) === 0) {
    await supabase
      .from("pricing_intake_sources")
      .update({ status: "applied" })
      .eq("id", source.id);
  }

  return NextResponse.json({
    applied: appliedCount,
    skipped: skippedCount,
    errors,
  });
}
