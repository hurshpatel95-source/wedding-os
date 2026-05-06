import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhaseDetailEditor } from "@/components/admin-playbook/phase-detail-editor";

export const dynamic = "force-dynamic";

export default async function PhaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: phase }, { data: tasks }] = await Promise.all([
    supabase
      .from("playbook_phases")
      .select("id, org_id, label, sort_order, anchor_kind, anchor_value_int")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("playbook_tasks")
      .select(
        "id, playbook_phase_id, title, description, owner_default, category, sort_order, auto_derive_kind",
      )
      .eq("playbook_phase_id", params.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!phase) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-xs text-stone-400">
        <Link href="/admin/playbook" className="underline">
          ← All phases
        </Link>
      </div>
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Phase · {tasks?.length ?? 0} tasks
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          {phase.label}
        </h1>
      </header>

      <PhaseDetailEditor phase={phase} tasks={tasks ?? []} />
    </div>
  );
}
