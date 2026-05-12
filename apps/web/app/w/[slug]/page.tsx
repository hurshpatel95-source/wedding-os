import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Database } from "@wedding-os/db";
import { InquiryForm } from "@/components/public-site/inquiry-form";
import { RsvpForm } from "@/components/public-site/rsvp-form";
import { SITE_THEMES, type SiteThemeSlug } from "@/lib/tier1-types";
import { normalizeSkin } from "@/lib/workspace-skin";

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

// ─── THEME MAP ────────────────────────────────────────────────────────
// Each theme is a bag of Tailwind class strings. The page renders all
// the same sections; only the styling swaps. Keep the shape stable —
// every key must be filled by every theme so we don't ship empty
// classes to the DOM.
interface Theme {
  pageBg: string;
  pageText: string;
  heroOverlay: string;
  heroEyebrowText: string;
  heroDateText: string;
  heroFamily: string; // serif vs sans for the couple name
  heroCtaClass: string;
  eyebrow: string; // section eyebrow label
  sectionHeading: string; // h2 family
  cardClass: string; // venue / schedule / faq cards
  cardTitle: string;
  accentLink: string; // markdown link color
  accentBadge: string; // pill bg/text combo (event_roles, etc.)
  accentButton: string; // registry / call-to-action buttons
  divider: string | null; // optional unicode flourish between sections
  footerBg: string;
  footerEyebrow: string;
  bookCtaClass: string;
}

