import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
    .select("*")
    .eq("public_slug", params.slug)
    .maybeSingle();

  if (!workspace) notFound();

  // Don't render unpublished sites publicly. Owners can preview from
  // /settings/public-site → "View live" instead.
  if (!workspace.public_published_at) notFound();

  const schedule = (workspace.schedule as Array<{
    time?: string;
    date?: string;
    label: string;
    location?: string;
  }> | null) ?? [];
  const faq = (workspace.faq as Array<{ q: string; a: string }> | null) ?? [];

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
          {/* SECURITY: rendered through react-markdown — no raw HTML, no
              dangerouslySetInnerHTML. The DB column is named *_html for
              legacy reasons; we treat its contents as Markdown. */}
          <div className="markdown-body mt-4 space-y-4 text-base leading-relaxed text-stone-800 [&_a]:text-rose-700 [&_a]:underline [&_em]:italic [&_p]:my-0 [&_strong]:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripHtml(workspace.story_html)}
            </ReactMarkdown>
          </div>
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

      {/* Schedule */}
      {schedule.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            Schedule
          </div>
          <h2 className="mt-2 font-serif text-3xl font-light tracking-tight md:text-4xl">
            What we&rsquo;re celebrating
          </h2>
          <ol className="mt-8 space-y-4">
            {schedule.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-white/70 p-4"
              >
                <div className="w-32 shrink-0">
                  {s.date && (
                    <div className="font-serif text-base">{s.date}</div>
                  )}
                  {s.time && (
                    <div className="text-xs text-stone-500">{s.time}</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-serif text-lg">{s.label}</div>
                  {s.location && (
                    <div className="text-xs text-stone-500">{s.location}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Travel + Hotel */}
      {(workspace.travel_md || workspace.hotel_block_md) && (
        <section className="mx-auto max-w-3xl px-6 py-20">
          <div className="grid gap-8 md:grid-cols-2">
            {workspace.travel_md && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
                  Travel
                </div>
                <h3 className="mt-2 font-serif text-2xl font-light tracking-tight">
                  Getting there
                </h3>
                <div className="markdown-body mt-3 space-y-3 text-sm text-stone-700 [&_a]:text-rose-700 [&_a]:underline [&_p]:my-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {workspace.travel_md}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {workspace.hotel_block_md && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
                  Where to stay
                </div>
                <h3 className="mt-2 font-serif text-2xl font-light tracking-tight">
                  Hotel block
                </h3>
                <div className="markdown-body mt-3 space-y-3 text-sm text-stone-700 [&_a]:text-rose-700 [&_a]:underline [&_p]:my-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {workspace.hotel_block_md}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Dress code */}
      {workspace.dress_code_md && (
        <section className="mx-auto max-w-2xl px-6 py-12 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            Dress code
          </div>
          <h3 className="mt-2 font-serif text-2xl font-light tracking-tight">
            What to wear
          </h3>
          <div className="markdown-body mt-3 text-sm leading-relaxed text-stone-700 [&_em]:italic [&_p]:my-0 [&_strong]:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {workspace.dress_code_md}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {/* Registry */}
      {workspace.registry_url && (
        <section className="mx-auto max-w-xl px-6 py-12 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            Registry
          </div>
          <h3 className="mt-2 font-serif text-2xl font-light tracking-tight">
            If you&rsquo;d like to give a gift
          </h3>
          <a
            href={workspace.registry_url}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-5 py-2.5 text-sm font-medium text-rose-800 transition hover:border-rose-500 hover:shadow-sm"
          >
            {workspace.registry_label || "View our registry"} &rarr;
          </a>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="mx-auto max-w-2xl px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            FAQ
          </div>
          <h3 className="mt-2 font-serif text-3xl font-light tracking-tight">
            Frequently asked
          </h3>
          <div className="mt-8 space-y-4">
            {faq.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-stone-200 bg-white/70 p-4 open:bg-white"
              >
                <summary className="cursor-pointer list-none font-serif text-base text-stone-900">
                  <span className="mr-2 text-stone-400 group-open:hidden">+</span>
                  <span className="mr-2 hidden text-stone-400 group-open:inline">−</span>
                  {item.q}
                </summary>
                <div className="markdown-body mt-2 text-sm text-stone-700 [&_a]:text-rose-700 [&_a]:underline [&_p]:my-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {item.a}
                  </ReactMarkdown>
                </div>
              </details>
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

/** Strip any raw HTML tags so the seeded `<p>...</p>` story converts cleanly
 * to markdown. Anything inside angle brackets is dropped — keep entities,
 * convert legacy <p> separation to blank lines. */
function stripHtml(input: string): string {
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*p\s*>/gi, "")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}
