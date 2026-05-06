import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  deriveClientStatus,
  type ClientRosterRow,
  type ClientStatus,
} from "@/lib/admin-client-types";

interface WorkspaceRow {
  id: string;
  name: string;
  wedding_date: string | null;
  base_currency: string;
  created_at: string;
}

interface VenueAggRow {
  workspace_id: string;
  status: string | null;
  updated_at: string;
}

interface VendorAggRow {
  workspace_id: string;
  status: string | null;
  updated_at: string;
}

const STATUS_TONE: Record<ClientStatus, string> = {
  planning: "bg-amber-50 text-amber-800 ring-amber-200",
  booked: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  done: "bg-stone-100 text-stone-600 ring-stone-200",
};

const STATUS_LABEL: Record<ClientStatus, string> = {
  planning: "Planning",
  booked: "Booked",
  done: "Done",
};

const ACTIVE_VENUE_STATUSES = new Set([
  "shortlisted",
  "visited",
  "quoted",
  "decided",
]);
const ACTIVE_VENDOR_STATUSES = new Set([
  "researching",
  "shortlisted",
  "booked",
]);

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "No activity yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No activity yet";
  const diffMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default async function AdminClientsPage() {
  const supabase = createClient();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, wedding_date, base_currency, created_at")
    .order("wedding_date", { ascending: true, nullsFirst: false });

  const list: WorkspaceRow[] = (workspaces ?? []) as WorkspaceRow[];

  // Pull venue + vendor aggregates in two cheap queries (RLS scopes them to org).
  // The `vendors` table isn't in types.gen.ts yet — use a loose cast so the
  // build stays clean even before that gets regenerated.
  type LooseClient = {
    from: (table: string) => {
      select: (cols: string) => Promise<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>;
    };
  };
  const sb = supabase as unknown as LooseClient;

  let venueRows: VenueAggRow[] = [];
  try {
    const { data } = await sb
      .from("venues")
      .select("workspace_id, status, updated_at");
    venueRows = (data ?? []) as unknown as VenueAggRow[];
  } catch {
    venueRows = [];
  }

  let vendorRows: VendorAggRow[] = [];
  try {
    const { data } = await sb
      .from("vendors")
      .select("workspace_id, status, updated_at");
    vendorRows = (data ?? []) as unknown as VendorAggRow[];
  } catch {
    vendorRows = [];
  }

  const today = new Date();

  const rows: ClientRosterRow[] = list.map((w) => {
    const venuesForWs = venueRows.filter((v) => v.workspace_id === w.id);
    const vendorsForWs = vendorRows.filter((v) => v.workspace_id === w.id);

    const venuesOfInterest = venuesForWs.filter((v) =>
      v.status ? ACTIVE_VENUE_STATUSES.has(v.status) : false,
    ).length;
    const vendorsActive = vendorsForWs.filter((v) =>
      v.status ? ACTIVE_VENDOR_STATUSES.has(v.status) : false,
    ).length;

    const lastActivity = [
      ...venuesForWs.map((v) => v.updated_at),
      ...vendorsForWs.map((v) => v.updated_at),
    ]
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    return {
      id: w.id,
      name: w.name,
      wedding_date: w.wedding_date,
      base_currency: w.base_currency,
      created_at: w.created_at,
      status: deriveClientStatus(w.wedding_date, today),
      venues_of_interest: venuesOfInterest,
      vendors_active: vendorsActive,
      last_activity_at: lastActivity,
    };
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Roster
          </div>
          <h1 className="font-serif text-4xl font-light leading-tight tracking-tight md:text-5xl">
            Clients
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
            One row per couple workspace. Tap a row to see their plan, branding,
            and activity. New-client onboarding is wired in a sibling brief.
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.2em] text-stone-500">
              <tr>
                <th className="px-5 py-3 font-medium">Couple</th>
                <th className="px-5 py-3 font-medium">Wedding date</th>
                <th className="px-5 py-3 text-right font-medium">Venues</th>
                <th className="px-5 py-3 text-right font-medium">Vendors</th>
                <th className="px-5 py-3 font-medium">Last activity</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="group transition hover:bg-stone-50"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/clients/${r.id}`}
                      className="font-medium text-stone-900 transition group-hover:text-stone-700"
                    >
                      {r.name}
                    </Link>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wider text-stone-400">
                      {r.base_currency}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-stone-700">
                    {formatDate(r.wedding_date)}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-stone-700">
                    {r.venues_of_interest}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-stone-700">
                    {r.vendors_active}
                  </td>
                  <td className="px-5 py-4 text-stone-500">
                    {formatRelative(r.last_activity_at)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${STATUS_TONE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/clients/${r.id}`}
                      className="inline-flex items-center gap-1 text-stone-400 transition group-hover:text-stone-900"
                      aria-label={`Open ${r.name}`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
      <h2 className="font-serif text-2xl font-light text-stone-800">
        No clients yet
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-sm text-stone-500">
        Create your first couple workspace from the new-client flow once it
        ships in the parallel brief.
      </p>
    </div>
  );
}
