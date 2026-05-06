import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import { RsvpForm } from "@/components/rsvp/rsvp-form";
import type { Database } from "@wedding-os/db";

export const dynamic = "force-dynamic";

function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RsvpPage({
  params,
}: {
  params: { token: string };
}) {
  if (!UUID_RE.test(params.token)) notFound();

  const sb = publicClient();

  const { data: guest } = await sb
    .from("guests")
    .select(
      "id, full_name, overall_rsvp, dietary, allergies, notes, workspace_id",
    )
    .eq("rsvp_token", params.token)
    .maybeSingle();

  if (!guest) notFound();

  const { data: workspace } = await sb
    .from("workspaces")
    .select("name, wedding_date, public_slug")
    .eq("id", guest.workspace_id)
    .maybeSingle();

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

        <p className="mt-6 text-center text-xs text-stone-500">
          Need to make a change later? Just reopen this same link.
        </p>
      </div>
    </div>
  );
}
