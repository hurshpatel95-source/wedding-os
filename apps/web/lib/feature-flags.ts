// Feature catalog + env-readiness check.
//
// Used by every feature page that depends on third-party API keys to show
// a polished "what this does" preview when the integration isn't wired up
// yet. The goal: someone logging in for the first time can browse every
// surface and understand the value, even if Hursh hasn't provisioned the
// underlying API yet.
//
// Server-only because we read process.env. Components use these via the
// FeaturePreviewCard component which is hydrated server-side.

import "server-only";

export type FeatureKey =
  | "gmail"
  | "google_places"
  | "brave_search"
  | "stripe"
  | "resend"
  | "google_calendar"
  | "anthropic"
  | "cron";

export interface FeatureSpec {
  key: FeatureKey;
  label: string;
  oneLiner: string;
  whatItDoes: string[];     // 3-5 bullets — what it actually unlocks
  exampleScenarios: string[]; // 2-3 short stories of the feature in action
  envVars: string[];        // Names planner needs to set
  setupNotes: string;       // Short paragraph for Hursh's eyes
  ready: boolean;
}

const ENV = process.env;

const FEATURES: Record<FeatureKey, Omit<FeatureSpec, "ready">> = {
  gmail: {
    key: "gmail",
    label: "Gmail connector",
    oneLiner:
      "Connect a wedding-only Gmail so vendor outreach goes from your real address — not a third-party email service.",
    whatItDoes: [
      "Send vendor RFPs from your wedding Gmail (your name, your reputation)",
      "AI drafts saved to Gmail Drafts — review in Gmail before hitting send",
      "Vendor replies thread back into wedding-os automatically",
      "Autopilot reads incoming replies + updates each vendor's status",
      "All emails stay in your Gmail forever — wedding-os doesn't lock anything in",
    ],
    exampleScenarios: [
      "You search 8 florists, autopilot drafts 8 personalized RFPs, you tap Send → all sent from your wedding email in 30 seconds",
      "Maria the florist replies with a $4,500 quote → autopilot reads it → your dashboard shows 'Maria quoted $4,500' before you've checked email",
    ],
    envVars: [
      "GMAIL_OAUTH_CLIENT_ID",
      "GMAIL_OAUTH_CLIENT_SECRET",
      "GMAIL_OAUTH_REDIRECT_URI",
    ],
    setupNotes:
      "Create a Google Cloud OAuth 2.0 client, enable Gmail API, add the redirect URI to authorized URIs. Free.",
  },
  google_places: {
    key: "google_places",
    label: "Vendor search via Google Places",
    oneLiner:
      "Find every wedding florist (or photographer / DJ / caterer) in your region in one search — name, phone, website, rating.",
    whatItDoes: [
      "Type a category + region → Google Places returns 10 real local vendors",
      "Each candidate has photos, rating, address, website — auto-imported as a vendor row",
      "Pick the ones you want to reach out to → autopilot drafts personalized RFPs",
      "Search results cached for 7 days so you don't re-bill on revisit",
    ],
    exampleScenarios: [
      "Search 'wedding florist Newport, RI' → 10 candidates appear with photos. Check 5. Click Add. Done — they're in your vendor list with autopilot watching them.",
      "Compare quotes side-by-side at /vendors/compare/florist when replies come in.",
    ],
    envVars: ["GOOGLE_PLACES_API_KEY"],
    setupNotes:
      "Google Cloud Places API (New) — Text Search v1. ~$0.032 per search after $200/mo free credit. Almost certainly free for one wedding.",
  },
  brave_search: {
    key: "brave_search",
    label: "Brave Search fallback",
    oneLiner:
      "Web search backup for niche vendors that Places doesn't index well.",
    whatItDoes: [
      "Used as fallback when Google Places returns nothing for a category",
      "Free 2,000 queries/month on the Brave Search API free tier",
    ],
    exampleScenarios: [
      "Searching 'vintage Volkswagen wedding getaway car Newport' returns Brave web results when Places has none.",
    ],
    envVars: ["BRAVE_SEARCH_API_KEY"],
    setupNotes: "Free tier 2k queries/mo at api.search.brave.com.",
  },
  stripe: {
    key: "stripe",
    label: "Stripe payments",
    oneLiner:
      "Send a payment link with each invoice — couple pays online, webhook auto-marks paid.",
    whatItDoes: [
      "Generate a Stripe Payment Link per invoice with one click",
      "Couple sees 'Pay online' button on their /payments page",
      "When they pay, webhook fires → invoice auto-marks paid + receipt URL saved",
      "Shows up in your /admin/finances P&L immediately",
    ],
    exampleScenarios: [
      "Send a €9,000 retainer invoice → tap 'Generate payment link' → text it to the couple → they tap, pay, you get the email + dashboard updates the same minute.",
    ],
    envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    setupNotes:
      "Standard Stripe account, get the secret key, set up webhook endpoint at /api/stripe/webhook.",
  },
  resend: {
    key: "resend",
    label: "Email delivery (Resend)",
    oneLiner:
      "Real outbound email for the planner-OS — contracts, proposals, signature receipts, daily digest.",
    whatItDoes: [
      "Contract sign confirmation emails fire automatically to both sides",
      "Proposal accept/decline notifications go to the planner",
      "Daily 8 AM digest email summarizing what changed in the studio",
      "Inbound webhook captures vendor reply emails with thread matching",
    ],
    exampleScenarios: [
      "Sara signs the contract at 11 PM → planner gets 'Sara signed your contract' email immediately. Sara gets a confirmation copy.",
      "Daily digest: '2 quotes received, 1 contract signed, 3 vendors silent for 7+ days'.",
    ],
    envVars: [
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "RESEND_FROM_NAME",
      "RESEND_WEBHOOK_SIGNING_KEY",
    ],
    setupNotes:
      "Resend account + verified sending domain. ~$0/mo for first 3k emails, then $20/mo.",
  },
  google_calendar: {
    key: "google_calendar",
    label: "Google Calendar sync",
    oneLiner:
      "Two-way sync between your Google Calendar and your booking-page slots so couples never book over your existing meetings.",
    whatItDoes: [
      "Connect Google Calendar via OAuth (read-only)",
      "Booking page automatically dims time slots that conflict with your calendar",
      "iCal feed URL also supported as a no-OAuth fallback",
      "Refreshes every 15 min in production",
    ],
    exampleScenarios: [
      "You have a vendor visit Wed 3pm → couple opens /book/your-studio → Wed 3pm is hidden, no double-booking risk.",
    ],
    envVars: [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REDIRECT_URI",
    ],
    setupNotes:
      "Google Cloud OAuth client (separate from Gmail), Calendar scope. Free.",
  },
  anthropic: {
    key: "anthropic",
    label: "AI Co-pilot + autopilot",
    oneLiner:
      "Claude reads vendor email threads, drafts personalized RFPs, generates your starter budget, runs the onboarding chat.",
    whatItDoes: [
      "Onboarding chat — extracts your wedding details in 10 questions",
      "Generates a personalized 70-line budget tree scaled to your guest count",
      "Reads vendor replies → emits structured status updates → patches the database",
      "Drafts vendor RFPs personalized per recipient",
      "Powers /assistant Co-pilot for ad-hoc questions about your wedding",
    ],
    exampleScenarios: [
      "Maria's email arrives with 'we can do your wedding for $4,500 with delivery' → Claude reads it → vendor card updates to Quoted $4,500 → budget line auto-rolls to $4,500 committed.",
    ],
    envVars: ["ANTHROPIC_API_KEY"],
    setupNotes:
      "Anthropic API key. ~$5-15/mo per couple in usage. Daily org budget cap is $5/day already enforced.",
  },
  cron: {
    key: "cron",
    label: "Daily 8 AM digest",
    oneLiner:
      "Cron job that emails a 'today on wedding-os' digest of overnight changes.",
    whatItDoes: [
      "POSTs /api/cron/digest with x-cron-secret header at 8 AM local",
      "Walks workspaces with unread alerts → sends a friendly summary email",
      "Marks alerts as included_in_digest so they don't show twice",
    ],
    exampleScenarios: [
      "Overnight: 2 vendors replied, 1 quote came in. 8 AM email: 'Today on wedding-os: 3 updates. Tap to review.'",
    ],
    envVars: ["CRON_SECRET"],
    setupNotes:
      "Set CRON_SECRET in Railway, configure Railway Cron to POST daily at 8 AM with the matching header.",
  },
};

