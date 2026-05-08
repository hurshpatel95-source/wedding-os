import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Database } from "@wedding-os/db";
import { BookingForm } from "@/components/public-book/booking-form";
import type { BookingWindowRow, OrgPublicRow } from "@/lib/lead-types";

export const dynamic = "force-dynamic";

function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const sb = publicClient();
  const { data } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: { name: string; public_tagline: string | null } | null }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select("name, public_tagline")
    .eq("public_slug", params.slug)
    .maybeSingle();
  const name = data?.name ?? "Wedding planning";
  return {
    title: `Book a consult · ${name}`,
    description: data?.public_tagline ?? `Get on a call with ${name}.`,
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = publicClient();

  const { data: org } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: OrgPublicRow | null }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select(
      "id, name, public_slug, public_tagline, public_brand_md, public_hero_storage_path, contact_phone, contact_email, booking_buffer_minutes, booking_slot_minutes, public_published_at",
    )
    .eq("public_slug", params.slug)
    .maybeSingle();

  if (!org || !org.public_published_at) notFound();

  const { data: windowsRaw } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: BookingWindowRow[] | null }>;
          };
        };
      };
    }
  )
    .from("booking_windows")
    .select("id, org_id, day_of_week, start_minute, end_minute, timezone, label, created_at")
    .eq("org_id", org.id)
    .order("day_of_week", { ascending: true });

  const windows = (windowsRaw ?? []) as BookingWindowRow[];

  // Calendar busy slots — used to dim/hide conflicting slots in the
  // booking form. Anon-readable per RLS for orgs with public_slug set.
  const nowIso = new Date().toISOString();
  const horizonIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: busyRaw } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            gte: (col: string, val: string) => {
              lte: (col: string, val: string) => Promise<{
                data: { starts_at: string; ends_at: string }[] | null;
              }>;
            };
          };
        };
      };
    }
  )
    .from("calendar_busy_slots")
    .select("starts_at, ends_at")
    .eq("org_id", org.id)
    .gte("ends_at", nowIso)
    .lte("starts_at", horizonIso);

  const busySlots = (busyRaw ?? []) as { starts_at: string; ends_at: string }[];

  let heroUrl: string | null = null;
  if (org.public_hero_storage_path) {
    const { data: pub } = sb.storage
      .from("library-media")
      .getPublicUrl(org.public_hero_storage_path);
    heroUrl = pub?.publicUrl ?? null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30 text-stone-900">
      <section className="relative h-[40vh] min-h-[320px] w-full overflow-hidden">
        {heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60" />
        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center text-white">
          <div className="text-[10px] uppercase tracking-[0.4em] text-white/80">
            {org.name}
          </div>
          <h1 className="mt-4 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Let&rsquo;s plan something extraordinary
          </h1>
          {org.public_tagline && (
            <div className="mt-4 max-w-2xl text-base font-light tracking-wide text-white/90 md:text-lg">
              {org.public_tagline}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            About
          </div>
          <h2 className="mt-2 font-serif text-3xl font-light tracking-tight">
            What working with us looks like
          </h2>
          {org.public_brand_md ? (
            <div className="markdown-body mt-6 space-y-4 text-base leading-relaxed text-stone-800 [&_a]:text-rose-700 [&_a]:underline [&_em]:italic [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-xl [&_li]:my-1 [&_p]:my-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {org.public_brand_md}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="mt-6 text-base leading-relaxed text-stone-700">
              We design destination + intimate weddings end-to-end — venue
              shortlist, vendor curation, design + production. Pick a 30-minute
              intro call and let&rsquo;s see if we&rsquo;re the right fit.
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-3 text-sm">
            {org.contact_phone && (
              <a
                href={`tel:${org.contact_phone}`}
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 font-medium text-stone-800 transition hover:border-rose-500 hover:text-rose-800"
              >
                <span>Call</span>
                <span className="font-mono text-xs text-stone-500">
                  {org.contact_phone}
                </span>
              </a>
            )}
            {org.contact_email && (
              <a
                href={`mailto:${org.contact_email}`}
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 font-medium text-stone-800 transition hover:border-rose-500 hover:text-rose-800"
              >
                Email us
              </a>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <BookingForm
            orgSlug={org.public_slug as string}
            orgName={org.name}
            windows={windows}
            slotMinutes={org.booking_slot_minutes}
            busySlots={busySlots}
          />
        </div>
      </div>

      <footer className="border-t border-stone-200 bg-white/50 py-10 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-stone-500">
          {org.name}
        </div>
        <div className="mt-1 text-[11px] text-stone-400">
          Powered by wedding-os
        </div>
      </footer>
    </div>
  );
}
