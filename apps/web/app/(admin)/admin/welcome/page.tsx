// /admin/welcome — multi-step onboarding wizard for brand-new planners.
//
// Server component: fetches the org's current state, decides which step to
// land the planner on (either the first unfinished one or whatever ?step=
// they explicitly asked for), and hands the data off to the client wizard.
//
// Notes:
//   - We DO NOT redirect away if the org already looks "set up" — the wizard
//     should still render so a planner can revisit Brand or First-client
//     directly via the URL (e.g. /admin/welcome?step=5).
//   - All five steps live as child components inside the client wizard.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeWizard } from "@/components/welcome/welcome-wizard";
import {
  WELCOME_STEPS,
  deriveStartingStep,
  type WelcomeState,
  type WelcomeStepId,
} from "@/lib/welcome-types";

export const dynamic = "force-dynamic";

interface WelcomePageProps {
  searchParams: { step?: string };
}

export default async function AdminWelcomePage({
  searchParams,
}: WelcomePageProps) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve the planner's profile + org. The (admin) layout already enforces
  // org_admin, but we re-read here so we can pass org_id + org_name into the
  // wizard without a second fetch from the client.
  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id) redirect("/admin");
  const orgId = profile.org_id;

  // Fetch the org row (organizations columns surfaced via the `as unknown as`
  // pattern used elsewhere in the admin shell — public_* columns are part of
  // the planner-OS slab and aren't in the generated Database types yet).
  const { data: orgRow } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: {
                id: string;
                name: string;
                public_slug: string | null;
                public_tagline: string | null;
                public_brand_md: string | null;
                public_published_at: string | null;
                contact_phone: string | null;
                contact_email: string | null;
              } | null;
            }>;
          };
        };
      };
    }
  )
    .from("organizations")
    .select(
      "id, name, public_slug, public_tagline, public_brand_md, public_published_at, contact_phone, contact_email",
    )
    .eq("id", orgId)
    .maybeSingle();

  if (!orgRow) redirect("/admin");

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{
        data: Array<Record<string, unknown>> | null;
      }>;
    };
  };

  // Fan-out the state-of-the-org reads. RLS scopes everything to this org.
  const [{ data: librarySizeRaw }, { data: phasesRaw }, { data: workspacesRaw }] =
    await Promise.all([
      sb.from("library_venues").select("id"),
      sb.from("playbook_phases").select("id"),
      sb.from("workspaces").select("id, name"),
    ]);

  const librarySize = (librarySizeRaw ?? []).length;
  const playbookSeeded = (phasesRaw ?? []).length > 0;
  // The signup flow auto-creates a single placeholder workspace named after
  // the studio (e.g. "Astia Events's studio"); we also tolerate the legacy
  // "Sandbox" literal for orgs created before that rename. Anything else
  // counts as a real first client.
  const placeholderName = `${orgRow.name}'s studio`.trim().toLowerCase();
  const hasFirstClient = (workspacesRaw ?? []).some((w) => {
    const name = (w as { name?: string }).name;
    if (!name) return false;
    const normalized = name.trim().toLowerCase();
    return normalized !== "sandbox" && normalized !== placeholderName;
  });

  const state: WelcomeState = {
    bookingPublished: !!orgRow.public_published_at,
    librarySize,
    playbookSeeded,
    hasFirstClient,
    orgId: orgRow.id,
    orgName: orgRow.name,
    contactEmail: orgRow.contact_email,
    contactPhone: orgRow.contact_phone,
    publicTagline: orgRow.public_tagline,
    publicSlug: orgRow.public_slug,
    publicBrandMd: orgRow.public_brand_md,
  };

  // Resolve initial step. ?step=N takes priority when valid; otherwise we
  // jump to the first unfinished step.
  let initialStep: WelcomeStepId = deriveStartingStep(state);
  const stepParam = searchParams?.step;
  if (stepParam) {
    const n = Number(stepParam);
    if (
      Number.isInteger(n) &&
      WELCOME_STEPS.some((s) => s.id === n)
    ) {
      initialStep = n as WelcomeStepId;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="rounded-3xl bg-gradient-to-br from-rose-50 via-amber-50 to-white p-8 shadow-sm md:p-10">
        <div className="text-[10px] uppercase tracking-[0.3em] text-rose-700">
          Welcome to wedding-os
        </div>
        <h1 className="mt-2 font-serif text-3xl font-light leading-tight tracking-tight md:text-4xl">
          Let&rsquo;s get {state.orgName} ready for your first couple
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-700">
          Five quick steps. You can skip any of them and come back later — or
          breeze through the whole thing in under ten minutes.
        </p>
      </header>

      <div className="mt-6">
        <WelcomeWizard initialStep={initialStep} state={state} />
      </div>
    </div>
  );
}
