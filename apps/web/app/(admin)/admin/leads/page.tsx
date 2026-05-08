import { format, parseISO } from "date-fns";
import Link from "next/link";
import { ArrowUpRight, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadStatusBadge } from "@/components/admin-leads/lead-status-badge";
import {
  LEAD_SOURCE_LABEL,
  type LeadRow,
  type LeadStatus,
} from "@/lib/lead-types";

export const dynamic = "force-dynamic";

interface WorkspaceLite {
  id: string;
  name: string;
}

export default async function PlannerLeadsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: LeadRow[] | null }>;
      };
    };
  };

  const [{ data: leadsRaw }, { data: workspacesRaw }] = await Promise.all([
    sb
      .from("leads")
      .select(
        "id, org_id, referring_workspace_id, source, status, couple_names, partner_a_name, partner_b_name, email, phone, wedding_date, guest_count, budget_band, city_or_region, notes, scheduled_call_at, scheduled_call_duration_minutes, converted_workspace_id, converted_at, metadata, created_at, updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("workspaces").select("id, name"),
  ]);

  const leads = (leadsRaw ?? []) as LeadRow[];
  const workspaces = (workspacesRaw ?? []) as WorkspaceLite[];
  const workspaceById = new Map(workspaces.map((w) => [w.id, w.name]));

  // Top-of-funnel stats
  const newCount = leads.filter((l) => l.status === "new").length;
  const bookedCount = leads.filter((l) => l.status === "booked_call").length;
  const qualifiedCount = leads.filter(
    (l) => l.status === "qualified" || l.status === "contacted",
  ).length;
  const convertedCount = leads.filter((l) => l.status === "converted").length;
  const totalCount = leads.length;
  const conversionRate =
    totalCount > 0 ? Math.round((convertedCount / totalCount) * 100) : 0;

  // 30-day trend
  const now = Date.now();
  const last30 = leads.filter(
    (l) => now - new Date(l.created_at).getTime() < 30 * 24 * 60 * 60 * 1000,
  ).length;

  const filterStatus = (searchParams.status ?? "open") as
    | LeadStatus
    | "open"
    | "all";
  const filtered =
    filterStatus === "all"
      ? leads
      : filterStatus === "open"
        ? leads.filter(
            (l) =>
              l.status !== "converted" &&
              l.status !== "lost",
          )
        : leads.filter((l) => l.status === filterStatus);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Lead pipeline
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Inquiries
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every lead from your booking page, your couples&rsquo; public
            wedding sites, and manual entries. Track the funnel from inquiry
            to converted client.
          </p>
        </div>
        <div className="hidden md:block">
          <Link
            href="/admin/booking"
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-rose-500 hover:text-rose-800"
          >
            Booking page settings
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total" value={String(totalCount)} sub="all-time" />
        <StatCard label="New" value={String(newCount)} tone="rose" sub="awaiting reply" />
        <StatCard label="Booked calls" value={String(bookedCount)} tone="amber" />
        <StatCard
          label="Qualified"
          value={String(qualifiedCount)}
          tone="emerald"
        />
        <StatCard
          label="Last 30 days"
          value={String(last30)}
          sub={`${conversionRate}% converted`}
        />
      </section>

      <FilterBar current={filterStatus} counts={{
        open: leads.filter((l) => l.status !== "converted" && l.status !== "lost").length,
        new: newCount,
        booked_call: bookedCount,
        qualified: qualifiedCount,
        converted: convertedCount,
        lost: leads.filter((l) => l.status === "lost").length,
        all: totalCount,
      }} />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PlusCircle className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <h3 className="font-serif text-xl font-light text-stone-800">
              No leads in this view
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
              Publish your booking page so couples can reach you, or add a
              lead manually if someone DMed you.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/admin/booking"
                className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-stone-800"
              >
                Set up booking page →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto rounded-none border-y border-stone-200 bg-white sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border-x">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <th className="px-4 py-3 text-left">Lead</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Source</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Wedding</th>
                <th className="px-4 py-3 text-left">Budget</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((l) => {
                const name =
                  l.couple_names ||
                  [l.partner_a_name, l.partner_b_name].filter(Boolean).join(" & ") ||
                  "Unnamed";
                const referrer = l.referring_workspace_id
                  ? workspaceById.get(l.referring_workspace_id) ?? null
                  : null;
                return (
                  <tr key={l.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/leads/${l.id}`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {name}
                      </Link>
                      <div className="text-[11px] text-stone-500">
                        {l.email || l.phone || "—"}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-600 md:table-cell">
                      <div className="text-xs">{LEAD_SOURCE_LABEL[l.source]}</div>
                      {referrer && (
                        <div className="text-[10px] text-stone-400">
                          via {referrer}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-stone-600 md:table-cell">
                      <div className="text-xs">
                        {l.wedding_date ? formatDate(l.wedding_date) : "—"}
                      </div>
                      {l.guest_count != null && (
                        <div className="text-[10px] text-stone-400">
                          {l.guest_count} guests
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">
                      {l.budget_band ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={l.status} />
                      {l.scheduled_call_at && (
                        <div className="mt-1 text-[10px] text-amber-800">
                          Call {formatRelative(l.scheduled_call_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {formatRelative(l.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "rose" | "amber" | "emerald";
}) {
  const toneCls =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-stone-200 bg-white";
  return (
    <div className={`rounded-2xl border ${toneCls} p-4`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-medium tabular-nums md:text-3xl">
        {value}
      </div>
      {sub && <div className="text-[10px] uppercase tracking-wider opacity-60">{sub}</div>}
    </div>
  );
}

function FilterBar({
  current,
  counts,
}: {
  current: string;
  counts: Record<string, number>;
}) {
  const tabs: Array<{ key: string; label: string }> = [
    { key: "open", label: "Open" },
    { key: "new", label: "New" },
    { key: "booked_call", label: "Calls booked" },
    { key: "qualified", label: "Qualified" },
    { key: "converted", label: "Converted" },
    { key: "lost", label: "Lost" },
    { key: "all", label: "All" },
  ];
  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={t.key === "open" ? "/admin/leads" : `/admin/leads?status=${t.key}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            }`}
          >
            {t.label}
            <Badge
              variant="secondary"
              className="ml-1 bg-stone-100 px-1.5 py-0 text-[9px] text-stone-700"
            >
              {counts[t.key] ?? 0}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}

function formatDate(d: string) {
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return d;
  }
}

function formatRelative(iso: string): string {
  const dt = new Date(iso).getTime();
  const now = Date.now();
  const diff = dt - now;
  const abs = Math.abs(diff);
  const days = Math.round(abs / (1000 * 60 * 60 * 24));
  if (abs < 60 * 1000) return diff < 0 ? "just now" : "in seconds";
  if (abs < 60 * 60 * 1000) {
    const mins = Math.round(abs / (1000 * 60));
    return diff < 0 ? `${mins}m ago` : `in ${mins}m`;
  }
  if (abs < 24 * 60 * 60 * 1000) {
    const hrs = Math.round(abs / (1000 * 60 * 60));
    return diff < 0 ? `${hrs}h ago` : `in ${hrs}h`;
  }
  return diff < 0 ? `${days}d ago` : `in ${days}d`;
}
