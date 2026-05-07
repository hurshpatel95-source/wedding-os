import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import { RsvpForm } from "@/components/rsvp/rsvp-form";
import { PlusOneSection } from "@/components/rsvp/plus-one-section";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

// SECURITY: server-side service-role client. The token IS the auth — we
// only return the row that matches it. Anon clients can no longer read
// the guests table directly (locked down in migration 0019).
function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RsvpStatus = "pending" | "yes" | "no" | "maybe";

interface PlusOneRow {
  id: string;
  full_name: string;
  overall_rsvp: RsvpStatus;
  email: string | null;
}

export default async function RsvpPage({
  params,
}: {
  params: { token: string };
}) {
  if (!UUID_RE.test(params.token)) notFound();

  const sb = adminClient();

  const { data: guestRaw } = await sb
    .from("guests")
    .select(
      // is_plus_one / plus_one_of_guest_id / plus_one_max are post-0025
      // columns; types lag, so we cast below.
      "id, full_name, overall_rsvp, dietary, allergies, notes, workspace_id, is_plus_one, plus_one_of_guest_id, plus_one_max",
    )
    .eq("rsvp_token", params.token)
    .maybeSingle();

  if (!guestRaw) notFound();

  const guest = guestRaw as unknown as {
    id: string;
    full_name: string;
    overall_rsvp: RsvpStatus;
    dietary: string | null;
    allergies: string | null;
    notes: string | null;
    workspace_id: string;
    is_plus_one: boolean;
    plus_one_of_guest_id: string | null;
    plus_one_max: number;
  };

  const { data: workspace } = await sb
    .from("workspaces")
    .select("name, wedding_date, public_slug")
    .eq("id", guest.workspace_id)
    .maybeSingle();

  // Pull existing plus-ones for the primary guest. We DON'T pull them for
  // a +1 themselves (their plus_one_max is 0 by construction).
  let plusOnes: PlusOneRow[] = [];
  if (!guest.is_plus_one && guest.plus_one_max > 0) {
    const { data: poRaw } = await (sb as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => Promise<{
            data: PlusOneRow[] | null;
          }>;
        };
      };
    })
      .from("guests")
      .select("id, full_name, overall_rsvp, email")
      .eq("plus_one_of_guest_id", guest.id);
    plusOnes = poRaw ?? [];
  }

  const dateLabel = workspace?.wedding_date
    ? format(parseISO(workspace.wedding_date), "MMMM d, yyyy")
    : "September 2027";

  const coupleName = workspace?.name?.split("—")[0]?.trim() ?? "Our wedding";

  const firstName = guest.full_name.split(" ")[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : "Welcome,";

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30">
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
            {coupleName}
          </div>
          <div className="mt-2 text-sm text-stone-600">{dateLabel}</div>
          <h1 className="mt-10 font-serif text-4xl font-light tracking-tight md:text-5xl">
            {greeting}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-stone-700">
            We can&rsquo;t wait to celebrate with you. Tell us if you&rsquo;ll
            be there.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-stone-200 bg-white/90 p-8 shadow-sm">
          <RsvpForm
            token={params.token}
            initial={{
              overall_rsvp: guest.overall_rsvp,
              dietary: guest.dietary ?? "",
              allergies: guest.allergies ?? "",
              notes: guest.notes ?? "",
            }}
            publicSlug={workspace?.public_slug ?? null}
          />
        </div>

        {!guest.is_plus_one && guest.plus_one_max > 0 && (
          <PlusOneSection
            token={params.token}
            initial={plusOnes}
            max={guest.plus_one_max}
          />
        )}

        <p className="mt-6 text-center text-xs text-stone-500">
          Need to make a change later? Just reopen this same link.
        </p>
      </div>
    </div>
  );
}
