// POST /api/stripe/webhook
//
// Stripe → us. PUBLIC route (whitelisted in lib/supabase/middleware.ts).
// Verifies the request signature with STRIPE_WEBHOOK_SECRET, then:
//   - on checkout.session.completed | payment_intent.succeeded
//       payment_links.status = 'paid' + paid_at + intent/charge ids + receipt
//       planner_invoices.paid_at = now()
//   - on checkout.session.expired
//       payment_links.status = 'expired'
//
// Always returns 200 after logging unexpected errors so Stripe stops
// retrying — the alternative is a noisy retry loop on transient Supabase
// blips. Hard signature failures (untrusted) DO return 4xx so attackers
// don't get free retries.
//
// Uses the service role Supabase client because there's no user session
// on a webhook hit. Same pattern as /api/rsvp/[token]/route.ts.

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import { getStripe, stripeReady } from "@/lib/stripe-server";

export const runtime = "nodejs";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface PaymentLinkLookup {
  id: string;
  planner_invoice_id: string;
  status: string;
}

async function findPaymentLinkByLinkId(
  sb: ReturnType<typeof adminClient>,
  stripePaymentLinkId: string,
): Promise<PaymentLinkLookup | null> {
  const cast = sb as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: PaymentLinkLookup | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data } = await cast
    .from("payment_links")
    .select("id, planner_invoice_id, status")
    .eq("stripe_payment_link_id", stripePaymentLinkId)
    .maybeSingle();
  return data ?? null;
}

async function markPaymentLinkPaid(
  sb: ReturnType<typeof adminClient>,
  row: PaymentLinkLookup,
  patch: {
    stripe_payment_intent_id?: string | null;
    stripe_charge_id?: string | null;
    receipt_url?: string | null;
  },
): Promise<void> {
  const nowIso = new Date().toISOString();
  const cast = sb as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  await cast
    .from("payment_links")
    .update({
      status: "paid",
      paid_at: nowIso,
      stripe_payment_intent_id: patch.stripe_payment_intent_id ?? null,
      stripe_charge_id: patch.stripe_charge_id ?? null,
      receipt_url: patch.receipt_url ?? null,
    })
    .eq("id", row.id);

  await cast
    .from("planner_invoices")
    .update({ paid_at: nowIso, paid_via: "Stripe" })
    .eq("id", row.planner_invoice_id);
}

async function markPaymentLinkExpired(
  sb: ReturnType<typeof adminClient>,
  row: PaymentLinkLookup,
): Promise<void> {
  const cast = sb as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  await cast
    .from("payment_links")
    .update({ status: "expired" })
    .eq("id", row.id);
}

export async function POST(request: NextRequest) {
  // Stripe sometimes pings before envs are wired. Don't 500.
  if (!stripeReady || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase service role key not configured on the server." },
      { status: 503 },
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "missing stripe-signature header" },
      { status: 400 },
    );
  }

  // CRITICAL: must use raw body for signature verification. We read the
  // body as text — Next.js gives us the unparsed string here.
  const rawBody = await request.text();

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const sb = adminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // session.payment_link is the only reliable handle back to our row.
        const paymentLinkId =
          typeof session.payment_link === "string"
            ? session.payment_link
            : session.payment_link?.id ?? null;

        if (!paymentLinkId) {
          // Not from a payment link (could be a custom Checkout session) —
          // ignore.
          break;
        }

        const row = await findPaymentLinkByLinkId(sb, paymentLinkId);
        if (!row) break;
        if (row.status === "paid") break; // idempotent

        // Pull the PaymentIntent so we can record charge id + receipt.
        let intentId: string | null = null;
        let chargeId: string | null = null;
        let receiptUrl: string | null = null;
        if (typeof session.payment_intent === "string") {
          intentId = session.payment_intent;
        } else if (session.payment_intent) {
          intentId = session.payment_intent.id;
        }
        if (intentId) {
          try {
            const intent = await stripe.paymentIntents.retrieve(intentId, {
              expand: ["latest_charge"],
            });
            const latest = intent.latest_charge;
            if (latest && typeof latest !== "string") {
              chargeId = latest.id;
              receiptUrl = latest.receipt_url ?? null;
            }
          } catch (err) {
            // non-fatal — we still mark as paid
            console.warn(
              `[stripe-webhook] couldn't expand intent ${intentId}: ${(err as Error).message}`,
            );
          }
        }

        await markPaymentLinkPaid(sb, row, {
          stripe_payment_intent_id: intentId,
          stripe_charge_id: chargeId,
          receipt_url: receiptUrl,
        });
        break;
      }

      case "payment_intent.succeeded": {
        // Backstop: catches the rare case where checkout.session.completed
        // never lands. We only act if the intent's metadata points at our
        // invoice (set during paymentLinks.create — Stripe propagates link
        // metadata onto the underlying intent).
        const intent = event.data.object as Stripe.PaymentIntent;
        const linkInMeta =
          (intent.metadata && typeof intent.metadata === "object"
            ? (intent.metadata as Record<string, string>)
            : {}) ?? {};
        const plannerInvoiceId = linkInMeta["planner_invoice_id"];
        if (!plannerInvoiceId) break;

        const cast = sb as unknown as {
          from: (t: string) => {
            select: (c: string) => {
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
                    ) => Promise<{ data: PaymentLinkLookup[] | null }>;
                  };
                };
              };
            };
          };
        };
        const { data: rows } = await cast
          .from("payment_links")
          .select("id, planner_invoice_id, status")
          .eq("planner_invoice_id", plannerInvoiceId)
          .neq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(1);

        const row = rows && rows[0] ? rows[0] : null;
        if (!row) break;

        let chargeId: string | null = null;
        let receiptUrl: string | null = null;
        if (intent.latest_charge && typeof intent.latest_charge !== "string") {
          chargeId = intent.latest_charge.id;
          receiptUrl = intent.latest_charge.receipt_url ?? null;
        } else if (typeof intent.latest_charge === "string") {
          try {
            const ch = await stripe.charges.retrieve(intent.latest_charge);
            chargeId = ch.id;
            receiptUrl = ch.receipt_url ?? null;
          } catch {
            // ignore
          }
        }

        await markPaymentLinkPaid(sb, row, {
          stripe_payment_intent_id: intent.id,
          stripe_charge_id: chargeId,
          receipt_url: receiptUrl,
        });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentLinkId =
          typeof session.payment_link === "string"
            ? session.payment_link
            : session.payment_link?.id ?? null;
        if (!paymentLinkId) break;

        const row = await findPaymentLinkByLinkId(sb, paymentLinkId);
        if (!row) break;
        if (row.status !== "open") break;

        await markPaymentLinkExpired(sb, row);
        break;
      }

      default:
        // We just ack — Stripe sends many event types we don't subscribe
        // to. Logging avoids silent black-holing during early debugging.
        console.log(`[stripe-webhook] ignored event ${event.type}`);
        break;
    }
  } catch (err) {
    // Log but don't make Stripe retry — at-least-once with a poisoned
    // event would block all later events. Surfacing this in logs is
    // enough; we can replay manually from the Stripe dashboard.
    console.error(
      `[stripe-webhook] handler error for ${event.type}:`,
      (err as Error).message,
    );
  }

  return NextResponse.json({ received: true });
}