const THEMES: Record<SiteThemeSlug, Theme> = {
  classic: {
    pageBg: "bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30",
    pageText: "text-stone-900",
    heroOverlay: "bg-gradient-to-b from-black/30 via-black/30 to-black/60",
    heroEyebrowText: "text-white/80",
    heroDateText: "text-white/90",
    heroFamily: "font-serif font-light tracking-tight",
    heroCtaClass:
      "border-white/40 bg-white/10 text-white hover:bg-white/20",
    eyebrow: "text-stone-500",
    sectionHeading: "font-serif font-light tracking-tight",
    cardClass: "rounded-2xl border border-stone-200 bg-white shadow-sm",
    cardTitle: "font-serif font-light tracking-tight",
    accentLink: "[&_a]:text-rose-700 [&_a]:underline",
    accentBadge: "bg-rose-50 text-rose-800",
    accentButton:
      "border border-rose-300 bg-white text-rose-800 hover:border-rose-500 hover:shadow-sm",
    divider: null,
    footerBg: "border-stone-200 bg-white/50",
    footerEyebrow: "text-stone-500",
    bookCtaClass: "bg-stone-900 text-white hover:bg-stone-800",
  },
  modern: {
    pageBg: "bg-white",
    pageText: "text-stone-900",
    heroOverlay: "bg-gradient-to-b from-black/40 via-black/40 to-black/70",
    heroEyebrowText: "text-white/80",
    heroDateText: "text-white/90",
    heroFamily: "font-sans font-bold tracking-tighter uppercase",
    heroCtaClass:
      "border-white bg-transparent text-white hover:bg-white hover:text-black",
    eyebrow: "text-stone-500",
    sectionHeading: "font-sans font-bold tracking-tighter uppercase",
    cardClass: "rounded-none border border-stone-900 bg-white",
    cardTitle: "font-sans font-bold tracking-tight uppercase",
    accentLink: "[&_a]:text-stone-900 [&_a]:underline",
    accentBadge: "bg-stone-900 text-white",
    accentButton:
      "border border-stone-900 bg-white text-stone-900 hover:bg-stone-900 hover:text-white",
    divider: null,
    footerBg: "border-stone-900 bg-white",
    footerEyebrow: "text-stone-700",
    bookCtaClass: "bg-stone-900 text-white hover:bg-black",
  },
  garden: {
    pageBg: "bg-gradient-to-b from-emerald-50/60 via-white to-emerald-50/40",
    pageText: "text-stone-900",
    heroOverlay: "bg-gradient-to-b from-emerald-900/30 via-black/20 to-emerald-900/60",
    heroEyebrowText: "text-emerald-50/90 italic",
    heroDateText: "text-emerald-50/90 italic",
    heroFamily: "font-serif font-light italic tracking-tight",
    heroCtaClass:
      "border-emerald-100/70 bg-emerald-50/10 text-white hover:bg-emerald-50/20",
    eyebrow: "text-emerald-700 italic",
    sectionHeading: "font-serif font-light italic tracking-tight",
    cardClass: "rounded-3xl border border-emerald-100 bg-white/80 shadow-sm",
    cardTitle: "font-serif font-light italic tracking-tight",
    accentLink: "[&_a]:text-emerald-800 [&_a]:underline",
    accentBadge: "bg-emerald-50 text-emerald-800",
    accentButton:
      "border border-emerald-300 bg-white text-emerald-800 hover:border-emerald-600 hover:shadow-sm",
    divider: "✿",
    footerBg: "border-emerald-100 bg-emerald-50/40",
    footerEyebrow: "text-emerald-800",
    bookCtaClass: "bg-emerald-800 text-white hover:bg-emerald-900",
  },
  beach: {
    pageBg: "bg-gradient-to-b from-sky-100/70 via-white to-amber-50/60",
    pageText: "text-slate-800",
    heroOverlay: "bg-gradient-to-b from-sky-700/20 via-sky-900/20 to-amber-900/40",
    heroEyebrowText: "text-amber-50",
    heroDateText: "text-amber-50",
    heroFamily: "font-serif font-light tracking-wide",
    heroCtaClass:
      "border-amber-100/70 bg-white/15 text-white hover:bg-white/30",
    eyebrow: "text-sky-700",
    sectionHeading: "font-serif font-light tracking-wide",
    cardClass: "rounded-3xl border border-sky-100 bg-white/85 shadow-sm",
    cardTitle: "font-serif font-light tracking-wide",
    accentLink: "[&_a]:text-sky-700 [&_a]:underline",
    accentBadge: "bg-sky-50 text-sky-800",
    accentButton:
      "border border-sky-300 bg-white text-sky-800 hover:border-sky-500 hover:shadow-sm",
    divider: "～",
    footerBg: "border-sky-100 bg-sky-50/40",
    footerEyebrow: "text-sky-700",
    bookCtaClass: "bg-sky-700 text-white hover:bg-sky-800",
  },
  bollywood: {
    pageBg: "bg-gradient-to-b from-amber-100 via-white to-pink-100",
    pageText: "text-stone-900",
    heroOverlay:
      "bg-gradient-to-b from-amber-900/40 via-pink-900/40 to-pink-900/70",
    heroEyebrowText: "text-amber-100",
    heroDateText: "text-amber-100",
    heroFamily: "font-serif font-medium tracking-tight",
    heroCtaClass:
      "border-amber-300 bg-amber-500/20 text-white hover:bg-amber-500/40",
    eyebrow: "text-pink-700",
    sectionHeading: "font-serif font-medium tracking-tight",
    cardClass:
      "rounded-2xl border-2 border-amber-400 bg-white/90 shadow-sm",
    cardTitle: "font-serif font-medium tracking-tight",
    accentLink: "[&_a]:text-pink-700 [&_a]:underline",
    accentBadge: "bg-amber-100 text-pink-800",
    accentButton:
      "border-2 border-amber-500 bg-white text-pink-800 hover:bg-amber-50",
    divider: "❀",
    footerBg: "border-amber-300 bg-amber-50/70",
    footerEyebrow: "text-pink-700",
    bookCtaClass: "bg-pink-700 text-white hover:bg-pink-800",
  },
};

const VALID_THEME_SLUGS = new Set<string>(SITE_THEMES.map((t) => t.slug));

function resolveTheme(slug: string | null | undefined): Theme {
  const s = slug && VALID_THEME_SLUGS.has(slug) ? (slug as SiteThemeSlug) : "classic";
  return THEMES[s];
}

