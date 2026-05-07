import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Database } from "@wedding-os/db";
import {
  PROPOSAL_STATUS_LABEL,
  type ProposalRow,
  type ProposalSection,
} from "@/lib/tier1-types";
import { ProposalDecisionPanel } from "@/components/proposal/accept-decline-buttons";
import { ProposalViewBeacon } from "@/components/proposal/view-beacon";

export const dynamic = "force-dynamic";

// SECURITY: We use the SERVICE ROLE key here, NOT the anon key. The 122-bit
// public_token in the URL IS the auth — service-role lets this route filter
// by exact-match without anon RLS getting in the way.
function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface OrgLite {
  name: string;
}

interface LeadLite {
  couple_names: string | null;
  partner_a_name: string | null;
  partner_b_name: string | null;
}

interface WorkspaceLite {
  name: string;
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}) {
  if (!isUuid(params.token)) return { title: "Proposal" };
  const sb = adminClient();
  const { data } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { title?: string | null } | null;
            }>;
          };
        };
      };
    }
  )
    .from("proposals")
    .select("title")
    .eq("public_token", params.token)
    .maybeSingle();
  return {
    title: data?.title ? `Proposal · ${data.title}` : "Proposal",
    robots: "noindex, nofollow",
  };
}

export default async function PublicProposalPage({
  params,
}: {
  params: { token: string };
}) {
  if (!isUuid(params.token)) notFound();

  const sb = adminClient();

  const { data: proposal } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: ProposalRow | null }>;
          };
        };
      };
    }
  )
    .from("proposals")
    .select(
      "id, org_id, workspace_id, lead_id, title, intro_md, sections, total_eur, status, public_token, valid_until, sent_at, viewed_at, accepted_at, rejected_at, rejection_reason, created_by, created_at, updated_at",
    )
    .eq("public_token", params.token)
    .maybeSingle();

  if (!proposal) notFound();
  if (proposal.status === "draft") notFound();

  const { data: org } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: OrgLite | null }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select("name")
    .eq("id", proposal.org_id)
    .maybeSingle();

  let recipientName: string | null = null;
  if (proposal.lead_id) {
    const { data: lead } = await (
      sb as unknown as {
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
      .select("couple_names, partner_a_name, partner_b_name")
      .eq("id", proposal.lead_id)
      .maybeSingle();
    if (lead) {
      recipientName =
        lead.couple_names ||
        [lead.partner_a_name, lead.partner_b_name].filter(Boolean).join(" & ") ||
        null;
    }
  }
  if (!recipientName && proposal.workspace_id) {
    const { data: ws } = await (
      sb as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{ data: WorkspaceLite | null }>;
            };
          };
        };
      }
    )
      .from("workspaces")
      .select("name")
      .eq("id", proposal.workspace_id)
      .maybeSingle();
    if (ws) recipientName = parseCoupleName(ws.name);
  }

  const orgName = org?.name ?? "Your planner";

  if (proposal.status === "expired") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30 text-stone-900">
        <main className="mx-auto max-w-2xl px-6 py-32 text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
            {orgName}
          </div>
          <h1 className="mt-4 font-serif text-4xl font-light tracking-tight md:text-5xl">
            This proposal has expired
          </h1>
          <p className="mt-6 text-stone-700">
            Reach out to {orgName} for an updated quote — they&rsquo;ll be
            happy to refresh the numbers and dates for you.
          </p>
        </main>
      </div>
    );
  }

  const sections = (proposal.sections ?? []) as ProposalSection[];
  const showDecision =
    proposal.status === "sent" || proposal.status === "viewed";

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30 text-stone-900">
      {/* Stamp viewed_at on first paint if currently 'sent' */}
      {proposal.status === "sent" && (
        <ProposalViewBeacon token={params.token} />
      )}

      {/* Hero */}
      <section className="border-b border-stone-200/60 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
            {orgName}
          </div>
          {recipientName && (
            <div className="mt-4 font-serif text-3xl font-light tracking-tight md:text-4xl">
              For {recipientName}
            </div>
          )}
          <h1 className="mt-2 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Proposal · {proposal.title}
          </h1>
          {proposal.valid_until && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-1.5 text-[11px] uppercase tracking-wider text-stone-600">
              Valid until {formatDate(proposal.valid_until)}
            </div>
          )}
          {!showDecision && (
            <div className="mt-3 inline-flex rounded-full bg-stone-100 px-3 py-1 text-[10px] uppercase tracking-wider text-stone-700">
              {PROPOSAL_STATUS_LABEL[proposal.status]}
            </div>
          )}
        </div>
      </section>

      {/* Body */}
      <main className="mx-auto max-w-3xl px-6 py-16">
        {proposal.intro_md && (
          <section className="mb-12">
            <div className="markdown-body space-y-4 text-base leading-relaxed text-stone-800 [&_a]:text-rose-700 [&_a]:underline [&_em]:italic [&_p]:my-0 [&_strong]:font-semibold">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {proposal.intro_md}
              </ReactMarkdown>
            </div>
          </section>
        )}

        <div className="space-y-10">
          {sections.map((s, idx) => (
            <section key={idx}>
              <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
                Section {idx + 1}
              </div>
              <h2 className="mt-1 font-serif text-3xl font-light tracking-tight">
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
                <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50/60 text-[10px] uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Item</th>
                        <th className="w-16 px-4 py-3 text-right">Qty</th>
                        <th className="w-28 px-4 py-3 text-right">Unit</th>
                        <th className="w-28 px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(s.items ?? []).map((it, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 text-stone-800">
                            {it.label}
                            {it.optional && (
                              <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-800">
                                optional
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                            {it.qty ?? 1}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                            {formatEur(it.unit_price_eur ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
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
        </div>

        {/* Total */}
        <section className="mt-12 rounded-2xl border border-stone-200 bg-stone-900 px-6 py-6 text-white">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                Grand total
              </div>
              <div className="mt-1 text-[10px] text-white/50">
                Includes optional items — let us know which you&rsquo;d like.
              </div>
            </div>
            <div className="font-serif text-4xl font-light tabular-nums">
              {formatEur(proposal.total_eur ?? 0)}
            </div>
          </div>
        </section>

        {/* Decision */}
        {showDecision && (
          <section className="mt-10">
            <ProposalDecisionPanel
              token={params.token}
              orgName={orgName}
            />
          </section>
        )}

        {proposal.status === "accepted" && (
          <section className="mt-10 rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-800">
              Accepted
            </div>
            <h3 className="mt-2 font-serif text-2xl font-light text-emerald-900">
              You&rsquo;re booked in
            </h3>
            <p className="mt-2 text-sm text-emerald-900">
              Thank you! {orgName} will be in touch with next steps and a
              contract.
            </p>
          </section>
        )}

        {proposal.status === "rejected" && (
          <section className="mt-10 rounded-2xl border border-stone-300 bg-stone-50 p-6 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-stone-700">
              Declined
            </div>
            <h3 className="mt-2 font-serif text-2xl font-light text-stone-900">
              Thanks for letting us know
            </h3>
            <p className="mt-2 text-sm text-stone-700">
              If you change your mind, get in touch with {orgName}.
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-stone-200 bg-white/50 py-10 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-stone-500">
          Prepared by {orgName}
        </div>
      </footer>
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

function formatDate(d: string): string {
  try {
    return format(parseISO(d), "MMMM d, yyyy");
  } catch {
    return d;
  }
}

function parseCoupleName(workspaceName: string): string {
  const segments = workspaceName.split("—").map((s) => s.trim());
  return segments[0] || workspaceName;
}
