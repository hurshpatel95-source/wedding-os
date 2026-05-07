// Server-only Stripe client + helpers. Lazy-loaded so the rest of the
// product builds when STRIPE_SECRET_KEY isn't configured.
//
// Used by:
//   - /api/stripe/payment-link  (planner attaches payment link to invoice)
//   - /api/stripe/webhook       (Stripe → mark payment_links.status='paid')
//   - /api/admin/billing/[id]/pay-online  (UI entry point)

import "server-only";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export const stripeReady = Boolean(STRIPE_SECRET_KEY);

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_client) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it in Railway → Variables.",
      );
    }
    _client = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-01-27.acacia" as unknown as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return _client;
}

export function eurosToCents(eur: number): number {
  return Math.round(eur * 100);
}
