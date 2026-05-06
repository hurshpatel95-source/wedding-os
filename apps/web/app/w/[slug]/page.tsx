import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

// Use the anon key directly so RLS treats us as the public role —
// our public-read policies kick in only when public_slug is not null.
function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface PublicVenue {
  id: string;
  name: string;
  address: string | null;
  hero_photo_url: string | null;
  capacity_min: number | null;
  capacity_max: number | null;
  is_lead_pick: boolean;
  event_roles: string[] | null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const sb = publicClient();
  const { data } = await sb
    .from("workspaces")
    .select("name")
    .eq("public_slug", params.slug)
    .maybeSingle();
  const name = data?.name ?? "Our wedding";
  return {
    title: name,
    description: "We can't wait to celebrate with you.",
  };
}

export default async function PublicWeddingSite({
  params,
}: {
  params: { slug: string };
}) {
  const sb = publicClient();

  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, name, wedding_date, public_slug, story_html")
    .eq("public_slug", params.slug)
    .maybeSingle();

  if (!workspace) notFound();

  const { data: venuesRaw } = await sb
    .from("venues")
    .select(
      "id, name, address, hero_photo_url, capacity_min, capacity_max, is_lead_pick, event_roles",
    )
    .eq("workspace_id", workspace.id);

  const venues: PublicVenue[] = (venuesRaw as PublicVenue[] | null) ?? [];
  const leadVenues = venues.filter((v) => v.is_lead_pick);
  const heroPhotoUrl =
    leadVenues.find((v) => v.hero_photo_url)?.hero_photo_url ??
    venues.find((v) => v.hero_photo_url)?.hero_photo_url ??
    null;

  const dateLabel = workspace.wedding_date
    ? formatDate(workspace.wedding_date)
    : "September 2027";

  // Pull couple names from workspace.name (e.g. "Nisha & Hursh — Barcelona 2027")
  const coupleHeading = parseCoupleName(workspace.name);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30 text-stone-900">
      {/* Hero */}
      <section className="relative h-[80vh] min-h-[480px] w-full overflow-hidden">
        {heroPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhotoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/30 to-black/60" />
        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center text-white">
          <div className="text-[10px] uppercase tracking-[0.4em] text-white/80">
            We&rsquo;re getting married
          </div>
          <h1 className="mt-4 font-serif text-5xl font-light tracking-tight md:text-7xl">
            {coupleHeading}
          </h1>
          <div className="mt-6 text-base font-light tracking-wide text-white/90 md:text-xl">
            {dateLabel} &nbsp;·&nbsp; Barcelona, Spain
          </div>
          <a
            href="#rsvp"
            className="mt-12 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-medium tracking-wide text-white backdrop-blur transition hover:bg-white/20"
          >
            Find your invite
          </a>
        </div>
      </section>

      {/* Story */}
      {workspace.story_html && (
        <section className="mx-auto max-w-2xl px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            Our story
          </div>
          <div
            className="prose prose-stone mt-4 text-base leading-relaxed text-stone-800"
            dangerouslySetInnerHTML={{ __html: workspace.story_html }}
          />
        </section>
      )}

      {/* Venues */}
      {leadVenues.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            The plan
          </div>
          <h2 className="mt-2 font-serif text-3xl font-light tracking-tight md:text-4xl">
            Where it all happens
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {leadVenues.map((v) => (
              <article
                key={v.id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                {v.hero_photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.hero_photo_url}
                    alt={v.name}
                    className="aspect-[4/3] w-full object-cover"
                  />
                )}
                <div className="space-y-2 p-6">
                  <h3 className="font-serif text-2xl font-light tracking-tight">
                    {v.name}
                  </h3>
                  {v.address && (
                    <p className="text-sm text-stone-600">{v.address}</p>
                  )}
                  {(v.event_roles ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {(v.event_roles ?? []).map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-rose-800"
                        >
                          {r.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* RSVP */}
      <section
        id="rsvp"
        className="mx-auto max-w-xl px-6 py-20 text-center"
      >
        <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
          RSVP
        </div>
        <h2 className="mt-2 font-serif text-3xl font-light tracking-tight md:text-4xl">
          Find your invite
        </h2>
        <p className="mt-4 text-stone-700">
          Each guest received a personal RSVP link by text or email — open it
          to confirm your attendance, share dietary needs, and let us know
          about plus-ones. Lost it? Reply to the message and we&rsquo;ll
          re-send.
        </p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm text-stone-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          We&rsquo;re tracking RSVPs &mdash; check your inbox
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white/50 py-10 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-stone-500">
          {coupleHeading} &middot; {dateLabel}
        </div>
      </footer>
    </div>
  );
}

function formatDate(d: string): string {
  try {
    return format(parseISO(d), "MMMM d, yyyy");
  } catch {
    return d;
  }
}

function parseCoupleName(workspaceName: string): string {
  // "Nisha & Hursh — Barcelona 2027" → "Nisha & Hursh"
  const segments = workspaceName.split("—").map((s) => s.trim());
  return segments[0] || workspaceName;
}
