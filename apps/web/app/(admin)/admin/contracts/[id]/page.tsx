import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Mail, Reply } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { ContractStatusBadge } from "@/components/admin-contracts/contract-status-badge";
import { ContractDetailControls } from "@/components/admin-contracts/contract-detail-controls";
import type { ContractRow, EmailMessageRow } from "@/lib/tier1-types";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: ContractRow | null }>;
        };
      };
    };
  };

  const { data: contract } = await sb
    .from("contracts")
    .select(
      "id, org_id, workspace_id, lead_id, title, body_md, terms_summary, total_eur, retainer_eur, retainer_due_date, status, public_token, signer_name, signer_email, signed_full_name, signed_at, signed_ip, signed_user_agent, declined_at, declined_reason, voided_at, sent_at, viewed_at, pdf_storage_path, created_by, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!contract) notFound();

  // Resolve client name
  let clientName: string | null = null;
  if (contract.workspace_id) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", contract.workspace_id)
      .maybeSingle();
    clientName = ws?.name ?? null;
  } else if (contract.lead_id) {
    const { data: lead } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: {
                  couple_names: string | null;
                  partner_a_name: string | null;
                  partner_b_name: string | null;
                } | null;
              }>;
            };
          };
        };
      }
    )
      .from("leads")
      .select("couple_names, partner_a_name, partner_b_name")
      .eq("id", contract.lead_id)
      .maybeSingle();
    clientName =
      lead?.couple_names ||
      [lead?.partner_a_name, lead?.partner_b_name].filter(Boolean).join(" & ") ||
      null;
  }

  // Conversation: emails linked to this contract
  const { data: emailsRaw } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: EmailMessageRow[] | null }>;
          };
        };
      };
    }
  )
    .from("email_messages")
    .select(
      "id, org_id, workspace_id, direction, kind, thread_key, in_reply_to_message_id, provider, provider_message_id, to_email, to_name, from_email, from_name, cc, bcc, subject, body_text, body_html, related_lead_id, related_vendor_id, related_guest_id, related_contract_id, status, status_detail, sent_at, delivered_at, opened_at, created_by, created_at, updated_at",
    )
    .eq("related_contract_id", contract.id)
    .order("created_at", { ascending: true });

  const emails = (emailsRaw ?? []) as EmailMessageRow[];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const publicLink = siteUrl
    ? `${siteUrl}/sign/${contract.public_token}`
    : `/sign/${contract.public_token}`;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/contracts"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All contracts
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl font-light tracking-tight">
              {contract.title}
            </h1>
            <ContractStatusBadge status={contract.status} />
          </div>
          {contract.terms_summary && (
            <p className="mt-1 text-sm text-stone-600">
              {contract.terms_summary}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-500">
            {clientName && <span>Client: {clientName}</span>}
            {contract.signer_email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {contract.signer_email}
              </span>
            )}
            {contract.total_eur != null && <span>Total: {fmtEuro(contract.total_eur)}</span>}
            {contract.retainer_eur != null && (
              <span>Retainer: {fmtEuro(contract.retainer_eur)}</span>
            )}
            {contract.retainer_due_date && (
              <span>Retainer due: {fmtDate(contract.retainer_due_date)}</span>
            )}
          </div>
        </div>
      </header>

      <StatusBanner contract={contract} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <div className="markdown-body space-y-3 text-[15px] leading-relaxed text-stone-800 [&_a]:text-rose-700 [&_a]:underline [&_em]:italic [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-light [&_h3]:mt-5 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-medium [&_li]:my-1 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {contract.body_md}
              </ReactMarkdown>
            </div>
          </section>

          {contract.status === "signed" && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-900">
                Signed by client
              </div>
              <div className="mt-2 font-serif text-3xl font-light text-emerald-900">
                {contract.signed_full_name}
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs text-emerald-900 md:grid-cols-2">
                {contract.signed_at && (
                  <Row k="Signed at" v={formatDateTime(contract.signed_at)} />
                )}
                {contract.signed_ip && <Row k="IP" v={contract.signed_ip} />}
                {contract.signed_user_agent && (
                  <Row k="User agent" v={contract.signed_user_agent} />
                )}
              </dl>
            </section>
          )}

          {contract.status === "declined" && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.25em] text-rose-900">
                Declined
              </div>
              <div className="mt-2 text-sm text-rose-900">
                {contract.declined_reason || "No reason provided."}
              </div>
              {contract.declined_at && (
                <div className="mt-1 text-[11px] text-rose-800">
                  {formatDateTime(contract.declined_at)}
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-lg">Conversation</h3>
              <span className="text-[10px] uppercase tracking-wider text-stone-400">
                {emails.length} message{emails.length === 1 ? "" : "s"}
              </span>
            </div>
            {emails.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">
                No emails yet. The send action will log here.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {emails.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/60 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        {m.direction === "inbound" ? (
                          <Reply className="h-3 w-3 text-stone-400" />
                        ) : (
                          <Mail className="h-3 w-3 text-stone-400" />
                        )}
                        <span className="font-medium text-stone-800">
                          {m.subject}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-stone-400">
                        {m.status}
                        {m.sent_at && ` · ${formatDateTime(m.sent_at)}`}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-stone-500">
                      {m.direction === "outbound"
                        ? `To ${m.to_name ?? m.to_email}`
                        : `From ${m.from_name ?? m.from_email}`}
                    </div>
                    {m.body_text && (
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-xs text-stone-700">
                        {m.body_text.slice(0, 800)}
                        {m.body_text.length > 800 ? "…" : ""}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <ContractDetailControls
            contractId={contract.id}
            status={contract.status}
            publicLink={publicLink}
            hasSignerEmail={!!contract.signer_email}
          />

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Audit trail
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <Row k="Created" v={formatDateTime(contract.created_at)} />
              {contract.sent_at && (
                <Row k="Sent" v={formatDateTime(contract.sent_at)} />
              )}
              {contract.viewed_at && (
                <Row k="Viewed" v={formatDateTime(contract.viewed_at)} />
              )}
              {contract.signed_at && (
                <Row k="Signed" v={formatDateTime(contract.signed_at)} />
              )}
              {contract.declined_at && (
                <Row k="Declined" v={formatDateTime(contract.declined_at)} />
              )}
              {contract.voided_at && (
                <Row k="Voided" v={formatDateTime(contract.voided_at)} />
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusBanner({ contract }: { contract: ContractRow }) {
  if (contract.status === "draft") {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-5 py-3 text-sm text-stone-700">
        This contract is a draft — review the body and signer email, then send
        to lock it in.
      </div>
    );
  }
  if (contract.status === "sent") {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-900">
        Sent to <strong>{contract.signer_email}</strong>. Waiting for them to
        open the link.
      </div>
    );
  }
  if (contract.status === "viewed") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
        The client opened the link — they haven&rsquo;t signed yet.
      </div>
    );
  }
  if (contract.status === "signed") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
        Signed by <strong>{contract.signed_full_name}</strong>
        {contract.signed_at ? ` on ${formatDateTime(contract.signed_at)}` : ""}.
      </div>
    );
  }
  if (contract.status === "declined") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-900">
        Declined by the client.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-stone-300 bg-stone-100 px-5 py-3 text-sm text-stone-700">
      This contract has been voided.
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-stone-100 py-1 last:border-b-0">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right font-medium text-stone-800">{v}</dd>
    </div>
  );
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d: string): string {
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return d;
  }
}

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return iso;
  }
}
