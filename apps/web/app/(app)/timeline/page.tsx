import Link from "next/link";
import { Printer, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TimelineEditor } from "@/components/timeline/timeline-editor";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

type TimelineItem = Database["public"]["Tables"]["timeline_items"]["Row"];

export default async function TimelinePage() {
  const supabase = createClient();

  const [{ data: items }, { data: { user } }, { data: workspace }] = await Promise.all([
    supabase
      .from("timeline_items")
      .select(
        "id, workspace_id, org_id, event_role, occurs_at, duration_minutes, what, who_responsible, location, vendor_id, notes, sort_order, created_by, created_at, updated_at",
      )
      .order("event_role", { ascending: true })
      .order("occurs_at", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true }),
    supabase.auth.getUser(),
    supabase
      .from("workspaces")
      .select("id, org_id, name, wedding_date")
      .limit(1)
      .maybeSingle(),
  ]);

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl md:text-5xl">Run of show</h1>
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Day-of timeline · per event · printable for vendors
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/timeline/day-of">
              <Smartphone className="h-4 w-4" />
              Day-of view
            </Link>
          </Button>
          {role === "admin" && (
            <Button asChild variant="outline">
              <Link href="/timeline/print" target="_blank" rel="noopener noreferrer">
                <Printer className="h-4 w-4" />
                Print PDF
              </Link>
            </Button>
          )}
        </div>
      </header>

      <TimelineEditor
        items={(items ?? []) as TimelineItem[]}
        role={role}
        workspaceId={workspace?.id ?? null}
        orgId={workspace?.org_id ?? null}
      />
    </div>
  );
}
