import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { InviteTeammateForm } from "@/components/admin-team/invite-teammate-form";
import { TeamMemberRow } from "@/components/admin-team/team-member-row";
import { TEAM_ROLE_LABEL, type TeamRole } from "@/lib/wave2-types";

export const dynamic = "force-dynamic";

interface TeamMember {
  id: string;
  email: string;
  org_role: string | null;
  team_role: TeamRole | null;
  created_at: string;
}

export default async function AdminTeamSettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Caller's profile — used to gate the "remove" / "change role" controls
  // to the owner. Layout already enforces org_admin so this is informational.
  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              org_id?: string | null;
              team_role?: string | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: callerProfile } = user
    ? await profileSb
        .from("users")
        .select("org_id, team_role")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const viewerIsOwner = callerProfile?.team_role === "owner";

  // All team members in this org. RLS scopes by workspace; for the planner
  // team list we want everyone in the org with org_role='org_admin', which
  // requires reading across workspaces. Fall back to a manual order-by.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: TeamMember[] | null }>;
        };
      };
    };
  };
  const { data: membersRaw } = await sb
    .from("users")
    .select("id, email, org_role, team_role, created_at")
    .eq("org_role", "org_admin")
    .order("created_at", { ascending: true });

  const members = (membersRaw ?? []) as TeamMember[];
  const ownerCount = members.filter((m) => m.team_role === "owner").length;

  // Sort: owners first, then by joined date.
  members.sort((a, b) => {
    const aOwner = a.team_role === "owner" ? 0 : 1;
    const bOwner = b.team_role === "owner" ? 0 : 1;
    if (aOwner !== bOwner) return aOwner - bOwner;
    return (
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to settings
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Studio settings
          </div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Team
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Invite collaborators to your studio. Each teammate gets full
            planner access — they can manage clients, leads, and the playbook.
            Lead routing and per-role permissions are coming next.
          </p>
        </div>
        {viewerIsOwner && <InviteTeammateForm />}
      </header>

      {!viewerIsOwner && (
        <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">
          Only the studio owner can invite or remove team members.
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <Users className="h-7 w-7 text-stone-300" />
              <div className="font-serif text-lg text-stone-700">
                No teammates yet
              </div>
              <p className="max-w-sm text-xs text-stone-500">
                Invite a planner or assistant to share the load.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.2em] text-stone-500">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Team role</th>
                    <th className="px-4 py-3 text-left">Joined</th>
                    <th className="px-4 py-3 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {members.map((m) => (
                    <TeamMemberRow
                      key={m.id}
                      userId={m.id}
                      email={m.email}
                      teamRole={m.team_role}
                      joinedAt={m.created_at}
                      isSelf={m.id === user?.id}
                      isOnlyOwner={ownerCount <= 1}
                      viewerIsOwner={viewerIsOwner}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Role legend
        </div>
        <ul className="mt-2 space-y-1.5">
          <li>
            <span className="font-medium text-stone-800">
              {TEAM_ROLE_LABEL.owner}
            </span>{" "}
            — studio founder. Can invite, remove, and change team roles.
          </li>
          <li>
            <span className="font-medium text-stone-800">
              {TEAM_ROLE_LABEL.planner}
            </span>{" "}
            — full access to clients, leads, and the playbook. Can&rsquo;t
            invite teammates.
          </li>
          <li>
            <span className="font-medium text-stone-800">
              {TEAM_ROLE_LABEL.assistant}
            </span>{" "}
            — same access as planner today. Permission tightening planned.
          </li>
        </ul>
      </div>
    </div>
  );
}
