// MOUNT INSTRUCTIONS (post-merge):
//
// This widget is a self-fetching server component that other agents can
// drop onto the couple dashboard at /(app)/page.tsx. To mount, add this
// to the dashboard page's render block — typically right under the hero,
// above the "Stats strip":
//
//   import { AutopilotTodayWidget } from "@/components/autopilot/today-widget";
//   ...
//   <AutopilotTodayWidget />
//
// The widget reads alerts + vendors with the user's RLS context, so it
// silently shows nothing pre-Wave-3 (when the tables don't exist yet) by
// catching its own errors. No props required.
//
// AUTOPILOT-DASHBOARD did NOT mount this on /(app)/page.tsx — that file is
// being edited by another agent; mounting here would cause a worktree race.
// Whoever merges last should add the import + JSX above.

import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  VENDOR_AUTOPILOT_LABEL,
  type AlertRow,
  type VendorAutopilotStatus,
} from "@/lib/autopilot-types";
import { AlertCard } from "./alert-card";

interface VendorSlim {
  autopilot_status: VendorAutopilotStatus;
}

export async function AutopilotTodayWidget() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Cast — alerts + vendors columns not yet in generated Database types.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (col: string, vals: string[]) => {
          is: (col: string, v: null) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: AlertRow[] | null }>;
          };
        };
        order?: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: VendorSlim[] | null }>;
      };
    };
  };

  let alerts: AlertRow[] = [];
  let vendors: VendorSlim[] = [];
  try {
    const [alertRes, vendorRes] = await Promise.all([
      sb
        .from("alerts")
        .select(
          "id, workspace_id, org_id, audience, kind, severity, title, body, action_url, payload, related_vendor_id, related_lead_id, related_budget_line_id, read_at, dismissed_at, included_in_digest_at, created_at",
        )
        .in("audience", ["couple", "both"])
        .is("dismissed_at", null)
        .order("created_at", { ascending: false }),
      (
        sb
          .from("vendors")
          .select("autopilot_status") as unknown as {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: VendorSlim[] | null }>;
        }
      ).order("name", { ascending: true }),
    ]);
    alerts = (alertRes.data ?? []) as AlertRow[];
    vendors = (vendorRes.data ?? []) as VendorSlim[];
  } catch {
    return null; // Pre-migration tolerant: render nothing.
  }

  if (alerts.length === 0 && vendors.length === 0) {
    return null;
  }

  // Pipeline summary: count by autopilot_status, surface the big buckets.
  const counts = new Map<VendorAutopilotStatus, number>();
  for (const v of vendors) {
    counts.set(v.autopilot_status, (counts.get(v.autopilot_status) ?? 0) + 1);
  }

  const buckets: VendorAutopilotStatus[] = [
    "researching",
    "contacted",
    "quoted",
    "booked",
  ];
  const summaryParts = buckets
    .map((s) => {
      const c = counts.get(s) ?? 0;
      return c > 0 ? `${c} ${VENDOR_AUTOPILOT_LABEL[s].toLowerCase()}` : null;
    })
    .filter((s): s is string => s !== null);

  const top = alerts.slice(0, 3);
  const moreCount = Math.max(0, alerts.length - top.length);

  return (
    <section className="rounded-2xl border border-stone-200 bg-gradient-to-br from-white via-white to-stone-50 p-5 shadow-sm">
      <div className="mb-4 flex items-end justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-white">
            <Plane className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Autopilot today
            </div>
            <div className="font-serif text-xl leading-none">
              {alerts.length === 0
                ? "All quiet"
                : `${alerts.length} thing${alerts.length === 1 ? "" : "s"} waiting`}
            </div>
          </div>
        </div>
        <Link
          href="/autopilot"
          className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
        >
          Open <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {top.length > 0 && (
        <div className="mb-4 grid gap-2 md:grid-cols-3">
          {top.map((a) => (
            <AlertCard key={a.id} alert={a} variant="compact" />
          ))}
        </div>
      )}

      {summaryParts.length > 0 && (
        <div className="text-xs text-stone-600">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Pipeline
          </span>{" "}
          · {summaryParts.join(" · ")}
          {moreCount > 0 && (
            <span className="ml-2 text-stone-400">
              +{moreCount} more alert{moreCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
