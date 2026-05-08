import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Mail, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TestimonialStatusBadge } from "@/components/admin-testimonials/status-badge";
import { TestimonialDetailControls } from "@/components/admin-testimonials/detail-controls";
import type { TestimonialRow } from "@/lib/wave2-types";

export const dynamic = "force-dynamic";

export default async function TestimonialDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: TestimonialRow | null }>;
        };
      };
    };
  };
  const { data: testimonial } = await sb
    .from("testimonials")
    .select(
      "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!testimonial) notFound();

  // Resolve photo signed URL for the planner preview.
  let photoSignedUrl: string | null = null;
  let photoPublicUrl: string | null = null;
  if (testimonial.photo_storage_path) {
    const { data: signed } = await supabase.storage
      .from("library-media")
      .createSignedUrl(testimonial.photo_storage_path, 60 * 60);
    photoSignedUrl = signed?.signedUrl ?? null;
    const { data: pub } = supabase.storage
      .from("library-media")
      .getPublicUrl(testimonial.photo_storage_path);
    photoPublicUrl = pub?.publicUrl ?? null;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const publicLink = siteUrl
    ? `${siteUrl}/testimonial/${testimonial.public_token}`
    : `/testimonial/${testimonial.public_token}`;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/testimonials"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All testimonials
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl font-light tracking-tight">
              {testimonial.couple_names ?? "Unnamed couple"}
            </h1>
            <TestimonialStatusBadge status={testimonial.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-500">
            {testimonial.contact_email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {testimonial.contact_email}
              </span>
            )}
            {testimonial.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {testimonial.rating} of 5
              </span>
            )}
          </div>
        </div>
      </header>

      <StatusBanner testimonial={testimonial} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Submitted content
            </div>
            {testimonial.rating != null && (
              <div className="mt-3">
                <StarRow rating={testimonial.rating} />
              </div>
            )}
            {testimonial.quote ? (
              <blockquote className="mt-4 font-serif text-2xl font-light italic leading-snug text-stone-800">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
            ) : (
              <p className="mt-4 text-sm text-stone-400">
                Nothing submitted yet — share the public link with the couple
                so they can fill it in.
              </p>
            )}
            {photoSignedUrl && (
              <div className="mt-6">
                <div className="text-[10px] uppercase tracking-wider text-stone-400">
                  Photo
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoSignedUrl}
                  alt="Couple submitted photo"
                  className="mt-2 h-48 w-48 rounded-2xl object-cover"
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-stone-50/60 p-6 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Booking-page preview
            </div>
            <p className="mt-1 text-xs text-stone-500">
              This is roughly how the testimonial will render on /book/&lt;slug&gt;.
            </p>
            <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6">
              {testimonial.quote ? (
                <>
                  {testimonial.rating != null && (
                    <StarRow rating={testimonial.rating} />
                  )}
                  <p className="mt-3 font-serif text-lg italic leading-relaxed text-stone-800">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    {photoPublicUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPublicUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    )}
                    <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
                      {testimonial.couple_names ?? "Anonymous"}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-stone-400">
                  Awaiting submission — preview will populate once the couple
                  responds.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <TestimonialDetailControls
            testimonialId={testimonial.id}
            status={testimonial.status}
            publicLink={publicLink}
            hasQuote={!!testimonial.quote?.trim()}
          />

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Audit trail
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <Row k="Created" v={formatDateTime(testimonial.created_at)} />
              {testimonial.requested_at && (
                <Row k="Requested" v={formatDateTime(testimonial.requested_at)} />
              )}
              {testimonial.submitted_at && (
                <Row k="Submitted" v={formatDateTime(testimonial.submitted_at)} />
              )}
              {testimonial.published_at && (
                <Row k="Published" v={formatDateTime(testimonial.published_at)} />
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusBanner({ testimonial }: { testimonial: TestimonialRow }) {
  if (testimonial.status === "requested") {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-5 py-3 text-sm text-stone-700">
        Link sent to <strong>{testimonial.contact_email ?? "the couple"}</strong>.
        Use &ldquo;Copy public link&rdquo; on the right if you need to re-share.
      </div>
    );
  }
  if (testimonial.status === "submitted") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
        New submission — review the quote and rating, then publish or decline.
      </div>
    );
  }
  if (testimonial.status === "published") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
        Published — this testimonial is live on your booking page.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-900">
      Declined — this submission won&rsquo;t be displayed publicly.
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-stone-200 text-stone-200"
          }`}
        />
      ))}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-stone-100 py-1 last:border-b-0">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right font-medium text-stone-800">{v}</dd>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return iso;
  }
}
