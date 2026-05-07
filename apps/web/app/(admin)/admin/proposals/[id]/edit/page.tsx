import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProposalBuilder } from "@/components/admin-proposals/proposal-builder";
import type { ProposalRow, ProposalSection } from "@/lib/tier1-types";

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

export default async function EditProposalPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
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
  if (proposal.status !== "draft") {
    redirect(`/admin/proposals/${params.id}`);
  }

  const [{ data: workspacesRaw }, { data: leadsRaw }] = await Promise.all([
    supabase.from("workspaces").select("id, name"),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            order: (
              c: string,
              o: { ascending: boolean },
            ) => Promise<{ data: LeadLite[] | null }>;
          };
        };
      }
    )
      .from("leads")
      .select("id, couple_names, partner_a_name, partner_b_name, email")
      .order("created_at", { ascending: false }),
  ]);

  const workspaces = (workspacesRaw ?? []) as WorkspaceLite[];
  const leads = (leadsRaw ?? []) as LeadLite[];

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/proposals/${proposal.id}`}
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to proposal
      </Link>

      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Editing draft
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          {proposal.title}
        </h1>
      </header>

      <ProposalBuilder
        workspaces={workspaces}
        leads={leads.map((l) => ({
          id: l.id,
          label:
            l.couple_names ||
            [l.partner_a_name, l.partner_b_name].filter(Boolean).join(" & ") ||
            l.email ||
            "Unnamed lead",
        }))}
        initial={{
          id: proposal.id,
          title: proposal.title,
          intro_md: proposal.intro_md,
          lead_id: proposal.lead_id,
          workspace_id: proposal.workspace_id,
          valid_until: proposal.valid_until,
          sections: (proposal.sections ?? []) as ProposalSection[],
        }}
      />
    </div>
  );
}
