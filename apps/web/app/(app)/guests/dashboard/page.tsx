import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RsvpDashboard } from "@/components/guests/rsvp-dashboard";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

type GuestRow = Pick<
  Database["public"]["Tables"]["guests"]["Row"],
  | "id"
  | "full_name"
  | "side"
  | "dietary"
  | "allergies"
  | "overall_rsvp"
  | "household_id"
  | "is_household_head"
  | "created_at"
  | "updated_at"
>;

export default async function GuestsDashboardPage() {
  const supabase = createClient();

  const { data: guests } = await supabase
    .from("guests")
    .select(
      "id, full_name, side, dietary, allergies, overall_rsvp, household_id, is_household_head, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  const list = (guests ?? []) as GuestRow[];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/guests"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Guest list
        </Link>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Your guest list
        </h1>
        <p className="text-sm text-muted-foreground">
          Live RSVP dashboard — refreshes when guests respond.
        </p>
      </header>

      <RsvpDashboard guests={list} />
    </div>
  );
}
