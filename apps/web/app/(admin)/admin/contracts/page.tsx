import Link from "next/link";
import { format, parseISO } from "date-fns";
import { FileSignature, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContractStatusBadge } from "@/components/admin-contracts/contract-status-badge";
import {
  CONTRACT_STATUS_LABEL,
  type ContractRow,
  type ContractStatus,
} from "@/lib/tier1-types";

export const dynamic = "force-dynamic";

interface WorkspaceLite {
  id: string;
  name: string;
}

interface LeadLite {
  id: string;
  couple_names: string | null;
  partner_a_name: string | null;
  partner_b_name: string | null;
}

const FILTER_KEYS = [
  "all",
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "voided",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export default async function PlannerContractsPage({
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
        ) => Promise<{ data: ContractRow[] | null }>;
      };
    };
  };

  const [{ data: contractsRaw }, { data: workspacesRaw }, leadsResult] =
    await Promise.all([
      sb
        .from("contracts")
        .select(
          "id, org_id, workspace_id, lead_id, title, body_md, terms_summary, total_eur, retainer_eur, retainer_due_date, status, public_token, signer_name, signer_email, signed_full_name, signed_at, signed_ip, signed_user_agent, declined_at, declined_reason, voided_at, sent_at, viewed_at, pdf_storage_path, created_by, created_at, updated_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("workspaces").select("id, name"),
      (
        supabase as unknown as {
          from: (t: string) => {
            select: (cols: string) => Promise<{
              data: LeadLite[] | null;
            }>;
          };
        }
      )
        .from("leads")
        .select("id, couple_names, partner_a_name, partner_b_name"),
    ]);

  const contracts = (contractsRaw ?? []) as ContractRow[];
  const workspaces = (workspacesRaw ?? []) as WorkspaceLite[];
  const leads = (leadsResult.data ?? []) as LeadLite[];
  const workspaceById = new Map(workspaces.map((w) => [w.id, w.name]));
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const filterStatus = (searchParams.status ?? "all") as FilterKey;
  const filtered =
    filterStatus === "all"
      ? contracts
      : contracts.filter((c) => c.status === filterStatus);

  const counts: Record<FilterKey, number> = {
    all: contracts.length,
    draft: contracts.filter((c) => c.status === "draft").length,
    sent: contracts.filter((c) => c.status === "sent").length,
    viewed: contracts.filter((c) => c.status === "viewed").length,
    signed: contracts.filter((c) => c.status === "signed").length,
    declined: contracts.filter((c) => c.status === "declined").length,
    voided: contracts.filter((c) => c.status === "voided").length,
  };

  const totalSigned = contracts
    .filter((c) => c.status === "signed")
    .reduce((sum, c) => sum + (c.total_eur ?? 0), 0);
  const outstanding = contracts
    .filter((c) => c.status === "sent" || c.status === "viewed")
    .reduce((sum, c) => sum + (c.total_eur ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Contracts
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Click-to-sign agreements
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Send a contract once, the couple reads it on a clean public page,
            types their name, and the deal is locked. We log status, IP, and
            user-agent for every signature.
          </p>
        </div>
        <Link
          href="/admin/contracts/new"
          className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          New contract
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={String(counts.all)} sub="all-time" />
        <StatCard
          label="Out for signature"
          value={String(counts.sent + counts.viewed)}
          tone="amber"
          sub={fmtEuro(outstanding)}
        />
        <StatCard
          label="Signed"
          value={String(counts.signed)}
          tone="emerald"
          sub={fmtEuro(totalSigned)}
        />
        <StatCard
          label="Drafts"
          value={String(counts.draft)}
          sub="not yet sent"
        />
      </section>

      <FilterBar current={filterStatus} counts={counts} />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileSignature className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <h3 className="font-serif text-xl font-light text-stone-800">
              No contracts in this view
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
              Draft your first contract to send a couple a click-to-sign
              agreement.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/admin/contracts/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-stone-800"
              >
                Draft a contract →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Sent</th>
                <th className="px-4 py-3 text-left">Signed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((c) => {
                const clientName = resolveClientName(c, workspaceById, leadById);
                return (
                  <tr key={c.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/contracts/${c.id}`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.terms_summary && (
                        <div className="text-[11px] text-stone-500">
                          {c.terms_summary}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {clientName ?? (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-stone-700">
                      {c.total_eur != null ? fmtEuro(c.total_eur) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ContractStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {c.sent_at ? formatRelative(c.sent_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {c.signed_at ? formatRelative(c.signed_at) : "—"}
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

function resolveClientName(
  c: ContractRow,
  workspaceById: Map<string, string>,
  leadById: Map<string, LeadLite>,
): string | null {
  if (c.workspace_id) {
    const name = workspaceById.get(c.workspace_id);
    if (name) return name;
  }
  if (c.lead_id) {
    const lead = leadById.get(c.lead_id);
    if (lead) {
      return (
        lead.couple_names ||
        [lead.partner_a_name, lead.partner_b_name].filter(Boolean).join(" & ") ||
        "Unnamed lead"
      );
    }
  }
  return c.signer_name ?? null;
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
      <div className="mt-1 font-serif text-3xl font-medium tabular-nums">
        {value}
      </div>
      {sub && (
        <div className="text-[10px] uppercase tracking-wider opacity-60">
          {sub}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  current,
  counts,
}: {
  current: FilterKey;
  counts: Record<FilterKey, number>;
}) {
  const tabs: FilterKey[] = [
    "all",
    "draft",
    "sent",
    "viewed",
    "signed",
    "declined",
    "voided",
  ];
  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = current === t;
        const label = t === "all" ? "All" : CONTRACT_STATUS_LABEL[t as ContractStatus];
        return (
          <Link
            key={t}
            href={t === "all" ? "/admin/contracts" : `/admin/contracts?status=${t}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            }`}
          >
            {label}
            <Badge
              variant="secondary"
              className="ml-1 bg-stone-100 px-1.5 py-0 text-[9px] text-stone-700"
            >
              {counts[t] ?? 0}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRelative(iso: string): string {
  const dt = new Date(iso).getTime();
  const now = Date.now();
  const diff = dt - now;
  const abs = Math.abs(diff);
  if (abs < 60 * 1000) return diff < 0 ? "just now" : "in seconds";
  if (abs < 60 * 60 * 1000) {
    const mins = Math.round(abs / (1000 * 60));
    return diff < 0 ? `${mins}m ago` : `in ${mins}m`;
  }
  if (abs < 24 * 60 * 60 * 1000) {
    const hrs = Math.round(abs / (1000 * 60 * 60));
    return diff < 0 ? `${hrs}h ago` : `in ${hrs}h`;
  }
  if (abs < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.round(abs / (1000 * 60 * 60 * 24));
    return diff < 0 ? `${days}d ago` : `in ${days}d`;
  }
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso.slice(0, 10);
  }
}
