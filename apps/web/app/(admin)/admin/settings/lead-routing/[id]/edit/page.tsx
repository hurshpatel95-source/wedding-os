import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RuleEditorForm } from "@/components/admin-lead-routing/rule-editor-form";
import type { LeadRoutingRuleRow } from "@/lib/wave2-types";

export const dynamic = "force-dynamic";

interface UserLite {
  id: string;
  email: string | null;
  full_name: string | null;
}

export default async function EditLeadRoutingRulePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center text-sm text-stone-600">
        Please sign in.
      </div>
    );
  }

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center text-sm text-stone-600">
        Org admin only.
      </div>
    );
  }

  const ruleSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: LeadRoutingRuleRow | null }>;
          };
        };
      };
    };
  };

  const teamSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{ data: UserLite[] | null }>;
        };
      };
    };
  };

  const ruleRes = await ruleSb
    .from("lead_routing_rules")
    .select(
      "id, org_id, name, priority, match_conditions, assignee_user_id, enabled, created_by, created_at, updated_at",
    )
    .eq("id", params.id)
    .eq("org_id", profile.org_id)
    .maybeSingle();

  const teamRes = await teamSb
    .from("users")
    .select("id, email, full_name")
    .eq("org_id", profile.org_id)
    .eq("org_role", "org_admin");

  const ruleRow = ruleRes.data as LeadRoutingRuleRow | null;
  if (!ruleRow) notFound();

  const team = (teamRes.data ?? []) as UserLite[];

  return (
    <RuleEditorForm
      mode="edit"
      ruleId={ruleRow.id}
      team={team}
      initial={ruleRow}
    />
  );
}
