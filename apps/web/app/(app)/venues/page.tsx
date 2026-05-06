import { createClient } from "@/lib/supabase/server";
import { VenueGrid } from "@/components/venues/venue-grid";
import { VenueCreateButton } from "@/components/venues/venue-create-button";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const supabase = createClient();

  const [{ data: venues }, { data: { user } }] = await Promise.all([
    supabase
      .from("venues")
      .select(
        "id, name, address, hero_photo_url, status, capacity_min, capacity_max, indoor_outdoor, in_house_catering, has_accommodation, event_roles, created_at",
      )
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  let role: "admin" | "couple" | null = null;
  if (user) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    role = (profile?.role ?? null) as typeof role;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Venues</h1>
          <p className="text-sm text-muted-foreground">
            {(venues ?? []).length} venue{(venues ?? []).length === 1 ? "" : "s"} on the shortlist.
          </p>
        </div>
        {role === "admin" && <VenueCreateButton />}
      </header>

      <VenueGrid venues={venues ?? []} />
    </div>
  );
}
