import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@wedding-os/db";
import type { TestimonialRow } from "@/lib/wave2-types";
import { TestimonialSubmissionForm } from "@/components/testimonial/submission-form";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SECURITY: We use the SERVICE ROLE key here — the public_token in the URL
// IS the auth. Same pattern as /proposal/[token].
function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface OrgLite {
  name: string;
}

export async function generateMetadata() {
  return {
    title: "Share your testimonial",
    robots: "noindex, nofollow",
  };
}

export default async function PublicTestimonialPage({
  params,
}: {
  params: { token: string };
}) {
  if (!UUID_RE.test(params.token)) notFound();

  const sb = adminClient();
  const lookup = sb as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: TestimonialRow | null }>;
        };
      };
    };
  };
  const { data: testimonial } = await lookup
    .from("testimonials")
    .select(
      "id, org_id, workspace_id, couple_names, contact_email, quote, rating, photo_storage_path, status, public_token, requested_at, submitted_at, published_at, created_by, created_at, updated_at",
    )
    .eq("public_token", params.token)
    .maybeSingle();

  if (!testimonial) notFound();

  const { data: org } = await (
    sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: OrgLite | null }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select("name")
    .eq("id", testimonial.org_id)
    .maybeSingle();

  const orgName = org?.name ?? "Your planner";

  // Terminal states get a "thank you" page; submitted = "we got it, awaiting publish".
  if (testimonial.status === "declined") {
    return (
      <ClosedShell
        orgName={orgName}
        heading="This request has been closed."
        body="If you think this is a mistake, please reach out to your planner directly."
      />
    );
  }
  if (testimonial.status === "published") {
    return (
      <ClosedShell
        orgName={orgName}
        heading="Thank you — your testimonial is live!"
        body="It now appears on your planner's booking page for future couples to read."
      />
    );
  }
  if (testimonial.status === "submitted") {
    return (
      <ClosedShell
        orgName={orgName}
        heading="Thank you — we have your words."
        body="Your planner will review your submission and post it shortly. You don't need to do anything else."
      />
    );
  }

  // status === 'requested' → render submission form
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30 text-stone-900">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <header className="text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
            {orgName}
          </div>
          <h1 className="mt-4 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Share a few words
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-stone-700">
            Your testimonial helps other couples know what to expect. It only
            takes a minute.
          </p>
        </header>

        <section className="mt-10 rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <TestimonialSubmissionForm
            token={testimonial.public_token}
            coupleNames={testimonial.couple_names}
          />
        </section>

        <p className="mt-6 text-center text-[11px] text-stone-500">
          Submitted to {orgName}. They&rsquo;ll review and publish before it
          shows up anywhere public.
        </p>
      </main>
    </div>
  );
}

function ClosedShell({
  orgName,
  heading,
  body,
}: {
  orgName: string;
  heading: string;
  body: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30 text-stone-900">
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
          {orgName}
        </div>
        <h1 className="mt-6 font-serif text-3xl font-light tracking-tight md:text-4xl">
          {heading}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-stone-700">{body}</p>
      </div>
    </div>
  );
}
