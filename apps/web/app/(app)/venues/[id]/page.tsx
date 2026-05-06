import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { VenueDetailTabs } from "@/components/venues/venue-detail-tabs";
import { VenueEditButton } from "@/components/venues/venue-edit-button";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/venue-status";

export const dynamic = "force-dynamic";

export default async function VenueDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: venue }, { data: profile }, { data: visits }, { data: photos }, { data: notes }] =
    await Promise.all([
      supabase.from("venues").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
      supabase
        .from("venue_visits")
        .select("*")
        .eq("venue_id", params.id)
        .order("visit_date", { ascending: false }),
      supabase
        .from("venue_photos")
        .select("*")
        .eq("venue_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("venue_notes")
        .select("*, author:users!venue_notes_author_id_fkey(email)")
        .eq("venue_id", params.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  if (!venue) notFound();

  const role = (profile?.role ?? null) as "admin" | "couple" | null;
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl">{venue.name}</h1>
            <Badge variant={STATUS_VARIANT[venue.status]}>{STATUS_LABEL[venue.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{venue.address ?? "No address"}</p>
        </div>
        {isAdmin && <VenueEditButton venue={venue} />}
      </header>

      <VenueDetailTabs
        venue={venue}
        userId={user.id}
        role={role}
        visits={visits ?? []}
        photos={photos ?? []}
        notes={(notes ?? []) as never}
      />
    </div>
  );
}
