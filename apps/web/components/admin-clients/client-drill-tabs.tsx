"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceTable } from "@/components/admin-billing/invoice-table";
import { NewInvoiceForm } from "@/components/admin-billing/new-invoice-form";
import type { WorkspaceBrandingRow } from "@/lib/admin-client-types";

interface InvoiceRow {
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
}

interface WorkspaceShape {
  id: string;
  name: string;
  wedding_date: string | null;
  base_currency: string;
  created_at: string;
}

interface DrillStats {
  venues_total: number;
  venues_of_interest: number;
  vendors_total: number;
  vendors_active: number;
  last_activity_at: string | null;
  lead_venue_name: string | null;
}

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

export function ClientDrillTabs({
  workspace,
  stats,
  branding,
  invoices,
}: {
  workspace: WorkspaceShape;
  stats: DrillStats;
  branding: WorkspaceBrandingRow | null;
  invoices: InvoiceRow[];
}) {
  const outstandingTotal = invoices
    .filter((i) => !i.paid_at)
    .reduce((acc, i) => acc + Number(i.amount_eur), 0);
  const overdueCount = invoices.filter((i) => {
    if (i.paid_at || !i.due_at) return false;
    return new Date(i.due_at).getTime() < Date.now();
  }).length;
  const workspaceById = new Map<string, string>([
    [workspace.id, workspace.name],
  ]);

  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="billing">
          Billing
          {invoices.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-stone-200 px-1 text-[10px]">
              {invoices.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="Venues" value={String(stats.venues_total)} sub={`${stats.venues_of_interest} of interest`} />
          <Stat label="Vendors" value={String(stats.vendors_total)} sub={`${stats.vendors_active} active`} />
          <Stat
            label="Lead venue"
            value={stats.lead_venue_name ?? "—"}
            sub={stats.lead_venue_name ? "Couple's lead pick" : "Not yet picked"}
          />
          <Stat
            label="Last activity"
            value={formatDate(stats.last_activity_at)}
            sub="across venues + vendors"
          />
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 text-[11px] uppercase tracking-[0.2em] text-stone-500">
            Workspace
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
            <Row k="Workspace name" v={workspace.name} />
            <Row k="Wedding date" v={formatDate(workspace.wedding_date)} />
            <Row k="Base currency" v={workspace.base_currency} />
            <Row k="Created" v={formatDate(workspace.created_at)} />
          </dl>
          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <Link
              href={`/?as=${workspace.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 font-medium text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
            >
              View as workspace
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link
              href={`/admin/clients/${workspace.id}/branding`}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 font-medium text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
            >
              Edit branding
            </Link>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="branding" className="space-y-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 text-[11px] uppercase tracking-[0.2em] text-stone-500">
            Current branding
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                Accent
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="inline-block h-8 w-8 rounded-full ring-1 ring-stone-200"
                  style={{ background: branding?.accent_hex ?? "#9d174d" }}
                />
                <span className="font-mono text-sm text-stone-700">
                  {branding?.accent_hex ?? "#9d174d (default)"}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                Display name
              </div>
              <div className="mt-2 text-sm text-stone-700">
                {branding?.planner_display_name || (
                  <span className="text-stone-400">Not set</span>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                Logo
              </div>
              <div className="mt-2 text-sm text-stone-700">
                {branding?.logo_storage_path ? (
                  <span className="font-mono text-xs text-stone-500">
                    {branding.logo_storage_path}
                  </span>
                ) : (
                  <span className="text-stone-400">No logo uploaded</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Link
              href={`/admin/clients/${workspace.id}/branding`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              Open branding editor
            </Link>
          </div>
        </div>
        <p className="text-xs text-stone-500">
          Branding is read by the couple shell. Wiring it into the couple shell
          itself happens in a follow-up brief.
        </p>
      </TabsContent>

      <TabsContent value="billing" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-900">
              Outstanding
            </div>
            <div className="mt-1 font-serif text-3xl font-medium tabular-nums text-amber-900">
              €{Math.round(outstandingTotal).toLocaleString()}
            </div>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              overdueCount > 0
                ? "border-rose-200 bg-rose-50"
                : "border-stone-200 bg-white"
            }`}
          >
            <div
              className={`text-[10px] uppercase tracking-[0.2em] ${
                overdueCount > 0 ? "text-rose-900" : "text-stone-500"
              }`}
            >
              Overdue
            </div>
            <div
              className={`mt-1 font-serif text-3xl font-medium tabular-nums ${
                overdueCount > 0 ? "text-rose-900" : ""
              }`}
            >
              {overdueCount}
            </div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Total invoices
            </div>
            <div className="mt-1 font-serif text-3xl font-medium tabular-nums">
              {invoices.length}
            </div>
          </div>
        </div>

        <NewInvoiceForm
          workspaces={[{ id: workspace.id, name: workspace.name }]}
          defaultWorkspaceId={workspace.id}
        />

        {invoices.length > 0 ? (
          <InvoiceTable
            invoices={invoices}
            workspaceById={workspaceById}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-12 text-center text-sm text-stone-500">
            No invoices yet for {workspace.name}. Add the first one above —
            retainer, milestone, or final balance.
          </div>
        )}
      </TabsContent>

      <TabsContent value="activity">
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
          <h2 className="font-serif text-2xl font-light text-stone-800">
            Activity timeline
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-stone-500">
            No activity tracked yet. The activity feed turns on once the
            workspace logs notes, decisions, or vendor moves.
          </p>
        </div>
      </TabsContent>

      <TabsContent value="settings">
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
          <h2 className="font-serif text-2xl font-light text-stone-800">
            Workspace settings
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-stone-500">
            Per-workspace settings (rename, archive, transfer ownership) come in
            a later wave.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </div>
      <div className="mb-1 mt-2 truncate font-serif text-2xl font-light leading-none">
        {value}
      </div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 py-2 last:border-b-0">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right font-medium text-stone-900">{v}</dd>
    </div>
  );
}
