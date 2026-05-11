import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutopilotDashboard } from "@/components/autopilot/autopilot-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import type {
  AlertRow,
  AutopilotRunRow,
  GmailConnectionRow,
  VendorAutopilotStatus,
} from "@/lib/autopilot-types";
import type { VendorCategory, VendorStatus } from "@/lib/vendor-types";
import { normalizeSkin } from "@/lib/workspace-skin";
import { isB2B, resolveWorkspaceMode } from "@/lib/workspace-mode";

export const dynamic = "force-dynamic";

// The dashboard needs only a slice of vendors for category breakdown +
// "today's queue" cross-references. Keep the read narrow.
export interface AutopilotVendor {
  id: string;
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  autopilot_status: VendorAutopilotStatus;
  autopilot_enabled: boolean;
  ai_summary: string | null;
  quote_eur: number | null;
  contact_email: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
}

export default async function AutopilotPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // T1.5 — autopilot is a B2C feature. Planner-served couples have their
  // planner handling vendor outreach off-platform (WhatsApp, email). For
  // them the autopilot dashboard is irrelevant noise. Show a clear "your
  // planner handles this" splash instead of the dashboard.
  const sbWs = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        limit: (n: number) => {
          maybeSingle: () => Promise<{
            data: { skin?: string | null } | null;
          }>;
        };
      };
    };
  };
  let workspaceSkin: string | null = null;
  try {
    const { data: ws } = await sbWs
      .from("workspaces")
      .select("skin")
      .limit(1)
      .maybeSingle();
    workspaceSkin = ws?.skin ?? null;
  } catch {
    // pre-migration tolerant
  }
  const mode = resolveWorkspaceMode(normalizeSkin(workspaceSkin));
  if (isB2B(mode)) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Vendor outreach
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Autopilot
          </h1>
        </header>
        <Card className="border-stone-200 bg-stone-50/60">
          <CardContent className="space-y-3 py-8 text-center">
            <p className="font-serif text-2xl text-stone-800">
              Your planner runs this for you.
            </p>
            <p className="mx-auto max-w-md text-sm text-stone-600">
              Autopilot drafts vendor outreach emails, chases responses, and
              parses replies — but for planner-served weddings, your planner
              already handles all of that. Vendor coordination lives in their
              workflow.
            </p>
            <p className="mx-auto max-w-md text-sm text-stone-600">
              You can still see vendors + quotes + payments under{" "}
              <Link href="/vendors" className="font-medium underline">
                /vendors
              </Link>{" "}
              and{" "}
              <Link href="/payments" className="font-medium underline">
                /payments
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // RLS-enforced cast: vendors / alerts / autopilot_runs / gmail_connections
  // all have new (Wave 3) columns or are net-new tables that aren't yet in
  // the generated Database types.
  type SbCast = {
    from: (table: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit?: (n: number) => Promise<{ data: unknown }>;
        } & Promise<{ data: unknown }>;
        eq?: (col: string, val: unknown) => {
          is?: (col: string, val: null) => {
            gte?: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{
                data: unknown;
              }>;
            };
          };
          order?: (col: string, opts: { ascending: boolean }) => Promise<{
            data: unknown;
          }>;
        };
        in?: (col: string, vals: string[]) => {
          is: (col: string, val: null) => {
            gte: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{
                data: unknown;
              }>;
            };
          };
        };
      };
    };
  };

  const sb = supabase as unknown as SbCast;

  // ── Alerts: couple-audience, not dismissed, last 30 days ─────────────
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const alertsPromise = (
    sb
      .from("alerts")
      .select(
        "id, workspace_id, org_id, audience, kind, severity, title, body, action_url, payload, related_vendor_id, related_lead_id, related_budget_line_id, read_at, dismissed_at, included_in_digest_at, created_at",
      )
      .in!("audience", ["couple", "both"])
      .is("dismissed_at", null)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
  ) as Promise<{ data: AlertRow[] | null }>;

  // ── Vendors: full set with autopilot fields ──────────────────────────
  const vendorsPromise = (
    sb
      .from("vendors")
      .select(
        "id, name, category, status, autopilot_status, autopilot_enabled, ai_summary, quote_eur, contact_email, last_inbound_at, last_outbound_at",
      )
      .order("name", { ascending: true })
  ) as Promise<{ data: AutopilotVendor[] | null }>;

  // ── Gmail connection (latest one for this workspace) ─────────────────
  const gmailPromise = (
    sb
      .from("gmail_connections")
      .select(
        "id, org_id, workspace_id, user_id, email, status, last_synced_at, last_error, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
  ) as Promise<{ data: GmailConnectionRow[] | null }>;

  // ── Autopilot runs (latest 10 for activity feed) ────────────────────
  const runsPromise = (
    sb
      .from("autopilot_runs")
      .select(
        "id, kind, model, cost_usd, status, duration_ms, triggered_by, created_at",
      )
      .order("created_at", { ascending: false })
  ) as Promise<{ data: AutopilotRunRow[] | null }>;

  const [alertsRes, vendorsRes, gmailRes, runsRes] = await Promise.all([
    alertsPromise,
    vendorsPromise,
    gmailPromise,
    runsPromise,
  ]);

  const alerts = (alertsRes.data ?? []) as AlertRow[];
  const vendors = (vendorsRes.data ?? []) as AutopilotVendor[];
  const gmail = (gmailRes.data ?? []) as GmailConnectionRow[];
  const runs = ((runsRes.data ?? []) as AutopilotRunRow[]).slice(0, 10);

  const gmailLatest = gmail[0] ?? null;

  return (
    <AutopilotDashboard
      alerts={alerts}
      vendors={vendors}
      gmailStatus={gmailLatest}
      runs={runs}
    />
  );
}
