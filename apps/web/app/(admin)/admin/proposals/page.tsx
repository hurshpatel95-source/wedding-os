import Link from "next/link";
import { format, parseISO } from "date-fns";
import { FileText, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PROPOSAL_STATUS_LABEL,
  type ProposalRow,
  type ProposalStatus,
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
  email: string | null;
}

const FILTER_KEYS: ReadonlyArray<ProposalStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
];

export default async function PlannerProposalsPage({
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
        ) => Promise<{ data: ProposalRow[] | null }>;
      };
    };
  };

  const [{ data: proposalsRaw }, { data: workspacesRaw }, { data: leadsRaw }] =
    await Promise.all([
      sb
        .from("proposals")
        .select(
          "id, org_id, workspace_id, lead_id, title, intro_md, sections, total_eur, status, public_token, valid_until, sent_at, viewed_at, accepted_at, rejected_at, rejection_reason, created_by, created_at, updated_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("workspaces").select("id, name"),
      (
        supabase as unknown as {
          from: (t: string) => {
            select: (cols: string) => Promise<{ data: LeadLite[] | null }>;
          };
        }
      )
        .from("leads")
        .select("id, couple_names, partner_a_name, partner_b_name, email"),
    ]);

  const proposals = (proposalsRaw ?? []) as ProposalRow[];
  const workspaces = (workspacesRaw ?? []) as WorkspaceLite[];
  const leads = (leadsRaw ?? []) as LeadLite[];

  const workspaceById = new Map(workspaces.map((w) => [w.id, w.name]));
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const filterStatus = (searchParams.status ?? "all") as
    | ProposalStatus
    | "all";

  const filtered =
    filterStatus === "all"
      ? proposals
      : proposals.filter((p) => p.status === filterStatus);

  const counts: Record<string, number> = {
    all: proposals.length,
    draft: proposals.filter((p) => p.status === "draft").length,
    sent: proposals.filter((p) => p.status === "sent").length,
    viewed: proposals.filter((p) => p.status === "viewed").length,
    accepted: proposals.filter((p) => p.status === "accepted").length,
    rejected: proposals.filter((p) => p.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Sales pipeline
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Proposals
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Branded quotes you send to leads or booked couples. Track delivery,
            opens, and decisions in one place.
          </p>
        </div>
        <Link
          href="/admin/proposals/new"
          className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          New proposal
        </Link>
      </header>

      {proposals.length > 0 && <FilterBar current={filterStatus} counts={counts} />}

      {proposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals yet"
          description="Build a branded proposal couples can review, accept, or decline online."
          primary={{
            label: "Build your first proposal",
            href: "/admin/proposals/new",
          }}
        />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <h3 className="font-serif text-xl font-light text-stone-800">
              No proposals in this view
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
              Switch to another tab, or draft a new proposal for a couple.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/admin/proposals/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-stone-800"
              >
                Draft a proposal →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto rounded-none border-y border-stone-200 bg-white sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border-x">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">For</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Sent</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Valid until</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((p) => {
                const lead = p.lead_id ? leadById.get(p.lead_id) ?? null : null;
                const workspaceName = p.workspace_id
                  ? workspaceById.get(p.workspace_id) ?? null
                  : null;
                const leadName = lead
                  ? lead.couple_names ||
                    [lead.partner_a_name, lead.partner_b_name]
                      .filter(Boolean)
                      .join(" & ") ||
                    lead.email ||
                    "Unnamed lead"
                  : null;
                const target = leadName ?? workspaceName ?? "—";
                return (
                  <tr key={p.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/proposals/${p.id}`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {p.title}
                      </Link>
                      <div className="text-[11px] text-stone-500">
                        Created {formatRelative(p.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      <div className="text-xs">{target}</div>
                      {leadName && workspaceName && (
                        <div className="text-[10px] text-stone-400">
                          via {workspaceName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900 tabular-nums">
                      {formatTotal(p.total_eur)}
                    </td>
                    <td className="px-4 py-3">
                      <ProposalStatusBadge status={p.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-stone-500 md:table-cell">
                      {p.sent_at ? formatRelative(p.sent_at) : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-stone-500 md:table-cell">
                      {p.valid_until ? formatDate(p.valid_until) : "—"}
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

function FilterBar({
  current,
  counts,
}: {
  current: string;
  counts: Record<string, number>;
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      {FILTER_KEYS.map((k) => {
        const active = current === k;
        const label = k === "all" ? "All" : PROPOSAL_STATUS_LABEL[k];
        return (
          <Link
            key={k}
            href={k === "all" ? "/admin/proposals" : `/admin/proposals?status=${k}`}
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
              {counts[k] ?? 0}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const tone =
    status === "draft"
      ? "border-stone-300 bg-stone-100 text-stone-700"
      : status === "sent"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : status === "viewed"
          ? "border-sky-300 bg-sky-50 text-sky-900"
          : status === "accepted"
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : status === "rejected"
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : "border-stone-300 bg-stone-50 text-stone-600";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {PROPOSAL_STATUS_LABEL[status]}
    </span>
  );
}

function formatTotal(t: number | null): string {
  if (t == null) return "—";
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(t);
  } catch {
    return `€${t}`;
  }
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
  if (abs < 60 * 1000) return diff < 0 ? "just now" : "in seconds";
  if (abs < 60 * 60 * 1000) {
    const mins = Math.round(abs / (1000 * 60));
    return diff < 0 ? `${mins}m ago` : `in ${mins}m`;
  }
  if (abs < 24 * 60 * 60 * 1000) {
    const hrs = Math.round(abs / (1000 * 60 * 60));
    return diff < 0 ? `${hrs}h ago` : `in ${hrs}h`;
  }
  const days = Math.round(abs / (1000 * 60 * 60 * 24));
  return diff < 0 ? `${days}d ago` : `in ${days}d`;
}
