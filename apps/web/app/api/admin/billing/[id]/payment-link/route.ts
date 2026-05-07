// POST /api/admin/billing/[id]/payment-link
//
// Generate a Stripe Payment Link for a single planner_invoice. Idempotent —
// if the invoice already has a non-paid payment_links row we return that
// row's URL instead of creating a duplicate. The webhook (see
// /api/stripe/webhook) is the only thing that flips status='paid'.
//
// Caller must be an org_admin in the same org as the invoice. RLS would
// block cross-org reads anyway; we belt-and-braces here for clarity.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, eurosToCents, stripeReady } from "@/lib/stripe-server";
import type { PaymentLinkRow } from "@/lib/tier1-types";

export const runtime = "nodejs";

interface InvoiceRow {
  id: string;
  org_id: string;
  workspace_id: string;
  label: string;
  amount_eur: number | string;
  paid_at: string | null;
}

interface ExistingLinkRow {
  id: string;
  stripe_payment_link_url: string;
  status: PaymentLinkRow["status"];
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const invoiceId = params.id;

  if (!stripeReady) {
    return NextResponse.json(
      { error: "Stripe not configured. Set STRIPE_SECRET_KEY in env." },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Verify caller is an org_admin and resolve their org_id.
  const profileSb = supabase as unknown as {
    from: (t: string) => {
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
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return NextResponse.json({ error: "org admin only" }, { status: 403 });
  }

  // Look up the invoice. RLS will scope to caller's org.
  const invSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: InvoiceRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data: invoice, error: invErr } = await invSb
    .from("planner_invoices")
    .select("id, org_id, workspace_id, label, amount_eur, paid_at")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  }
  if (invoice.org_id !== profile.org_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (invoice.paid_at) {
    return NextResponse.json(
      { error: "invoice already marked paid" },
      { status: 400 },
    );
  }

  const amountEur = Number(invoice.amount_eur);
  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    return NextResponse.json(
      { error: "invoice amount must be positive" },
      { status: 400 },
    );
  }

  // Re-use any existing open/unpaid link to keep this idempotent.
  const linkSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          neq: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (
                n: number,
              ) => Promise<{
                data: ExistingLinkRow[] | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };
  };
  const { data: existing } = await linkSb
    .from("payment_links")
    .select("id, stripe_payment_link_url, status")
    .eq("planner_invoice_id", invoiceId)
    .neq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0 && existing[0].status === "open") {
    return NextResponse.json({
      url: existing[0].stripe_payment_link_url,
      id: existing[0].id,
      reused: true,
    });
  }

  // Create a new Stripe Payment Link.
  // Stripe paymentLinks.create requires line_items[].price (NOT price_data).
  // So we create a one-shot Price (with inline product_data) per invoice,
  // then reference it. Each Price is unique to this invoice.
  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";

  let stripeLink: { id: string; url: string };
  try {
    const price = await stripe.prices.create({
      currency: "eur",
      unit_amount: eurosToCents(amountEur),
      product_data: { name: invoice.label || "Planner invoice" },
      metadata: {
        planner_invoice_id: invoice.id,
        workspace_id: invoice.workspace_id,
        org_id: invoice.org_id,
      },
    });

    const created = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        planner_invoice_id: invoice.id,
        workspace_id: invoice.workspace_id,
        org_id: invoice.org_id,
      },
      after_completion: {
        type: "redirect",
        redirect: { url: `${siteUrl}/payments?paid=1` },
      },
    });
    stripeLink = { id: created.id, url: created.url };
  } catch (err) {
    return NextResponse.json(
      { error: `Stripe error: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Insert payment_links row. RLS allows org_admin all-access on this table.
  const insertSb = supabase as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data: inserted, error: insErr } = await insertSb
    .from("payment_links")
    .insert({
      org_id: invoice.org_id,
      planner_invoice_id: invoice.id,
      stripe_payment_link_id: stripeLink.id,
      stripe_payment_link_url: stripeLink.url,
      amount_eur: amountEur,
      status: "open",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    // Stripe link is now orphaned but harmless — the webhook ignores it
    // because there's no matching row.
    return NextResponse.json(
      {
        error: `payment_links insert failed: ${insErr?.message ?? "unknown"}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: stripeLink.url, id: inserted.id });
}
