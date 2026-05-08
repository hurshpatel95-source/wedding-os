import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PricingIntakeWizard } from "@/components/pricing/pricing-intake-wizard";

export const dynamic = "force-dynamic";

export default async function PricingIntakePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/settings/pricing");

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Drop · extract · review · apply
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          AI Pricing intake
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Drop a screenshot of your planner's WhatsApp screenshot, a PDF of the latest deck, or paste an email
          thread. Claude reads it, matches to your existing line items, and shows proposed
          changes for review. Nothing applies until you confirm.
        </p>
      </header>

      <PricingIntakeWizard venues={venues ?? []} />
    </div>
  );
}
