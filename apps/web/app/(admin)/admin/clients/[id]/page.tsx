import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ClientDrillTabs } from "@/components/admin-clients/client-drill-tabs";
import {
  deriveClientStatus,
  type ClientStatus,
} from "@/lib/admin-client-types";

interface VenueAggRow {
  id: string;
  status: string | null;
  updated_at: string;
  is_lead_pick: boolean | null;
  name: string;
}

interface VendorAggRow {
  id: string;
  status: string | null;
  updated_at: string;
  category: string | null;
  name: string;
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
    month: "long",
    day: "numeric",
  });
}

export default async function AdminClientDrillPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, name, wedding_date, base_currency, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !workspace) notFound();

  const { data: branding } = await supabase
    .from("workspace_branding")
    .select("workspace_id, accent_hex, logo_storage_path, planner_display_name, updated_at")
    .eq("workspace_id", params.id)
    .maybeSingle();

  // Loose-typed reads for vendors (not in types.gen.ts) and venues (we only
  // need a subset here so a narrow cast keeps the file self-contained).
  type LooseClient = {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };
  const sb = supabase as unknown as LooseClient;

  let venues: VenueAggRow[] = [];
  try {
    const { data } = await sb
      .from("venues")
      .select("id, name, status, updated_at, is_lead_pick")
      .eq("workspace_id", params.id);
    venues = (data ?? []) as unknown as VenueAggRow[];
  } catch {
    venues = [];
  }

  let vendors: VendorAggRow[] = [];
  try {
    const { data } = await sb
      .from("vendors")
      .select("id, name, category, status, updated_at")
      .eq("workspace_id", params.id);
    vendors = (data ?? []) as unknown as VendorAggRow[];
  } catch {
    vendors = [];
  }

  // Per-client invoices
  let invoices: Array<{
    id: string;
    workspace_id: string;
    label: string;
    amount_eur: number;
    due_at: string | null;
    sent_at: string | null;
    paid_at: string | null;
    paid_via: string | null;
    notes: string | null;
    external_url: string | null;
    created_at: string;
  }> = [];
  try {
    const { data } = await sb
      .from("planner_invoices")
      .select(
        "id, workspace_id, label, amount_eur, due_at, sent_at, paid_at, paid_via, notes, external_url, created_at",
      )
      .eq("workspace_id", params.id);
    invoices = (data ?? []) as unknown as typeof invoices;
  } catch {
    invoices = [];
  }
  invoices.sort((a, b) => {
    const ad = a.due_at ? +new Date(a.due_at) : 0;
    const bd = b.due_at ? +new Date(b.due_at) : 0;
    return ad - bd;
  });

  const today = new Date();
  const status = deriveClientStatus(workspace.wedding_date, today);
  const venuesOfInterest = venues.filter((v) =>
    v.status ? ACTIVE_VENUE_STATUSES.has(v.status) : false,
  ).length;
  const vendorsActive = vendors.filter((v) =>
    v.status ? ACTIVE_VENDOR_STATUSES.has(v.status) : false,
  ).length;
  const leadVenue = venues.find((v) => v.is_lead_pick) ?? null;

  const lastActivityIso =
    [...venues.map((v) => v.updated_at), ...vendors.map((v) => v.updated_at)]
      .filter(Boolean)
      .sort()
      .pop() ?? null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1 text-xs text-stone-500 transition hover:text-stone-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All clients
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Client
          </div>
          <h1 className="font-serif text-4xl font-light leading-tight tracking-tight md:text-5xl">
            {workspace.name}
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            Wedding date: <span className="text-stone-900">{formatDate(workspace.wedding_date)}</span>
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-inset ${STATUS_TONE[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </header>

      <ClientDrillTabs
        workspace={{
          id: workspace.id,
          name: workspace.name,
          wedding_date: workspace.wedding_date,
          base_currency: workspace.base_currency,
          created_at: workspace.created_at,
        }}
        stats={{
          venues_total: venues.length,
          venues_of_interest: venuesOfInterest,
          vendors_total: vendors.length,
          vendors_active: vendorsActive,
          last_activity_at: lastActivityIso,
          lead_venue_name: leadVenue?.name ?? null,
        }}
        branding={
          branding
            ? {
                workspace_id: branding.workspace_id,
                accent_hex: branding.accent_hex,
                logo_storage_path: branding.logo_storage_path,
                planner_display_name: branding.planner_display_name,
                updated_at: branding.updated_at,
              }
            : null
        }
        invoices={invoices}
      />
    </div>
  );
}
