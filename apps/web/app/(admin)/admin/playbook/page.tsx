import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaybookEditor } from "@/components/admin-playbook/playbook-editor";

export const dynamic = "force-dynamic";

export default async function AdminPlaybookPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = profile?.org_id ?? null;

  // Phases + their tasks. Two queries — playbook trees are tiny.
  const { data: phases } = await supabase
    .from("playbook_phases")
    .select("id, org_id, label, sort_order, anchor_kind, anchor_value_int")
    .order("sort_order", { ascending: true });

  const phaseIds = (phases ?? []).map((p) => p.id);

  const { data: tasks } = phaseIds.length
    ? await supabase
        .from("playbook_tasks")
        .select(
          "id, playbook_phase_id, title, description, owner_default, category, sort_order, auto_derive_kind",
        )
        .in("playbook_phase_id", phaseIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  // Workspaces in this org for the "Apply playbook to client" picker.
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .order("created_at", { ascending: true });

  const taskCount = tasks?.length ?? 0;
  const phaseCount = phases?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Master template · {phaseCount} phases · {taskCount} tasks
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Playbook
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Master phases + tasks every couple's plan starts from. Edit here once,
          then apply to a couple's workspace to seed their plan. Couples can rename
          phases and add their own tasks afterward — those edits stay on the
          workspace and don't affect this template.
        </p>
      </header>

      {phaseCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Empty playbook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add your first phase to get started. Phases group tasks by when they
              happen relative to the wedding date (e.g. "9–12 months out").
            </p>
            <PlaybookEditor
              orgId={orgId}
              phases={[]}
              tasks={[]}
              workspaces={workspaces ?? []}
            />
          </CardContent>
        </Card>
      ) : (
        <PlaybookEditor
          orgId={orgId}
          phases={phases ?? []}
          tasks={tasks ?? []}
          workspaces={workspaces ?? []}
        />
      )}

      <div className="text-xs text-stone-400">
        <Link href="/admin" className="underline">
          ← Back to admin
        </Link>
      </div>
    </div>
  );
}
