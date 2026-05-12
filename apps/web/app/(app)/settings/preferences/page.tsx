// /settings/preferences — couple-facing workspace knobs.
//
// Sections (in order):
//   1. Couple identity      → workspaces.name
//   2. The big day          → workspaces.wedding_date + wedding_region
//   3. Guests + budget      → workspaces.guest_count_estimate + budget_target_eur
//   4. Currency             → workspaces.base_currency
//   5. Account              → read-only email + member-since + re-run onboarding
//
// Layout: 2-column grid on md+ for the editable cards. The Account card is
// full-width below since it's the rare "actions live here" card.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CurrencyToggle } from "@/components/settings/currency-toggle";
import { CoupleIdentityForm } from "@/components/settings/couple-identity-form";
import { BigDayForm } from "@/components/settings/big-day-form";
import { GuestsBudgetForm } from "@/components/settings/guests-budget-form";
import { AccountCard } from "@/components/settings/account-card";

export const dynamic = "force-dynamic";

interface WorkspaceRow {
  base_currency: string | null;
  name: string | null;
  wedding_date: string | null;
  wedding_region: string | null;
  guest_count_estimate: number | null;
  budget_target_eur: number | null;
}

export default async function PreferencesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) redirect("/login");

  // Cast — wedding_region / guest_count_estimate / budget_target_eur aren't
  // in the generated types yet (added in 20260507000002_wave3_autopilot).
  const sbWs = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{ data: WorkspaceRow | null }>;
        };
      };
    };
  };

  const { data: workspace } = await sbWs
    .from("workspaces")
    .select(
      "base_currency, name, wedding_date, wedding_region, guest_count_estimate, budget_target_eur",
    )
    .eq("id", profile.workspace_id)
    .maybeSingle();

  const currency: "USD" | "EUR" =
    (workspace?.base_currency ?? "USD").toUpperCase() === "EUR" ? "EUR" : "USD";

  const memberSince =
    (profile as { created_at?: string | null }).created_at ?? null;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to dashboard
      </Link>

      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Wedding preferences
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Preferences
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Workspace-level settings for {workspace?.name ?? "your wedding"}.
          These apply everywhere — dashboard, plan, budget, payments, public
          site.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <CoupleIdentityForm initialName={workspace?.name ?? null} />

        <BigDayForm
          initialDate={workspace?.wedding_date ?? null}
          initialRegion={workspace?.wedding_region ?? null}
        />

        <GuestsBudgetForm
          initialGuestCount={workspace?.guest_count_estimate ?? null}
          initialBudgetTarget={
            workspace?.budget_target_eur != null
              ? Number(workspace.budget_target_eur)
              : null
          }
          currency={currency}
        />

        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4">
            <h2 className="font-serif text-2xl">Currency</h2>
            <p className="mt-1 text-sm text-stone-600">
              Pick your wedding budget&apos;s primary currency. We default to
              USD for US weddings; switch to EUR if your venue + vendors price
              in euros.
            </p>
          </div>
          <CurrencyToggle initialCurrency={workspace?.base_currency ?? "USD"} />
        </section>
      </div>

      <AccountCard email={user.email ?? "—"} memberSince={memberSince} />
    </div>
  );
}
