import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/components/guests/import-wizard";

export const dynamic = "force-dynamic";

export default async function GuestImportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // B2C couples need to import their own guest list — the prior admin gate
  // turned the button on /guests into a dead-end loop. Both planners and
  // couples can land here; the upsert API still scopes to workspace_id.

  return (
    <div className="space-y-6">
      <Link
        href="/guests"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to guests
      </Link>
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Bulk import · AI column-mapping
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Drop the guest list
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Drag in the Excel or CSV. AI reads the columns, normalizes phone
          numbers and addresses, and shows you a preview before anything saves to the database.
        </p>
      </header>

      <ImportWizard />
    </div>
  );
}
