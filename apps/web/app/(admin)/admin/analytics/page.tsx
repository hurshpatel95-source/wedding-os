import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface InvoiceRow {
  id: string;
  workspace_id: string;
  amount_eur: number;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface VendorMixRow {
  workspace_id: string;
  category: string;
  status: string;
}

interface EstimateRow {
  workspace_id: string;
  baseline_total_eur: number | null;
}

interface WorkspaceRow {
  id: string;
  name: string;
  wedding_date: string | null;
  created_at: string;
}

const VENDOR_CATEGORY_LABEL: Record<string, string> = {
  photographer: "Photo",
  videographer: "Video",
  florist: "Florist",
  dj: "DJ",
  live_band: "Band",
  mua: "Hair & MU",
  caterer: "Catering",
  rentals: "Rentals",
  transportation: "Transport",
  officiant: "Officiant",
  stationery: "Stationery",
  cake: "Cake",
  decor: "Décor",
  lighting: "Lighting",
  rabbi_priest: "Officiant",
  baker: "Baker",
  photo_booth: "Photo booth",
  videography: "Video",
  bartender: "Bar",
  dance_instructor: "Dance",
  rentals_furniture: "Furniture",
  other: "Other",
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: { compare?: string };
}) {
  const supabase = createClient();
  const compareYoY = searchParams.compare === "yoy";

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{
        data: Array<Record<string, unknown>> | null;
      }>;
    };
  };

  const [
    { data: invoicesRaw },
    { data: estimatesRaw },
    { data: vendorsRaw },
    { data: workspacesRaw },
  ] = await Promise.all([
    sb
      .from("planner_invoices")
      .select("id, workspace_id, amount_eur, due_at, paid_at, created_at"),
    sb.from("budget_estimates").select("workspace_id, baseline_total_eur"),
    sb.from("vendors").select("workspace_id, category, status"),
    sb.from("workspaces").select("id, name, wedding_date, created_at"),
  ]);

  const invoices = (invoicesRaw ?? []) as unknown as InvoiceRow[];
  const estimates = (estimatesRaw ?? []) as unknown as EstimateRow[];
  const vendors = (vendorsRaw ?? []) as unknown as VendorMixRow[];
  const workspaces = (workspacesRaw ?? []) as unknown as WorkspaceRow[];

  // ── Revenue ────────────────────────────────────────────────────────
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  let revenueYtd = 0;
  let outstandingEur = 0;
  let invoicesYtd = 0;
  let invoicedEverEur = 0;
  for (const inv of invoices) {
    invoicedEverEur += Number(inv.amount_eur);
    if (inv.paid_at) {
      const paidAt = new Date(inv.paid_at).getTime();
      if (paidAt >= yearStart) revenueYtd += Number(inv.amount_eur);
    } else {
      outstandingEur += Number(inv.amount_eur);
    }
    if (new Date(inv.created_at).getTime() >= yearStart) invoicesYtd += 1;
  }
  const collectedRate =
    invoicedEverEur > 0
      ? (invoicedEverEur - outstandingEur) / invoicedEverEur
      : 0;

  // ── Clients ────────────────────────────────────────────────────────
  const today = new Date();
  let activeClients = 0;
  let pastClients = 0;
  let pendingDate = 0;
  for (const w of workspaces) {
    if (!w.wedding_date) {
      pendingDate += 1;
    } else if (new Date(w.wedding_date).getTime() >= today.getTime()) {
      activeClients += 1;
    } else {
      pastClients += 1;
    }
  }

  // ── Average client budget (lowest baseline per workspace) ─────────
  const lowestByWs = new Map<string, number>();
  for (const e of estimates) {
    const v = Number(e.baseline_total_eur ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    const cur = lowestByWs.get(e.workspace_id);
    if (cur == null || v < cur) lowestByWs.set(e.workspace_id, v);
  }
  const budgetValues = Array.from(lowestByWs.values());
  const avgBudget =
    budgetValues.length > 0
      ? budgetValues.reduce((a, b) => a + b, 0) / budgetValues.length
      : 0;
  const minBudget = budgetValues.length > 0 ? Math.min(...budgetValues) : 0;
  const maxBudget = budgetValues.length > 0 ? Math.max(...budgetValues) : 0;

  // ── Monthly invoice trend (last 12 months) ────────────────────────
  const months: {
    label: string;
    key: string;
    invoiced: number;
    paid: number;
    invoiced_prev: number;
    paid_prev: number;
  }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      key,
      invoiced: 0,
      paid: 0,
      invoiced_prev: 0,
      paid_prev: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  // Same-month-prior-year keys (for YoY overlay)
  const monthPrevIndex = new Map<string, number>();
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const [yStr, mmStr] = m.key.split("-");
    const prevKey = `${Number(yStr) - 1}-${mmStr}`;
    monthPrevIndex.set(prevKey, i);
  }

  for (const inv of invoices) {
    const issued = new Date(inv.created_at);
    const issuedKey = `${issued.getFullYear()}-${String(issued.getMonth() + 1).padStart(2, "0")}`;
    const ii = monthIndex.get(issuedKey);
    if (ii != null) months[ii].invoiced += Number(inv.amount_eur);
    const iiPrev = monthPrevIndex.get(issuedKey);
    if (iiPrev != null) months[iiPrev].invoiced_prev += Number(inv.amount_eur);
    if (inv.paid_at) {
      const paid = new Date(inv.paid_at);
      const paidKey = `${paid.getFullYear()}-${String(paid.getMonth() + 1).padStart(2, "0")}`;
      const pi = monthIndex.get(paidKey);
      if (pi != null) months[pi].paid += Number(inv.amount_eur);
      const piPrev = monthPrevIndex.get(paidKey);
      if (piPrev != null) months[piPrev].paid_prev += Number(inv.amount_eur);
    }
  }
  const maxMonthBar = Math.max(
    1,
    ...months.flatMap((m) =>
      compareYoY
        ? [m.invoiced, m.paid, m.invoiced_prev, m.paid_prev]
        : [m.invoiced, m.paid],
    ),
  );

  // YoY totals (this YTD vs same period last year)
  const monthsElapsedThisYear = now.getMonth() + 1; // 1-12
  const lastYear = now.getFullYear() - 1;
  let revenueYtdLastYear = 0;
  let invoicedYtdLastYear = 0;
  let revenueLastYearFull = 0;
  for (const inv of invoices) {
    if (!inv.paid_at) continue;
    const paid = new Date(inv.paid_at);
    if (paid.getFullYear() === lastYear) {
      revenueLastYearFull += Number(inv.amount_eur);
      if (paid.getMonth() < monthsElapsedThisYear) {
        revenueYtdLastYear += Number(inv.amount_eur);
      }
    }
  }
  for (const inv of invoices) {
    const issued = new Date(inv.created_at);
    if (issued.getFullYear() === lastYear && issued.getMonth() < monthsElapsedThisYear) {
      invoicedYtdLastYear += Number(inv.amount_eur);
    }
  }
  const yoyDelta = revenueYtdLastYear > 0
    ? ((revenueYtd - revenueYtdLastYear) / revenueYtdLastYear) * 100
    : null;

  // ── Per-client revenue drilldown ──────────────────────────────────
  type ClientRevenue = {
    workspace_id: string;
    name: string;
    invoiced_total: number;
    paid_total: number;
    outstanding: number;
    overdue: number;
    invoice_count: number;
    last_paid_at: string | null;
  };
  const clientRev = new Map<string, ClientRevenue>();
  const wsById = new Map<string, WorkspaceRow>();
  for (const w of workspaces) wsById.set(w.id, w);
  for (const inv of invoices) {
    const ws = wsById.get(inv.workspace_id);
    const cr =
      clientRev.get(inv.workspace_id) ?? {
        workspace_id: inv.workspace_id,
        name: ws?.name ?? "Unknown",
        invoiced_total: 0,
        paid_total: 0,
        outstanding: 0,
        overdue: 0,
        invoice_count: 0,
        last_paid_at: null as string | null,
      };
    const amt = Number(inv.amount_eur);
    cr.invoiced_total += amt;
    cr.invoice_count += 1;
    if (inv.paid_at) {
      cr.paid_total += amt;
      if (!cr.last_paid_at || inv.paid_at > cr.last_paid_at) {
        cr.last_paid_at = inv.paid_at;
      }
    } else {
      cr.outstanding += amt;
      if (inv.due_at && new Date(inv.due_at).getTime() < Date.now()) {
        cr.overdue += amt;
      }
    }
    clientRev.set(inv.workspace_id, cr);
  }
  const clientRevList = Array.from(clientRev.values()).sort(
    (a, b) => b.invoiced_total - a.invoiced_total,
  );

  // ── Lead pipeline counts (for the funnel widget) ──────────────────
  const { data: leadsRaw } = await sb
    .from("leads")
    .select("id, source, status, created_at, scheduled_call_at, converted_at");
  const leads = (leadsRaw ?? []) as unknown as Array<{
    source: string;
    status: string;
    created_at: string;
    scheduled_call_at: string | null;
    converted_at: string | null;
  }>;
  const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const leads30 = leads.filter(
    (l) => new Date(l.created_at).getTime() >= last30Days,
  );
  const leadFunnel = {
    new30: leads30.filter((l) => l.status === "new").length,
    contacted30: leads30.filter((l) =>
      ["contacted", "booked_call", "qualified"].includes(l.status),
    ).length,
    booked30: leads30.filter(
      (l) => l.status === "booked_call" || l.scheduled_call_at,
    ).length,
    converted30: leads30.filter((l) => !!l.converted_at).length,
    total30: leads30.length,
    convRate30:
      leads30.length > 0
        ? Math.round(
            (leads30.filter((l) => !!l.converted_at).length /
              leads30.length) *
              100,
          )
        : 0,
  };

  // ── Vendor category mix across all client workspaces ──────────────
  const vendorCatCounts = new Map<string, number>();
  const bookedCatCounts = new Map<string, number>();
  for (const v of vendors) {
    vendorCatCounts.set(v.category, (vendorCatCounts.get(v.category) ?? 0) + 1);
    if (v.status === "booked") {
      bookedCatCounts.set(
        v.category,
        (bookedCatCounts.get(v.category) ?? 0) + 1,
      );
    }
  }
  const topVendorCats = Array.from(vendorCatCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Studio analytics
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          The numbers
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Revenue, outstanding receivables, average client budget, and how
          your vendor mix breaks down across every couple in your studio.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat
          label="Revenue YTD"
          value={`€${Math.round(revenueYtd).toLocaleString()}`}
          sub={`${invoicesYtd} invoices in ${new Date().getFullYear()}`}
          tone="emerald"
        />
        <BigStat
          label="Outstanding"
          value={`€${Math.round(outstandingEur).toLocaleString()}`}
          sub={
            invoicedEverEur > 0
              ? `${Math.round(collectedRate * 100)}% collected`
              : "—"
          }
          tone={outstandingEur > 0 ? "amber" : "stone"}
        />
        <BigStat
          label="Active clients"
          value={String(activeClients)}
          sub={`${pastClients} past · ${pendingDate} no-date`}
          tone="rose"
        />
        <BigStat
          label="Avg client budget"
          value={
            avgBudget > 0
              ? `€${Math.round(avgBudget).toLocaleString()}`
              : "—"
          }
          sub={
            avgBudget > 0
              ? `min €${Math.round(minBudget / 1000)}k · max €${Math.round(maxBudget / 1000)}k`
              : "Couples haven't set estimates yet"
          }
          tone="stone"
        />
      </section>

      <Card>
        <CardContent className="py-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-xl">Monthly cashflow</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 text-[11px] text-stone-600">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-rose-400" />
                  Invoiced
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                  Collected
                </span>
                {compareYoY && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-stone-300" />
                    Last year
                  </span>
                )}
              </div>
              <div className="ml-2 flex rounded-full border border-stone-200 bg-stone-50 p-0.5 text-[11px]">
                <Link
                  href="/admin/analytics"
                  className={`rounded-full px-3 py-1 transition ${
                    !compareYoY
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Trend
                </Link>
                <Link
                  href="/admin/analytics?compare=yoy"
                  className={`rounded-full px-3 py-1 transition ${
                    compareYoY
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  YoY
                </Link>
              </div>
            </div>
          </div>

          {compareYoY && (
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-50/60 p-3 md:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                  Revenue YTD this year
                </div>
                <div className="font-serif text-2xl font-medium tabular-nums">
                  €{Math.round(revenueYtd).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                  Revenue YTD last year
                </div>
                <div className="font-serif text-2xl font-medium tabular-nums text-stone-500">
                  €{Math.round(revenueYtdLastYear).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                  Δ YoY
                </div>
                <div
                  className={`font-serif text-2xl font-medium tabular-nums ${
                    yoyDelta == null
                      ? "text-stone-400"
                      : yoyDelta >= 0
                        ? "text-emerald-700"
                        : "text-rose-700"
                  }`}
                >
                  {yoyDelta == null
                    ? "—"
                    : `${yoyDelta >= 0 ? "+" : ""}${yoyDelta.toFixed(0)}%`}
                </div>
                <div className="text-[10px] text-stone-500">
                  {lastYear} full year: €{Math.round(revenueLastYearFull).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-12 items-end gap-2">
            {months.map((m) => {
              const invH = Math.round((m.invoiced / maxMonthBar) * 120);
              const paidH = Math.round((m.paid / maxMonthBar) * 120);
              const invPrevH = Math.round((m.invoiced_prev / maxMonthBar) * 120);
              const paidPrevH = Math.round((m.paid_prev / maxMonthBar) * 120);
              return (
                <div
                  key={m.key}
                  className="flex flex-col items-center gap-1"
                  title={
                    compareYoY
                      ? `${m.label}: this year €${Math.round(m.paid).toLocaleString()} paid; last year €${Math.round(m.paid_prev).toLocaleString()} paid`
                      : `${m.label}: invoiced €${Math.round(m.invoiced).toLocaleString()}, paid €${Math.round(m.paid).toLocaleString()}`
                  }
                >
                  <div className="flex h-32 w-full items-end gap-0.5">
                    {compareYoY ? (
                      <>
                        <div
                          className="flex-1 rounded-t bg-stone-300"
                          style={{
                            height: `${Math.max(paidPrevH, m.paid_prev > 0 ? 4 : 0)}px`,
                          }}
                        />
                        <div
                          className="flex-1 rounded-t bg-emerald-500"
                          style={{
                            height: `${Math.max(paidH, m.paid > 0 ? 4 : 0)}px`,
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <div
                          className="flex-1 rounded-t bg-rose-300"
                          style={{
                            height: `${Math.max(invH, m.invoiced > 0 ? 4 : 0)}px`,
                          }}
                        />
                        <div
                          className="flex-1 rounded-t bg-emerald-500"
                          style={{
                            height: `${Math.max(paidH, m.paid > 0 ? 4 : 0)}px`,
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lead funnel + per-client revenue */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-serif text-xl">Lead funnel · 30d</h3>
              <Link
                href="/admin/leads"
                className="text-[11px] text-stone-500 underline hover:text-stone-900"
              >
                See all →
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              <FunnelRow
                label="Inquiries"
                value={leadFunnel.total30}
                width={100}
                tone="rose"
              />
              <FunnelRow
                label="Contacted"
                value={leadFunnel.contacted30}
                width={
                  leadFunnel.total30 > 0
                    ? (leadFunnel.contacted30 / leadFunnel.total30) * 100
                    : 0
                }
                tone="amber"
              />
              <FunnelRow
                label="Calls booked"
                value={leadFunnel.booked30}
                width={
                  leadFunnel.total30 > 0
                    ? (leadFunnel.booked30 / leadFunnel.total30) * 100
                    : 0
                }
                tone="amber"
              />
              <FunnelRow
                label="Converted"
                value={leadFunnel.converted30}
                width={
                  leadFunnel.total30 > 0
                    ? (leadFunnel.converted30 / leadFunnel.total30) * 100
                    : 0
                }
                tone="emerald"
              />
            </div>
            <div className="mt-4 rounded-md bg-stone-50/70 px-3 py-2 text-[11px] text-stone-600">
              {leadFunnel.total30 === 0
                ? "No inquiries in the last 30 days. Share your /book link."
                : `${leadFunnel.convRate30}% of inquiries converted in the last 30 days.`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <h3 className="font-serif text-xl">Per-client revenue</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              How much each client has been invoiced + how much remains
              outstanding. Click any name to drill in.
            </p>
            {clientRevList.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                No invoices issued yet. Add a retainer on any client&rsquo;s
                Billing tab.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.15em] text-stone-500">
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-right">Invoiced</th>
                      <th className="px-3 py-2 text-right">Collected</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-right">Last paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {clientRevList.map((c) => {
                      const collectedPct =
                        c.invoiced_total > 0
                          ? Math.round((c.paid_total / c.invoiced_total) * 100)
                          : 0;
                      return (
                        <tr key={c.workspace_id} className="hover:bg-stone-50/50">
                          <td className="px-3 py-2">
                            <Link
                              href={`/admin/clients/${c.workspace_id}`}
                              className="font-medium text-stone-900 hover:underline"
                            >
                              {c.name}
                            </Link>
                            <div className="text-[10px] text-stone-500">
                              {c.invoice_count} invoice
                              {c.invoice_count === 1 ? "" : "s"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            €{Math.round(c.invoiced_total).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">
                            €{Math.round(c.paid_total).toLocaleString()}
                            <div className="text-[10px] text-stone-400">
                              {collectedPct}%
                            </div>
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums ${
                              c.overdue > 0 ? "text-rose-700" : "text-stone-700"
                            }`}
                          >
                            €{Math.round(c.outstanding).toLocaleString()}
                            {c.overdue > 0 && (
                              <div className="text-[10px] text-rose-600">
                                €{Math.round(c.overdue).toLocaleString()} overdue
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-[11px] text-stone-500">
                            {c.last_paid_at
                              ? new Date(c.last_paid_at).toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric" },
                                )
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-5">
            <h3 className="font-serif text-xl">Vendor category mix</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all your client workspaces — what categories are showing up?
            </p>
            {topVendorCats.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                No vendors logged across your clients yet.
              </div>
            ) : (
              <ul className="mt-4 space-y-1.5">
                {topVendorCats.map(([cat, count]) => {
                  const booked = bookedCatCounts.get(cat) ?? 0;
                  const pct = Math.round(
                    (count /
                      Math.max(
                        1,
                        ...topVendorCats.map((c) => c[1]),
                      )) *
                      100,
                  );
                  return (
                    <li key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>
                          {VENDOR_CATEGORY_LABEL[cat] ??
                            cat.replace(/_/g, " ")}
                        </span>
                        <span className="text-stone-500">
                          {count} total
                          {booked > 0 && (
                            <span className="ml-1.5 text-emerald-700">
                              · {booked} booked
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full bg-rose-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <h3 className="font-serif text-xl">Client roster</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {workspaces.length} couple{workspaces.length === 1 ? "" : "s"} in
              your studio.
            </p>
            <ul className="mt-4 space-y-1.5">
              {workspaces.slice(0, 10).map((w) => {
                const dt = w.wedding_date ? new Date(w.wedding_date) : null;
                const daysOff = dt
                  ? Math.round((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                const tone =
                  daysOff == null
                    ? "muted"
                    : daysOff < 0
                      ? "muted"
                      : daysOff <= 60
                        ? "warning"
                        : "success";
                const label =
                  dt == null
                    ? "no date"
                    : daysOff! < 0
                      ? `done ${Math.abs(daysOff!)}d ago`
                      : `${daysOff}d to go`;
                return (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-stone-100 bg-stone-50/40 px-3 py-2 text-sm"
                  >
                    <span className="line-clamp-1 font-medium">{w.name}</span>
                    <Badge
                      variant={tone as "muted" | "warning" | "success"}
                      className="text-[10px]"
                    >
                      {label}
                    </Badge>
                  </li>
                );
              })}
              {workspaces.length > 10 && (
                <li className="pt-1 text-xs text-stone-500">
                  + {workspaces.length - 10} more clients
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  width,
  tone,
}: {
  label: string;
  value: number;
  width: number;
  tone: "rose" | "amber" | "emerald";
}) {
  const cls =
    tone === "rose"
      ? "bg-rose-300"
      : tone === "amber"
        ? "bg-amber-300"
        : "bg-emerald-400";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-stone-700">{label}</span>
        <span className="font-medium tabular-nums text-stone-900">{value}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full ${cls}`} style={{ width: `${Math.max(2, width)}%` }} />
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "amber" | "rose" | "emerald" | "stone";
}) {
  const toneCls =
    tone === "amber"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : tone === "rose"
        ? "bg-rose-50 border-rose-200 text-rose-900"
        : tone === "emerald"
          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
          : "bg-white border-stone-200";
  return (
    <div className={`rounded-2xl border ${toneCls} p-4`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-medium tabular-nums leading-tight md:text-4xl">
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] uppercase tracking-[0.15em] opacity-70">
          {sub}
        </div>
      )}
    </div>
  );
}
