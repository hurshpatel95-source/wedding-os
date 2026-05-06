import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrandingEditor } from "@/components/admin-clients/branding-editor";

export default async function ClientBrandingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !workspace) notFound();

  const { data: branding } = await supabase
    .from("workspace_branding")
    .select("workspace_id, accent_hex, logo_storage_path, planner_display_name, updated_at")
    .eq("workspace_id", params.id)
    .maybeSingle();

  // Pre-sign the existing logo (if any) so the editor can preview it.
  let logoSignedUrl: string | null = null;
  if (branding?.logo_storage_path) {
    const { data: signed } = await supabase.storage
      .from("library-media")
      .createSignedUrl(branding.logo_storage_path, 60 * 60);
    logoSignedUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/clients/${workspace.id}`}
          className="inline-flex items-center gap-1 text-xs text-stone-500 transition hover:text-stone-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to {workspace.name}
        </Link>
      </div>

      <header>
        <div className="mb-3 text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Branding
        </div>
        <h1 className="font-serif text-4xl font-light leading-tight tracking-tight md:text-5xl">
          {workspace.name} — branding
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
          Set the accent color, planner display name, and logo this couple sees
          inside their workspace shell.
        </p>
      </header>

      <BrandingEditor
        workspaceId={workspace.id}
        initial={{
          accent_hex: branding?.accent_hex ?? "#9d174d",
          planner_display_name: branding?.planner_display_name ?? "",
          logo_storage_path: branding?.logo_storage_path ?? null,
        }}
        logoSignedUrl={logoSignedUrl}
      />
    </div>
  );
}