export function getFeatureSpec(key: FeatureKey): FeatureSpec {
  const base = FEATURES[key];
  return {
    ...base,
    ready: isFeatureReady(key),
  };
}

export function isFeatureReady(key: FeatureKey): boolean {
  switch (key) {
    case "gmail":
      return Boolean(
        ENV.GMAIL_OAUTH_CLIENT_ID &&
          ENV.GMAIL_OAUTH_CLIENT_SECRET &&
          ENV.GMAIL_OAUTH_REDIRECT_URI,
      );
    case "google_places":
      return Boolean(ENV.GOOGLE_PLACES_API_KEY);
    case "brave_search":
      return Boolean(ENV.BRAVE_SEARCH_API_KEY);
    case "stripe":
      return Boolean(ENV.STRIPE_SECRET_KEY);
    case "resend":
      return Boolean(ENV.RESEND_API_KEY);
    case "google_calendar":
      return Boolean(
        ENV.GOOGLE_OAUTH_CLIENT_ID && ENV.GOOGLE_OAUTH_CLIENT_SECRET,
      );
    case "anthropic":
      return Boolean(ENV.ANTHROPIC_API_KEY);
    case "cron":
      return Boolean(ENV.CRON_SECRET);
  }
}

export function listAllFeatures(): FeatureSpec[] {
  return (Object.keys(FEATURES) as FeatureKey[]).map(getFeatureSpec);
}
