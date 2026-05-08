import Link from "next/link";
import { ArrowLeft, Inbox, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { describeConditions } from "@/lib/lead-routing";
import type { LeadRoutingRuleRow } from "@/lib/wave2-types";
import { RuleRowActions } from "@/components/admin-lead-routing/rule-row-actions";

export const dynamic = "force-dynamic";

interface UserLite {
  id: string;
  email: string | null;
  full_name: string | null;
}

export default async function LeadRoutingRulesPage() {
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

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: LeadRoutingRuleRow[] | null }>;
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

  const [{ data: rulesRaw }, { data: teamRaw }] = await Promise.all([
    sb
      .from("lead_routing_rules")
      .select(
        "id, org_id, name, priority, match_conditions, assignee_user_id, enabled, created_by, created_at, updated_at",
      )
      .eq("org_id", profile.org_id)
      .order("priority", { ascending: true }),
    teamSb
      .from("users")
      .select("id, email, full_name")
      .eq("org_id", profile.org_id)
      .eq("org_role", "org_admin"),
  ]);

  const rules = (rulesRaw ?? []) as LeadRoutingRuleRow[];
  const team = (teamRaw ?? []) as UserLite[];
  const teamById = new Map(
    team.map((m) => [
      m.id,
      m.full_name?.trim() || m.email || "Team member",
    ] as const),
  );

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to settings
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Lead routing
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Auto-assign rules
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            New inquiries get routed to a team member based on these rules.
            Lower priority numbers run first; the first match wins.
          </p>
        </div>
        <Link
          href="/admin/settings/lead-routing/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          <Plus className="h-3.5 w-3.5" />
          New rule
        </Link>
      </header>

      {team.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            No org admins found in your team yet — invite at least one
            collaborator before you can assign leads to them.
          </CardContent>
        </Card>
      )}

      {rules.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No routing rules yet"
          description="Astha owns inquiries from /book/. Assistant Sarah picks up couple referrals from public wedding sites. Add a rule to route new leads automatically."
          primary={{
            label: "+ New rule",
            href: "/admin/settings/lead-routing/new",
          }}
        />
      ) : (
        <>
          <div className="text-xs text-stone-500">
            {enabledCount} of {rules.length} {rules.length === 1 ? "rule" : "rules"}{" "}
            enabled — evaluated top-to-bottom on every new lead.
          </div>
          <ul className="space-y-3">
            {rules.map((rule) => {
              const assignee = teamById.get(rule.assignee_user_id);
              return (
                <li key={rule.id}>
                  <Card>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full bg-stone-100 px-2 text-[11px] font-medium tabular-nums text-stone-600">
                              #{rule.priority}
                            </span>
                            <h3 className="truncate font-serif text-xl font-medium text-stone-900">
                              {rule.name}
                            </h3>
                          </div>
                          <p className="mt-2 text-sm text-stone-600">
                            {describeConditions(rule.match_conditions)}{" "}
                            <span className="text-stone-400">→</span>{" "}
                            <span className="font-medium text-stone-800">
                              {assignee ?? "Unknown user"}
                            </span>
                          </p>
                        </div>
                        <RuleRowActions
                          ruleId={rule.id}
                          enabled={rule.enabled}
                          name={rule.name}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
