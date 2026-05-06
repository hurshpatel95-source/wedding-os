import { differenceInCalendarDays, parseISO } from "date-fns";
import Link from "next/link";
import { ArrowRight, Camera, MapPin, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/venue-status";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: workspace }, { data: venues }, { count: notesCount }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name, wedding_date, base_currency")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("venues")
      .select(
        "id, name, address, hero_photo_url, status, capacity_min, capacity_max, is_lead_pick",
      )
      .order("is_lead_pick", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase.from("venue_notes").select("id", { count: "exact", head: true }),
  ]);

  const daysUntil = workspace?.wedding_date
    ? differenceInCalendarDays(parseISO(workspace.wedding_date), new Date())
    : null;

  const venueList = venues ?? [];

  // Stats
  const venuesScouted = venueList.filter((v) =>
    ["visited", "quoted", "decided"].includes(v.status as string),
  ).length;

  const decisionsLogged = notesCount ?? 0;

  // Top 3 for shortlist
  const shortlist = venueList.slice(0, 3);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <div className="mb-4 text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Your wedding planning, organized
          </div>
          <h1 className="font-serif text-5xl font-light leading-[1.05] tracking-tight md:text-6xl">
            {venueList.length > 0 ? (
              <>
                {venueList.length} venue{venueList.length === 1 ? "" : "s"}.
                <br />
                <span className="italic text-rose-700">
                  One decision
                </span>{" "}
                away.
              </>
            ) : (
              <>
                A wedding,
                <br />
                <span className="italic text-rose-700">
                  beautifully
                </span>{" "}
                organized.
              </>
            )}
          </h1>
          <p className="mt-6 max-w-xl leading-relaxed text-stone-600">
            All your scouting, photos, notes, and pricing in one place — no more hunting
            through WhatsApp threads or PDFs to remember which courtyard belonged to which
            venue.
            {daysUntil !== null && daysUntil > 0 && (
              <>
                {" "}
                <span className="text-stone-900">
                  {daysUntil} days until {workspace?.wedding_date}.
                </span>
              </>
            )}
          </p>
        </div>

        <aside className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
            Latest activity
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            <ActivityItem
              label="Notes updated"
              sub="Across the venue shortlist · recent"
            />
            <ActivityItem
              label="Photos uploaded"
              sub="Latest visit · this week"
            />
            <ActivityItem
              label="Visit logged"
              sub="Scouting timeline · in progress"
            />
          </ul>
        </aside>
      </section>

      {/* Stats strip */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Venues scouted"
          value={String(venuesScouted)}
          sub={`of ${venueList.length} on the list`}
        />
        <StatCard label="Open questions" value="—" sub="Q&A coming soon" />
        <StatCard label="Estimated total" value="—" sub="Open pricing to set" />
        <StatCard
          label="Decisions logged"
          value={String(decisionsLogged)}
          sub="across all venues"
        />
      </section>

      {/* Shortlist */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.25em] text-stone-500">
              In consideration
            </div>
            <h2 className="font-serif text-3xl font-light tracking-tight">
              Venue shortlist
            </h2>
          </div>
          <Link
            href="/venues"
            className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {shortlist.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <p className="font-serif text-xl text-stone-700">No venues yet</p>
            <p className="mt-2 text-sm text-stone-500">
              Run <code className="rounded bg-stone-100 px-1.5 py-0.5">pnpm db:seed</code>{" "}
              to load the demo workspace, or add one from the Venues page.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shortlist.map((v) => (
              <DashboardVenueCard key={v.id} venue={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{label}</div>
      <div className="mb-1 mt-2 font-serif text-3xl font-light leading-none">{value}</div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  );
}

function ActivityItem({ label, sub }: { label: string; sub: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" />
      <div>
        <div className="text-stone-900">{label}</div>
        <div className="mt-0.5 text-xs text-stone-500">{sub}</div>
      </div>
    </li>
  );
}

function DashboardVenueCard({
  venue,
}: {
  venue: {
    id: string;
    name: string;
    address: string | null;
    hero_photo_url: string | null;
    status: string;
    capacity_min: number | null;
    capacity_max: number | null;
  };
}) {
  return (
    <Link
      href={`/venues/${venue.id}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-100 via-rose-200 to-orange-300">
        {venue.hero_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.hero_photo_url}
            alt={venue.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="absolute right-3 top-3">
          <Badge
            variant={STATUS_VARIANT[venue.status as keyof typeof STATUS_VARIANT]}
            className="border-white/40 bg-white/85 text-[10px] uppercase tracking-wider text-stone-800 shadow-sm backdrop-blur"
          >
            {STATUS_LABEL[venue.status as keyof typeof STATUS_LABEL]}
          </Badge>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-serif text-2xl font-medium leading-tight tracking-tight">
          {venue.name}
        </h3>
        {venue.address && (
          <div className="mt-1 flex items-center gap-1 text-sm text-stone-500">
            <MapPin className="h-3 w-3" /> {venue.address}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {venue.capacity_min ?? "?"}–{venue.capacity_max ?? "?"}
          </span>
          <span className="flex items-center gap-1 text-stone-400">
            <Camera className="h-3.5 w-3.5" />
            <span className="text-xs">photos</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
