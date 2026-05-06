import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

const DEFAULT_ACCENT = "#9d174d";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: workspace }] = await Promise.all([
    supabase.from("users").select("role, workspace_id").eq("id", user.id).maybeSingle(),
    supabase
      .from("workspaces")
      .select("id, name, wedding_date")
      .limit(1)
      .maybeSingle(),
  ]);

  const role = (profile?.role ?? null) as "admin" | "couple" | null;

  // Pull this workspace's branding row (per-couple accent + planner display
  // name + logo). Couple workspace_branding is readable to workspace members
  // via RLS. Read defensively — pre-migration or no-row should fall back to
  // hardcoded defaults.
  let brandingAccent: string = DEFAULT_ACCENT;
  let plannerDisplayName: string | null = null;
  let plannerLogoUrl: string | null = null;
  if (workspace?.id) {
    try {
      const sb = supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              maybeSingle: () => Promise<{
                data: {
                  accent_hex?: string | null;
                  planner_display_name?: string | null;
                  logo_storage_path?: string | null;
                } | null;
              }>;
            };
          };
        };
      };
      const { data: branding } = await sb
        .from("workspace_branding")
        .select("accent_hex, planner_display_name, logo_storage_path")
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      if (branding?.accent_hex) brandingAccent = branding.accent_hex;
      plannerDisplayName = branding?.planner_display_name ?? null;
      if (branding?.logo_storage_path) {
        const { data: signed } = await supabase.storage
          .from("library-media")
          .createSignedUrl(branding.logo_storage_path, 60 * 60);
        plannerLogoUrl = signed?.signedUrl ?? null;
      }
    } catch {
      // pre-migration / no-branding-row — stay on defaults
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ "--accent": brandingAccent } as React.CSSProperties}
    >
      <Nav
        userEmail={user.email ?? null}
        role={role}
        workspaceName={workspace?.name ?? null}
        weddingDate={workspace?.wedding_date ?? null}
        plannerDisplayName={plannerDisplayName}
        plannerLogoUrl={plannerLogoUrl}
        accentHex={brandingAccent}
      />
      <main className="container flex-1 py-10">{children}</main>
    </div>
  );
}
