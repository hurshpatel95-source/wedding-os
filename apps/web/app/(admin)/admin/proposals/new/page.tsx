import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProposalBuilder } from "@/components/admin-proposals/proposal-builder";

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

export default async function NewProposalPage() {
  const supabase = createClient();

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
        href="/admin/proposals"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All proposals
      </Link>

      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          New draft
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Build a proposal
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Drafts stay private until you hit Send. Items are quoted in EUR. Use
          the optional flag for upgrades the couple can opt into.
        </p>
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
      />
    </div>
  );
}
