import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type { ContractRow } from "@/lib/tier1-types";
import { SignForm } from "@/components/sign/sign-form";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Use the anon key — RLS policy `contracts_anon_token_read` opens the row
// to the anon role; the API layer enforces the actual token match. This
// matches the /w/[slug] pattern.
function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}) {
  if (!UUID_RE.test(params.token)) return { title: "Contract" };
  const sb = publicClient();
  const { data } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { title: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("contracts")
    .select("title")
    .eq("public_token", params.token)
    .maybeSingle();
  return {
    title: data?.title ?? "Contract",
    robots: "noindex, nofollow",
  };
}

export default async function SignContractPage({
  params,
}: {
  params: { token: string };
}) {
  if (!UUID_RE.test(params.token)) notFound();

  const sb = publicClient();
  const lookup = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: ContractRow | null }>;
        };
      };
    };
  };
  const { data: contract } = await lookup
    .from("contracts")
    .select(
      "id, org_id, workspace_id, lead_id, title, body_md, terms_summary, total_eur, retainer_eur, retainer_due_date, status, public_token, signer_name, signer_email, signed_full_name, signed_at, signed_ip, signed_user_agent, declined_at, declined_reason, voided_at, sent_at, viewed_at, pdf_storage_path, created_by, created_at, updated_at",
    )
    .eq("public_token", params.token)
    .maybeSingle();

  if (!contract) notFound();

  // Terminal states get a clean "this contract is closed" page.
  if (contract.status === "voided") {
    return (
      <ClosedShell
        title={contract.title}
        heading="This contract has been voided."
        body="If you think this was a mistake, reach out to the planner who shared this link."
      />
    );
  }
  if (contract.status === "signed") {
    return (
      <ClosedShell
        title={contract.title}
        heading={`Signed on ${formatDateTime(contract.signed_at ?? contract.updated_at)}`}
        body={
          contract.signed_full_name
            ? `Thank you, ${contract.signed_full_name}. A copy of this agreement is on file with the planner.`
            : "Thank you. A copy of this agreement is on file with the planner."
        }
      />
    );
  }
  if (contract.status === "declined") {
    return (
      <ClosedShell
        title={contract.title}
        heading="This contract has been declined."
        body="If you'd like to revisit the terms, reach out to the planner who shared this link."
      />
    );
  }
  if (contract.status === "draft") {
    return (
      <ClosedShell
        title={contract.title}
        heading="This contract isn't ready yet."
        body="The planner is still preparing it. Please wait for a fresh link."
      />
    );
  }

  // Status is 'sent' or 'viewed' — render the live signing surface.
  return (
    <div className="min-h-screen bg-[#fbf7ed] text-stone-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
            Contract for review
          </div>
          <h1 className="mt-3 font-serif text-4xl font-light tracking-tight md:text-5xl">
            {contract.title}
          </h1>
          {contract.terms_summary && (
            <p className="mx-auto mt-3 max-w-md text-sm text-stone-600">
              {contract.terms_summary}
            </p>
          )}
        </header>

        {(contract.total_eur != null ||
          contract.retainer_eur != null ||
          contract.retainer_due_date) && (
          <section className="mt-10 rounded-2xl border border-stone-200 bg-white/80 p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
              {contract.total_eur != null && (
                <Money label="Total fee" value={contract.total_eur} />
              )}
              {contract.retainer_eur != null && (
                <Money label="Retainer" value={contract.retainer_eur} />
              )}
              {contract.retainer_due_date && (
                <KV
                  label="Retainer due"
                  value={formatDate(contract.retainer_due_date)}
                />
              )}
            </div>
          </section>
        )}

        <article className="mt-8 rounded-3xl border border-stone-200 bg-white p-10 shadow-sm">
          <div className="markdown-body space-y-3 text-[15px] leading-relaxed text-stone-800 [&_a]:text-rose-700 [&_a]:underline [&_em]:italic [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-light [&_h3]:mt-5 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-medium [&_li]:my-1 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {contract.body_md}
            </ReactMarkdown>
          </div>
        </article>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <SignForm
            token={contract.public_token}
            currentStatus={contract.status}
            signerHint={contract.signer_name}
          />
        </section>

        <p className="mt-6 text-center text-[11px] text-stone-500">
          By typing your full name above, you agree to the terms set out in
          this document. We log the time, IP, and browser as a record.
        </p>
      </div>
    </div>
  );
}

function ClosedShell({
  title,
  heading,
  body,
}: {
  title: string;
  heading: string;
  body: string;
}) {
  return (
    <div className="min-h-screen bg-[#fbf7ed] text-stone-900">
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
          {title}
        </div>
        <h1 className="mt-6 font-serif text-3xl font-light tracking-tight md:text-4xl">
          {heading}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-stone-700">{body}</p>
      </div>
    </div>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-light tabular-nums text-stone-900">
        {new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(value)}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </div>
      <div className="mt-1 font-serif text-xl font-light text-stone-900">
        {value}
      </div>
    </div>
  );
}

function formatDate(d: string): string {
  try {
    return format(parseISO(d), "MMMM d, yyyy");
  } catch {
    return d;
  }
}

function formatDateTime(d: string): string {
  try {
    return format(parseISO(d), "MMMM d, yyyy · h:mm a");
  } catch {
    return d;
  }
}
