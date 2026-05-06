import { createClient } from "@/lib/supabase/server";
import { PaymentsCalendar } from "@/components/payments/payments-calendar";
import type { VendorRow } from "@/lib/vendor-types";
import { formatEUR } from "@/lib/utils";

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

export default async function PaymentsPage() {
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

  const [{ data: vendors }, { data: { user } }, { data: plannerInvoicesRaw }] =
    await Promise.all([
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
    ]);

  const plannerInvoices = plannerInvoicesRaw ?? [];

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

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

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Every deposit and final balance · forecasted across the run-up
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Payments
        </h1>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Total committed"
          value={formatEUR(totalCommitted)}
          sub="Booked vendors only"
        />
        <StatCard
          label="Paid to date"
          value={formatEUR(paidToDate)}
          sub="Deposits + finals settled"
          tone="emerald"
        />
        <StatCard
          label="Due next 30 days"
          value={formatEUR(dueIn30)}
          sub="Unpaid + upcoming"
          tone="amber"
        />
        <StatCard
          label="Overdue"
          value={formatEUR(overdue)}
          sub="Past due, unpaid"
          tone="rose"
        />
      </div>

      <PaymentsCalendar milestones={milestones} role={role} />

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
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Due</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Link</th>
              </tr>
            </thead>
            <tbody>
              {plannerInvoices.map((inv) => {
                const overdueInv =
                  !inv.paid_at &&
                  inv.due_at &&
                  new Date(inv.due_at).getTime() < Date.now();
                return (
                  <tr key={inv.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-medium">{inv.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      €{Number(inv.amount_eur).toLocaleString()}
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
                    <td className="px-3 py-2 text-right">
                      {inv.external_url ? (
                        <a
                          href={inv.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-rose-700 hover:underline"
                        >
                          Open ↗
                        </a>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
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
      <div className={`mt-2 font-serif text-3xl font-light tracking-tight ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
