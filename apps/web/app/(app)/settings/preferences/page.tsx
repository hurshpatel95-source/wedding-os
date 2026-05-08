// /settings/preferences — couple-facing workspace knobs.
//
// First (and currently only) section: currency. Most B2C couples are in the
// US and want USD; some (Hursh's Barcelona) want EUR. Switching here re-runs
// formatting across budget / payments / estimator / dashboard.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CurrencyToggle } from "@/components/settings/currency-toggle";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.workspace_id) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("base_currency, name")
    .eq("id", profile.workspace_id)
    .maybeSingle();

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
          These apply everywhere — budget, payments, estimator.
        </p>
      </header>

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
  );
}
