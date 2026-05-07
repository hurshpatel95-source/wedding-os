import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DayOfRunner } from "@/components/timeline/day-of-runner";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

type TimelineItem = Database["public"]["Tables"]["timeline_items"]["Row"];

export default async function TimelineDayOfPage() {
  const supabase = createClient();

  const [{ data: items }, { data: workspace }] = await Promise.all([
    supabase
      .from("timeline_items")
      .select(
        "id, workspace_id, org_id, event_role, occurs_at, duration_minutes, what, who_responsible, location, vendor_id, notes, sort_order, created_by, created_at, updated_at",
      )
      .order("occurs_at", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("workspaces")
      .select("name, wedding_date")
      .limit(1)
      .maybeSingle(),
  ]);

  const sorted = ((items ?? []) as TimelineItem[])
    .slice()
    .sort((a, b) => {
      // items without occurs_at go to the end
      if (!a.occurs_at && !b.occurs_at) return a.sort_order - b.sort_order;
      if (!a.occurs_at) return 1;
      if (!b.occurs_at) return -1;
      const ta = new Date(a.occurs_at).getTime();
      const tb = new Date(b.occurs_at).getTime();
      if (ta !== tb) return ta - tb;
      return a.sort_order - b.sort_order;
    });

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-stone-50 px-4 pb-16 pt-4 sm:-mx-6 sm:px-6 md:-mx-0 md:bg-transparent md:px-0">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-2 pb-2">
          <Link
            href="/timeline"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Run of show
          </Link>
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-rose-700">
            Day-of view
          </span>
        </div>

        <DayOfRunner
          items={sorted}
          workspaceName={workspace?.name ?? null}
          weddingDate={workspace?.wedding_date ?? null}
        />
      </div>
    </div>
  );
}
