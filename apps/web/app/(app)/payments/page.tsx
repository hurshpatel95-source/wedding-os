import { createClient } from "@/lib/supabase/server";
import { PaymentsCalendar } from "@/components/payments/payments-calendar";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import type { VendorRow } from "@/lib/vendor-types";
import { formatCurrency, currencySymbol } from "@/lib/utils";
import { normalizeSkin } from "@/lib/workspace-skin";
import { isB2B, resolveWorkspaceMode } from "@/lib/workspace-mode";

export const dynamic = "force-dynamic";

type VendorPaymentsRow = Pick<
  VendorRow,
  | "id"
  | "name"
  | "category"
  | "status"
  | "contact_name"
  | "deposit_amount_eur"
  | "deposit_due_at"
  | "deposit_paid_at"
  | "final_balance_eur"
  | "final_due_at"
  | "final_paid_at"
  | "include_in_pricing"
>;

export type Milestone = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_category: VendorRow["category"];
  vendor_status: VendorRow["status"];
  contact_name: string | null;
  kind: "deposit" | "final";
  amount_eur: number;
  due_at: string;
  paid_at: string | null;
  is_overdue: boolean;
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { paid?: string };
}) {
  const supabase = createClient();

  // vendors not yet in generated Database types; cast for from() call only.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => Promise<{ data: VendorPaymentsRow[] | null }>;
    };
  };

  const sbInv = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: Array<{
            id: string;
            label: string;
            amount_eur: number;
            due_at: string | null;
            sent_at: string | null;
            paid_at: string | null;
            external_url: string | null;
          }> | null;
        }>;
      };
    };
  };

  const sbLinks = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: Array<{
            id: string;
            planner_invoice_id: string;
            stripe_payment_link_url: string;
            status: "open" | "paid" | "void" | "expired" | "failed";
            receipt_url: string | null;
            created_at: string;
          }> | null;
        }>;
      };
    };
  };

  const [
    { data: vendors },
    {
      data: { user },
    },
    { data: plannerInvoicesRaw },
    { data: paymentLinksRaw },
    { data: workspace },
  ] = await Promise.all([
    sb
      .from("vendors")
      .select(
        "id, name, category, status, contact_name, deposit_amount_eur, deposit_due_at, deposit_paid_at, final_balance_eur, final_due_at, final_paid_at, include_in_pricing",
      ),
    supabase.auth.getUser(),
    sbInv
      .from("planner_invoices")
      .select("id, label, amount_eur, due_at, sent_at, paid_at, external_url")
      .order("due_at", { ascending: true }),
    sbLinks
      .from("payment_links")
      .select(
        "id, planner_invoice_id, stripe_payment_link_url, status, receipt_url, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("workspaces").select("base_currency").limit(1).maybeSingle(),
  ]);

  // Format helper bound to this workspace's base currency. The amount_eur
  // columns are misnamed historically — they're really "amount in workspace
  // base currency" (US couples store USD here, EU couples store EUR).
  const baseCurrency = workspace?.base_currency ?? "USD";
  const fmt = (n: number) => formatCurrency(n, baseCurrency);
  const sym = currencySymbol(baseCurrency);

  const plannerInvoices = plannerInvoicesRaw ?? [];

  // Map invoice id → preferred link (paid > open > anything else).
  const linkByInvoice = new Map<
    string,
    {
      url: string;
      status: "open" | "paid" | "void" | "expired" | "failed";
      receipt_url: string | null;
    }
  >();
  for (const l of paymentLinksRaw ?? []) {
    const existing = linkByInvoice.get(l.planner_invoice_id);
    const next = {
      url: l.stripe_payment_link_url,
      status: l.status,
      receipt_url: l.receipt_url,
    };
    if (!existing) {
      linkByInvoice.set(l.planner_invoice_id, next);
      continue;
    }
    if (existing.status === "paid") continue;
    if (l.status === "paid") {
      linkByInvoice.set(l.planner_invoice_id, next);
      continue;
    }
    if (existing.status === "open") continue;
    if (l.status === "open") {
      linkByInvoice.set(l.planner_invoice_id, next);
    }
  }

  const showPaidBanner = searchParams?.paid === "1";

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

  // Skin → workspace mode → planner-served gate. The skin column isn't in
  // generated types yet, so cast (same pattern used in /(app)/page.tsx).
  let workspaceSkin: string | null = null;
  try {
    const sbSkin = supabase as unknown as {
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
    const { data: skinRow } = await sbSkin
      .from("workspaces")
      .select("skin")
      .limit(1)
      .maybeSingle();
    workspaceSkin = skinRow?.skin ?? null;
  } catch {
    // pre-migration tolerant
  }
  const mode = resolveWorkspaceMode(normalizeSkin(workspaceSkin));
  const isPlannerServed = isB2B(mode);

  const list = vendors ?? [];
  const todayIso = new Date().toISOString().slice(0, 10);

  const milestones: Milestone[] = [];
  for (const v of list) {
    if (v.deposit_amount_eur && v.deposit_amount_eur > 0 && v.deposit_due_at) {
      milestones.push({
        id: `${v.id}:deposit`,
        vendor_id: v.id,
        vendor_name: v.name,
        vendor_category: v.category,
        vendor_status: v.status,
        contact_name: v.contact_name,
        kind: "deposit",
        amount_eur: v.deposit_amount_eur,
        due_at: v.deposit_due_at,
        paid_at: v.deposit_paid_at,
        is_overdue: !v.deposit_paid_at && v.deposit_due_at < todayIso,
      });
    }
    if (v.final_balance_eur && v.final_balance_eur > 0 && v.final_due_at) {
      milestones.push({
        id: `${v.id}:final`,
        vendor_id: v.id,
        vendor_name: v.name,
        vendor_category: v.category,
        vendor_status: v.status,
        contact_name: v.contact_name,
        kind: "final",
        amount_eur: v.final_balance_eur,
        due_at: v.final_due_at,
        paid_at: v.final_paid_at,
        is_overdue: !v.final_paid_at && v.final_due_at < todayIso,
      });
    }
  }

  // Stats — only include "booked" vendors in the committed total
  const bookedVendorIds = new Set(
    list.filter((v) => v.status === "booked" || v.status === "completed").map((v) => v.id),
  );

  let totalCommitted = 0;
  let paidToDate = 0;
  let dueIn30 = 0;
  let overdue = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  for (const m of milestones) {
    if (bookedVendorIds.has(m.vendor_id)) {
      totalCommitted += m.amount_eur;
    }
    if (m.paid_at) {
      paidToDate += m.amount_eur;
      continue;
    }
    const due = new Date(m.due_at);
    due.setHours(0, 0, 0, 0);
    if (m.is_overdue) {
      overdue += m.amount_eur;
    } else if (due >= today && due <= in30) {
      dueIn30 += m.amount_eur;
    }
  }

  // Cold-start empty state — no vendors, no milestones, no planner invoices.
  // Replaces the wall of $0 StatCards + empty calendar with a clear CTA.
  const isEmpty =
    milestones.length === 0 &&
    plannerInvoices.length === 0 &&
    list.length === 0;

  return (
    <div className="space-y-6">
      {showPaidBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Thanks — payment received. Your planner has been notified and your
          invoice will mark as paid in a moment.
        </div>
      )}
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Every deposit and final balance · forecasted across the run-up
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Payments
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          <span className="font-medium text-stone-700">Calendar</span> —
          when each deposit and balance is due. Mark each paid as you wire
          it. For running totals see <a className="underline" href="/spend">/spend</a>.
        </p>
      </header>

      {isEmpty ? (
        <EmptyState
          icon={Wallet}
          title="No payments tracked yet."
          description="Add vendors with deposit amounts to see your payment calendar build out."
          primary={{ label: "Add vendors", href: "/vendors" }}
        />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total committed"
          value={fmt(totalCommitted)}
          sub="From vendors marked as Booked"
        />
        <StatCard
          label="Paid to date"
          value={fmt(paidToDate)}
          sub="Deposits + finals settled"
          tone="emerald"
        />
        <StatCard
          label="Due next 30 days"
          value={fmt(dueIn30)}
          sub="Unpaid + upcoming"
          tone="amber"
        />
        <StatCard
          label="Overdue"
          value={fmt(overdue)}
          sub="Past due, unpaid"
          tone="rose"
        />
      </div>

      <PaymentsCalendar
        milestones={milestones}
        role={role}
        baseCurrency={baseCurrency}
      />

      {!isPlannerServed && (
        <Card>
          <CardContent className="py-5">
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              What&rsquo;s next?
            </div>
            <h2 className="mt-1 font-serif text-xl">Want more on this page?</h2>
            <p className="mt-1 text-sm text-stone-600">
              Add deposits to your vendors on{" "}
              <a className="underline" href="/vendors">
                /vendors
              </a>{" "}
              and they&rsquo;ll show up here.
            </p>
          </CardContent>
        </Card>
      )}

      {plannerInvoices.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Planner invoices
            </div>
            <h2 className="mt-1 font-serif text-2xl">
              What you owe your planner
            </h2>
            <p className="text-xs text-muted-foreground">
              Tracked + marked paid by your planner. See your invoice link
              for payment instructions.
            </p>
          </div>
          <div className="-mx-5 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Due</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {plannerInvoices.map((inv) => {
                const overdueInv =
                  !inv.paid_at &&
                  inv.due_at &&
                  new Date(inv.due_at).getTime() < Date.now();
                const link = linkByInvoice.get(inv.id);
                return (
                  <tr key={inv.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-medium">{inv.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {sym}
                      {Number(inv.amount_eur).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-stone-600">
                      {inv.due_at
                        ? new Date(inv.due_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {inv.paid_at ? (
                        <span className="text-emerald-700">Paid</span>
                      ) : overdueInv ? (
                        <span className="text-rose-700">Overdue</span>
                      ) : inv.sent_at ? (
                        <span className="text-amber-700">Sent</span>
                      ) : (
                        <span className="text-stone-500">Drafted</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {inv.paid_at && link?.status === "paid" && link.receipt_url ? (
                        <a
                          href={link.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline"
                        >
                          Receipt ↗
                        </a>
                      ) : !inv.paid_at && link?.status === "open" ? (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rose-800"
                        >
                          Pay online ↗
                        </a>
                      ) : !inv.paid_at && inv.external_url ? (
                        <a
                          href={inv.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-rose-700 hover:underline"
                        >
                          Open ↗
                        </a>
                      ) : !inv.paid_at ? (
                        <span className="text-stone-400">
                          Pay manually — see invoice notes
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>
      )}
        </>
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
  sub: string;
  tone?: "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-900"
      : tone === "amber"
        ? "text-amber-900"
        : tone === "rose"
          ? "text-rose-900"
          : "text-stone-900";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/60 p-5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{label}</div>
      <div className={`mt-2 font-serif text-2xl font-light tracking-tight md:text-3xl ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
