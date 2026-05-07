import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import {
  PROPOSAL_STATUS_LABEL,
  type ProposalRow,
  type ProposalSection,
} from "@/lib/tier1-types";
import { ProposalStatusBadge } from "../page";
import { ProposalActionBar } from "@/components/admin-proposals/proposal-action-bar";

export const dynamic = "force-dynamic";

interface LeadLite {
  id: string;
  couple_names: string | null;
  partner_a_name: string | null;
  partner_b_name: string | null;
  email: string | null;
}

interface WorkspaceLite {
  id: string;
  name: string;
}

export default async function ProposalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: ProposalRow | null }>;
        };
      };
    };
  };

  const { data: proposal } = await sb
    .from("proposals")
    .select(
      "id, org_id, workspace_id, lead_id, title, intro_md, sections, total_eur, status, public_token, valid_until, sent_at, viewed_at, accepted_at, rejected_at, rejection_reason, created_by, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!proposal) notFound();

  const lead: LeadLite | null = proposal.lead_id
    ? await (async () => {
        const { data } = await (
          supabase as unknown as {
            from: (t: string) => {
              select: (cols: string) => {
                eq: (col: string, val: string) => {
                  maybeSingle: () => Promise<{ data: LeadLite | null }>;
                };
              };
            };
          }
        )
          .from("leads")
          .select("id, couple_names, partner_a_name, partner_b_name, email")
          .eq("id", proposal.lead_id as string)
          .maybeSingle();
        return data ?? null;
      })()
    : null;

  const workspace: WorkspaceLite | null = proposal.workspace_id
    ? await (async () => {
        const { data } = await supabase
          .from("workspaces")
          .select("id, name")
          .eq("id", proposal.workspace_id as string)
          .maybeSingle();
        return (data as WorkspaceLite | null) ?? null;
      })()
    : null;

  const sections = (proposal.sections ?? []) as ProposalSection[];

  const recipientName = lead
    ? lead.couple_names ||
      [lead.partner_a_name, lead.partner_b_name].filter(Boolean).join(" & ") ||
      lead.email ||
      "Lead"
    : workspace?.name ?? null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/proposals"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All proposals
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl font-light tracking-tight">
              {proposal.title}
            </h1>
            <ProposalStatusBadge status={proposal.status} />
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-stone-500">
            {recipientName && <span>For {recipientName}</span>}
            {recipientName && (lead || workspace) && <span> · </span>}
            <span>Created {formatDate(proposal.created_at)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Grand total
          </div>
          <div className="mt-1 font-serif text-3xl font-light tabular-nums">
            {formatEur(proposal.total_eur ?? 0)}
          </div>
          {proposal.valid_until && (
            <div className="text-[11px] text-stone-500">
              Valid until {formatDate(proposal.valid_until)}
            </div>
          )}
        </div>
      </header>

      <StatusBanner proposal={proposal} />

      <ProposalActionBar
        proposalId={proposal.id}
        status={proposal.status}
        publicToken={proposal.public_token}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {proposal.intro_md && (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Intro
              </div>
              <div className="markdown-body mt-3 space-y-3 text-sm leading-relaxed text-stone-800 [&_a]:text-rose-700 [&_a]:underline [&_em]:italic [&_p]:my-0 [&_strong]:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {proposal.intro_md}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {sections.map((s, idx) => (
            <section
              key={idx}
              className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Section {idx + 1}
              </div>
              <h2 className="mt-1 font-serif text-2xl font-light tracking-tight">
                {s.title || "Untitled section"}
              </h2>
              {s.body_md && (
                <div className="markdown-body mt-3 space-y-2 text-sm leading-relaxed text-stone-700 [&_a]:text-rose-700 [&_a]:underline [&_em]:italic [&_p]:my-0 [&_strong]:font-semibold">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {s.body_md}
                  </ReactMarkdown>
                </div>
              )}
              {(s.items ?? []).length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-stone-100">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50/60 text-[10px] uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="w-16 px-3 py-2 text-right">Qty</th>
                        <th className="w-28 px-3 py-2 text-right">Unit</th>
                        <th className="w-28 px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(s.items ?? []).map((it, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-stone-800">
                            {it.label}
                            {it.optional && (
                              <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-800">
                                optional
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.qty ?? 1}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatEur(it.unit_price_eur ?? 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatEur(it.total_eur ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          {sections.length === 0 && (
            <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
              No sections yet. Edit the draft to add some.
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Recipient activity
            </div>
            <ul className="mt-3 space-y-2 text-xs text-stone-700">
              <ActivityRow
                label="Sent"
                stamp={proposal.sent_at}
                placeholder="Not sent yet"
              />
              <ActivityRow
                label="First viewed"
                stamp={proposal.viewed_at}
                placeholder="No views"
              />
              <ActivityRow
                label="Accepted"
                stamp={proposal.accepted_at}
                placeholder="—"
              />
              <ActivityRow
                label="Rejected"
                stamp={proposal.rejected_at}
                placeholder="—"
              />
            </ul>
            {proposal.rejection_reason && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-rose-800">
                  Reason
                </div>
                <div className="mt-1 text-xs text-rose-900">
                  {proposal.rejection_reason}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Linked
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <Row k="Lead" v={lead ? recipientName ?? "—" : "—"} />
              <Row k="Workspace" v={workspace?.name ?? "—"} />
              <Row k="Status" v={PROPOSAL_STATUS_LABEL[proposal.status]} />
              <Row
                k="Last updated"
                v={formatDate(proposal.updated_at)}
              />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusBanner({ proposal }: { proposal: ProposalRow }) {
  const status = proposal.status;
  if (status === "draft") {
    return (
      <div className="rounded-2xl border border-stone-300 bg-stone-50 px-5 py-3 text-sm text-stone-700">
        This is still a draft. Send it when you&rsquo;re ready — the couple
        won&rsquo;t be able to access the link until then.
      </div>
    );
  }
  if (status === "sent") {
    const days = proposal.sent_at
      ? Math.max(
          0,
          Math.round(
            (Date.now() - new Date(proposal.sent_at).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">
        Sent{days != null ? ` ${days}d ago` : ""}. Awaiting first view.
      </div>
    );
  }
  if (status === "viewed") {
    return (
      <div className="rounded-2xl border border-sky-300 bg-sky-50 px-5 py-3 text-sm text-sky-900">
        Viewed by recipient. Decision pending.
      </div>
    );
  }
  if (status === "accepted") {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
        Accepted{" "}
        {proposal.accepted_at ? `on ${formatDate(proposal.accepted_at)}` : ""}.
        Time to draft the contract.
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="rounded-2xl border border-rose-300 bg-rose-50 px-5 py-3 text-sm text-rose-900">
        Declined{" "}
        {proposal.rejected_at ? `on ${formatDate(proposal.rejected_at)}` : ""}.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-stone-300 bg-stone-50 px-5 py-3 text-sm text-stone-700">
      Expired — couple can no longer view or act on this proposal.
    </div>
  );
}

function ActivityRow({
  label,
  stamp,
  placeholder,
}: {
  label: string;
  stamp: string | null;
  placeholder: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-900">
        {stamp ? formatRelative(stamp) : placeholder}
      </span>
    </li>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-2 last:border-b-0">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right font-medium text-stone-900">{v}</dd>
    </div>
  );
}

function formatEur(n: number): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `€${n.toFixed(2)}`;
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
