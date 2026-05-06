import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceTable } from "@/components/admin-billing/invoice-table";
import { NewInvoiceForm } from "@/components/admin-billing/new-invoice-form";

export const dynamic = "force-dynamic";

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

export default async function PlannerBillingPage() {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: InvoiceRow[] | null;
        }>;
      };
    };
  };

  const [{ data: invoicesRaw }, { data: workspaces }] = await Promise.all([
    sb
      .from("planner_invoices")
      .select(
        "id, workspace_id, label, amount_eur, due_at, sent_at, paid_at, paid_via, notes, external_url, created_at",
      )
      .order("due_at", { ascending: true }),
    supabase.from("workspaces").select("id, name").order("name", { ascending: true }),
  ]);

  const invoices = invoicesRaw ?? [];
  const workspaceById = new Map<string, string>();
  for (const w of workspaces ?? []) workspaceById.set(w.id, w.name);

  const totalOutstanding = invoices
    .filter((i) => !i.paid_at)
    .reduce((acc, i) => acc + Number(i.amount_eur), 0);
  const totalPaid = invoices
    .filter((i) => i.paid_at)
    .reduce((acc, i) => acc + Number(i.amount_eur), 0);
  const overdueCount = invoices.filter((i) => {
    if (i.paid_at || !i.due_at) return false;
    return new Date(i.due_at).getTime() < Date.now();
  }).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Studio cash flow
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Billing
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Invoices owed to your studio across every couple. Add, send, mark
            paid. Couples see read-only what they owe inside their own portal.
          </p>
        </div>
        <NewInvoiceForm workspaces={workspaces ?? []} />
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={`€${Math.round(totalOutstanding).toLocaleString()}`}
          tone="amber"
        />
        <StatCard
          label="Overdue"
          value={String(overdueCount)}
          tone={overdueCount > 0 ? "red" : "stone"}
        />
        <StatCard
          label="Collected"
          value={`€${Math.round(totalPaid).toLocaleString()}`}
          tone="emerald"
        />
      </section>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No invoices yet. Open any client at{" "}
            <a className="underline" href="/admin/clients">
              /admin/clients
            </a>{" "}
            and use the Billing tab to add the first one.
          </CardContent>
        </Card>
      ) : (
        <InvoiceTable invoices={invoices} workspaceById={workspaceById} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "red" | "emerald" | "stone";
}) {
  const toneCls =
    tone === "red"
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : tone === "amber"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : "bg-white border-stone-200";
  return (
    <div className={`rounded-2xl border ${toneCls} p-4`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl font-medium tabular-nums">
        {value}
      </div>
    </div>
  );
}
