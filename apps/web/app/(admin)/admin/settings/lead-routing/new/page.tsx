import { createClient } from "@/lib/supabase/server";
import { RuleEditorForm } from "@/components/admin-lead-routing/rule-editor-form";

export const dynamic = "force-dynamic";

interface UserLite {
  id: string;
  email: string | null;
  full_name: string | null;
}

export default async function NewLeadRoutingRulePage() {
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

  const teamSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{ data: UserLite[] | null }>;
        };
      };
    };
  };

  const { data: teamRaw } = await teamSb
    .from("users")
    .select("id, email, full_name")
    .eq("org_id", profile.org_id)
    .eq("org_role", "org_admin");

  const team = (teamRaw ?? []) as UserLite[];

  return <RuleEditorForm mode="new" team={team} />;
}
