import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SeatingRulesEditor } from "@/components/seating/seating-rules-editor";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface GuestRow {
  id: string;
  full_name: string;
  side: string | null;
  household_id: string | null;
  cant_sit_with_guest_ids: string[] | null;
  must_sit_with_guest_ids: string[] | null;
}

export default async function SeatingRulesPage() {
  const supabase = createClient();

  const { data: guestsRaw } = (await supabase
    .from("guests")
    .select(
      "id, full_name, side, household_id, cant_sit_with_guest_ids, must_sit_with_guest_ids",
    )
    .order("full_name", { ascending: true })) as unknown as {
    data: GuestRow[] | null;
  };
  const guests = guestsRaw ?? [];
  const liteList = guests.map((g) => ({ id: g.id, full_name: g.full_name }));

  return (
    <div className="space-y-6">
      <Link
        href="/guests/seating"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to seating
      </Link>

      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Constraints
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Seating rules
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Mark guests who can&rsquo;t share a table (divorced parents, family
          feuds) or must share one (close friends, old college group). The
          seating board flags violations and the auto-arrange button respects
          these rules.
        </p>
      </header>

      {guests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No guests yet. Import or add some on the{" "}
            <Link href="/guests" className="underline">
              guest list
            </Link>{" "}
            page first.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {guests.map((g) => (
            <SeatingRulesEditor
              key={g.id}
              guestId={g.id}
              guestName={g.full_name}
              allGuests={liteList}
              initialCantSitWith={g.cant_sit_with_guest_ids ?? []}
              initialMustSitWith={g.must_sit_with_guest_ids ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
