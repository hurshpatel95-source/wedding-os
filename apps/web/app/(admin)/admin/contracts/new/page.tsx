import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContractDraftForm } from "@/components/admin-contracts/contract-draft-form";

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

const STARTER_TEMPLATE = `## Wedding Planning Services Agreement

This agreement is between **{Studio Name}** ("Planner") and **{Couple Names}** ("Client") for wedding planning services.

### Scope of services

- Venue shortlist + site visits
- Vendor curation, contracts, payments
- Design + production planning
- Day-of execution + timeline management

### Investment

- Total fee: **€{Total}**
- Retainer due to confirm: **€{Retainer}** (50% non-refundable)
- Balance due 30 days before wedding date

### Cancellation

Retainer is non-refundable. Cancellations within 60 days of the wedding forfeit 50% of the remaining balance.

### Signatures

By typing your full name below, you agree to the terms of this agreement.
`;

export default async function NewContractPage() {
  const supabase = createClient();

  const [{ data: workspacesRaw }, leadsResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name")
      .order("created_at", { ascending: false }),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
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
  const leads = (leadsResult.data ?? []) as LeadLite[];

  const leadOptions = leads.map((l) => ({
    id: l.id,
    name:
      l.couple_names ||
      [l.partner_a_name, l.partner_b_name].filter(Boolean).join(" & ") ||
      "Unnamed lead",
    email: l.email,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/admin/contracts"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All contracts
      </Link>

      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          New contract
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight">
          Draft a new agreement
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Fill in the basics, edit the body, and we&rsquo;ll save a draft you
          can review before sending. The starter template below is a safe
          baseline — tune the wording to fit this couple.
        </p>
      </header>

      <ContractDraftForm
        workspaces={workspaces}
        leads={leadOptions}
        starterTemplate={STARTER_TEMPLATE}
      />
    </div>
  );
}
