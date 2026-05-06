import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/components/guests/import-wizard";

export const dynamic = "force-dynamic";

export default async function GuestImportPage() {
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
  if (profile?.role !== "admin") redirect("/guests");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Bulk import · Claude column-mapping
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Drop the guest list
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Drag in the Excel or CSV that Astha sent. Claude reads the columns, normalizes phone
          numbers and addresses, and shows you a preview before anything saves to the database.
        </p>
      </header>

      <ImportWizard />
    </div>
  );
}