// Visual flourish between sections — only renders if the theme defines
// one. Pure decoration; safe to omit for minimalist themes.
function Flourish({ theme }: { theme: Theme }) {
  if (!theme.divider) return null;
  return (
    <div className="mx-auto my-2 flex max-w-md items-center gap-3 px-6 text-stone-400">
      <span className="h-px flex-1 bg-current opacity-40" />
      <span className="text-base">{theme.divider}</span>
      <span className="h-px flex-1 bg-current opacity-40" />
    </div>
  );
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

  const { data: workspaceRaw } = await sb
    .from("workspaces")
    .select("*")
    .eq("public_slug", params.slug)
    .maybeSingle();

  if (!workspaceRaw) notFound();

  // public_theme_slug is post-0025 and `skin` is post-20260508000003;
  // types lag both, so cast to read. wedding_region is also generated-type
  // lagged in the public-page select — cast it in here so the hero subtitle
  // can render the couple's actual region (or fall back to date-only when
  // it isn't set).
  const workspace = workspaceRaw as typeof workspaceRaw & {
    public_theme_slug?: string | null;
    skin?: string | null;
    wedding_region?: string | null;
  };

  const skin = normalizeSkin(workspace.skin);

  // Don't render unpublished sites publicly. Owners can preview from
  // /settings/public-site → "View live" instead.
  if (!workspace.public_published_at) notFound();

  const theme = resolveTheme(workspace.public_theme_slug);

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

  // Distinct event_roles across all venues drives the per-event radio set
  // on the RSVP form. "stay" is just lodging, never an RSVPable event.
  // If the couple hasn't categorized any venue yet, default to ["wedding"].
  const eventRolesSet = new Set<string>();
  for (const v of venues) {
    for (const r of v.event_roles ?? []) {
      if (r && r !== "stay") eventRolesSet.add(r);
    }
  }
  const rsvpEventRoles =
    eventRolesSet.size > 0 ? [...eventRolesSet] : ["wedding"];

  // Fetch the planner org so we can offer "Plan with <planner>" CTA at the
  // bottom — this is the couple-referral lead-gen surface.
  const { data: orgRow } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: {
                name: string;
                public_slug: string | null;
                contact_phone: string | null;
                contact_email: string | null;
                public_published_at: string | null;
              } | null;
            }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select("name, public_slug, contact_phone, contact_email, public_published_at")
    .eq("id", workspace.org_id)
    .maybeSingle();

  const planner = orgRow ?? null;
  // Only offer the booking CTA if the planner has actually published their
  // /book/<slug> page — otherwise the link would 404.
  const bookSlug = planner?.public_published_at && planner?.public_slug
    ? planner.public_slug
    : null;
  // Audit #9 (2026-05-06): fall back to all venues when the couple
  // hasn't marked anything as `is_lead_pick`. Previously the "Where it
  // all happens" section went silent in that case, leaving the public
  // site without a venues block. We don't fetch `status` on the public
  // page (RLS-scoped read), so we fall back to the full venue list here
  // — anything the couple wouldn't want public should be deleted, not
  // hidden by status.
  const leadVenues = venues.filter((v) => v.is_lead_pick);
  const venuesForPublic = leadVenues.length > 0 ? leadVenues : venues;
  const heroPhotoUrl =
    venuesForPublic.find((v) => v.hero_photo_url)?.hero_photo_url ??
    venues.find((v) => v.hero_photo_url)?.hero_photo_url ??
    null;

  const dateLabel = workspace.wedding_date
    ? formatDate(workspace.wedding_date)
    : "September 2027";

  // Pull couple names from workspace.name (e.g. "Nisha & Hursh — Barcelona 2027")
  const coupleHeading = parseCoupleName(workspace.name);

  return (
    <div className={`min-h-screen ${theme.pageBg} ${theme.pageText}`}>
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
        <div className={`absolute inset-0 ${theme.heroOverlay}`} />
        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center text-white">
          <div className={`text-[10px] uppercase tracking-[0.4em] ${theme.heroEyebrowText}`}>
            We&rsquo;re getting married
          </div>
          <h1 className={`mt-4 text-5xl md:text-7xl ${theme.heroFamily}`}>
            {coupleHeading}
          </h1>
          <div className={`mt-6 text-base font-light tracking-wide md:text-xl ${theme.heroDateText}`}>
            {dateLabel}
            {workspace.wedding_region ? (
              <>&nbsp;·&nbsp; {workspace.wedding_region}</>
            ) : null}
          </div>
          <a
            href="#rsvp"
            className={`mt-12 inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-medium tracking-wide backdrop-blur transition ${theme.heroCtaClass}`}
          >
            Find your invite
          </a>
        </div>
      </section>

      <Flourish theme={theme} />

      {/* Story */}
      {workspace.story_html && (
        <section className="mx-auto max-w-2xl px-6 py-20">
          <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
            Our story
          </div>
          {/* SECURITY: rendered through react-markdown — no raw HTML, no
              dangerouslySetInnerHTML. The DB column is named *_html for
              legacy reasons; we treat its contents as Markdown. */}
          <div className={`markdown-body mt-4 space-y-4 text-base leading-relaxed ${theme.accentLink} [&_em]:italic [&_p]:my-0 [&_strong]:font-semibold`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripHtml(workspace.story_html)}
            </ReactMarkdown>
          </div>
        </section>
      )}

      <Flourish theme={theme} />

      {/* Venues */}
      {venuesForPublic.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-20">
          <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
            The plan
          </div>
          <h2 className={`mt-2 text-3xl md:text-4xl ${theme.sectionHeading}`}>
            Where it all happens
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {venuesForPublic.map((v) => (
              <article
                key={v.id}
                className={`overflow-hidden ${theme.cardClass}`}
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
                  <h3 className={`text-2xl ${theme.cardTitle}`}>
                    {v.name}
                  </h3>
                  {v.address && (
                    <p className="text-sm opacity-70">{v.address}</p>
                  )}
                  {(v.event_roles ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {(v.event_roles ?? []).map((r) => (
                        <span
                          key={r}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${theme.accentBadge}`}
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

      <Flourish theme={theme} />

      {/* Schedule */}
      {schedule.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-20">
          <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
            Schedule
          </div>
          <h2 className={`mt-2 text-3xl md:text-4xl ${theme.sectionHeading}`}>
            What we&rsquo;re celebrating
          </h2>
          <ol className="mt-8 space-y-4">
            {schedule.map((s, i) => (
              <li
                key={i}
                className={`flex items-start gap-4 p-4 ${theme.cardClass}`}
              >
                <div className="w-32 shrink-0">
                  {s.date && (
                    <div className={`text-base ${theme.cardTitle}`}>{s.date}</div>
                  )}
                  {s.time && (
                    <div className="text-xs opacity-70">{s.time}</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`text-lg ${theme.cardTitle}`}>{s.label}</div>
                  {s.location && (
                    <div className="text-xs opacity-70">{s.location}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Flourish theme={theme} />

      {/* Travel + Hotel */}
      {(workspace.travel_md || workspace.hotel_block_md) && (
        <section className="mx-auto max-w-3xl px-6 py-20">
          <div className="grid gap-8 md:grid-cols-2">
            {workspace.travel_md && (
              <div>
                <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
                  Travel
                </div>
                <h3 className={`mt-2 text-2xl ${theme.cardTitle}`}>
                  Getting there
                </h3>
                <div className={`markdown-body mt-3 space-y-3 text-sm ${theme.accentLink} [&_p]:my-0`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {workspace.travel_md}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {workspace.hotel_block_md && (
              <div>
                <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
                  Where to stay
                </div>
                <h3 className={`mt-2 text-2xl ${theme.cardTitle}`}>
                  Hotel block
                </h3>
                <div className={`markdown-body mt-3 space-y-3 text-sm ${theme.accentLink} [&_p]:my-0`}>
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
          <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
            Dress code
          </div>
          <h3 className={`mt-2 text-2xl ${theme.cardTitle}`}>
            What to wear
          </h3>
          <div className="markdown-body mt-3 text-sm leading-relaxed [&_em]:italic [&_p]:my-0 [&_strong]:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {workspace.dress_code_md}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {/* Registry */}
      {workspace.registry_url && (
        <section className="mx-auto max-w-xl px-6 py-12 text-center">
          <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
            Registry
          </div>
          <h3 className={`mt-2 text-2xl ${theme.cardTitle}`}>
            If you&rsquo;d like to give a gift
          </h3>
          <a
            href={workspace.registry_url}
            target="_blank"
            rel="noreferrer"
            className={`mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition ${theme.accentButton}`}
          >
            {workspace.registry_label || "View our registry"} &rarr;
          </a>
        </section>
      )}

      <Flourish theme={theme} />

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="mx-auto max-w-2xl px-6 py-20">
          <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
            FAQ
          </div>
          <h3 className={`mt-2 text-3xl ${theme.sectionHeading}`}>
            Frequently asked
          </h3>
          <div className="mt-8 space-y-4">
            {faq.map((item, i) => (
              <details
                key={i}
                className={`group p-4 open:bg-white ${theme.cardClass}`}
              >
                <summary className={`cursor-pointer list-none text-base ${theme.cardTitle}`}>
                  <span className="mr-2 opacity-50 group-open:hidden">+</span>
                  <span className="mr-2 hidden opacity-50 group-open:inline">−</span>
                  {item.q}
                </summary>
                <div className={`markdown-body mt-2 text-sm ${theme.accentLink} [&_p]:my-0`}>
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
        <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
          RSVP
        </div>
        <h2 className={`mt-2 text-3xl md:text-4xl ${theme.sectionHeading}`}>
          Find your invite
        </h2>
        <p className="mt-4 opacity-80">
          Type your name to find yourself on the guest list and share your
          plans, dietary needs, and any plus-one details.
        </p>
        <div className="mt-8">
          <RsvpForm
            workspaceSlug={params.slug}
            eventRoles={rsvpEventRoles}
            cardClassName={theme.cardClass}
            buttonClassName={theme.bookCtaClass}
            badgeClassName={theme.accentBadge}
          />
        </div>
      </section>

      {/* Plan with us — couple-referral CTA */}
      {planner && (
        <section className={`border-t py-16 ${theme.footerBg}`}>
          <div className="mx-auto max-w-3xl px-6">
            <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
              <div>
                <div className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
                  Planning your own?
                </div>
                <h2 className={`mt-2 text-3xl ${theme.sectionHeading}`}>
                  Plan with {planner.name}
                </h2>
                <p className="mt-4 text-sm leading-relaxed opacity-80">
                  This whole experience — venue shortlist, vendor curation,
                  the run-of-show — was orchestrated by the team at{" "}
                  {planner.name}. If you&rsquo;re thinking about something
                  similar, reach out.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm">
                  {planner.contact_phone && (
                    <a
                      href={`tel:${planner.contact_phone}`}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium transition ${theme.accentButton}`}
                    >
                      Call now
                      <span className="font-mono text-xs opacity-70">
                        {planner.contact_phone}
                      </span>
                    </a>
                  )}
                  {bookSlug && (
                    <a
                      href={`/book/${bookSlug}`}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium transition ${theme.bookCtaClass}`}
                    >
                      Book a consult →
                    </a>
                  )}
                  {planner.contact_email && (
                    <a
                      href={`mailto:${planner.contact_email}`}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium transition ${theme.accentButton}`}
                    >
                      Email
                    </a>
                  )}
                </div>
              </div>
              <InquiryForm
                workspaceSlug={params.slug}
                plannerName={planner.name}
                bookSlug={bookSlug}
              />
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className={`border-t py-10 text-center ${theme.footerBg}`}>
        <div className={`text-xs uppercase tracking-[0.3em] ${theme.footerEyebrow}`}>
          {coupleHeading} &middot; {dateLabel}
        </div>
        {(() => {
          // Skin-aware brand attribution at the foot of the public site.
          //   acquired_planner       → "Built with Acquired Planner"
          //   co_branded             → "Built with Acquired Planner · Wedding planning by <planner>"
          //   white_label            → no attribution at all
          //   acquired_style_collab  → "Built with Acquired Planner × Acquired Style"
          let attribution: string | null;
          if (skin === "white_label") {
            attribution = null;
          } else if (skin === "co_branded") {
            const plannerName = planner?.name ?? "your planner";
            attribution = `Built with Acquired Planner · Wedding planning by ${plannerName}`;
          } else if (skin === "acquired_style_collab") {
            attribution = "Built with Acquired Planner × Acquired Style";
          } else {
            attribution = "Built with Acquired Planner";
          }
          if (!attribution) return null;
          return (
            <div className={`mt-3 text-[10px] uppercase tracking-[0.25em] ${theme.footerEyebrow} opacity-70`}>
              {attribution}
            </div>
          );
        })()}
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
