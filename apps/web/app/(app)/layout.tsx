import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ImpersonationBanner } from "@/components/admin-impersonation-banner";
import {
  ACQUIRED_PLANNER_ACCENT,
  getSkinFor,
  normalizeSkin,
} from "@/lib/workspace-skin";
import { resolveWorkspaceMode } from "@/lib/workspace-mode";
import { WorkspaceModeProvider } from "@/components/workspace/workspace-mode-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: workspaceBase }] = await Promise.all([
    supabase
      .from("users")
      .select("role, workspace_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("workspaces")
      .select("id, name, wedding_date")
      .limit(1)
      .maybeSingle(),
  ]);

  // The `skin` column was added in migration 20260508000003. Generated
  // Supabase types lag behind, so read defensively via a separate query
  // and a permissive cast — pre-migration environments still render with
  // the default Acquired Planner skin.
  let workspaceSkin = "acquired_planner";
  if (workspaceBase?.id) {
    try {
      const sb = supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: { skin?: string | null } | null;
              }>;
            };
          };
        };
      };
      const { data: skinRow } = await sb
        .from("workspaces")
        .select("skin")
        .eq("id", workspaceBase.id)
        .maybeSingle();
      if (skinRow?.skin) workspaceSkin = skinRow.skin;
    } catch {
      // pre-migration — stay on default
    }
  }
  const workspace = workspaceBase;

  const role = (profile?.role ?? null) as "admin" | "couple" | null;

  // Detect workspace impersonation — for org_admins, auth_workspace_id()
  // returns the override row's workspace_id when set. Surface a banner so
  // the planner knows they're viewing as someone else.
  let impersonatingWorkspaceName: string | null = null;
  try {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { workspace_id?: string | null } | null;
            }>;
          };
        };
      };
    };
    const { data: override } = await sb
      .from("active_workspace_overrides")
      .select("workspace_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (override?.workspace_id && workspace?.id !== profile?.workspace_id) {
      // The workspace we just fetched is the impersonated one (RLS picked
      // it up via auth_workspace_id), so its name is the right label.
      impersonatingWorkspaceName = workspace?.name ?? "another client";
    }
  } catch {
    // Pre-migration tolerant
  }

  // Pull this workspace's branding row (per-couple accent + planner display
  // name + logo). Couple workspace_branding is readable to workspace members
  // via RLS. Read defensively — pre-migration or no-row should fall back to
  // hardcoded defaults.
  let brandingAccent: string = ACQUIRED_PLANNER_ACCENT;
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

  // Resolve the brand preset for this workspace's skin. For co_branded /
  // white_label, fold in the planner's branding row (display name +
  // accent) so the planner's identity is what the couple sees. For
  // acquired_planner / acquired_style_collab, the static preset wins.
  const skin = normalizeSkin(workspaceSkin);
  const brand = getSkinFor(skin, {
    displayName: plannerDisplayName,
    accentHex: brandingAccent,
  });

  // T1.5 — derive the architectural mode from skin. Provides the fork
  // point for B2C self-serve vs B2B planner-served couple experiences.
  // Server components can re-derive mode from their own workspace fetch;
  // client components consume it via useWorkspaceMode().
  const mode = resolveWorkspaceMode(skin);

  // Edge case: a co_branded workspace where workspace_branding never got
  // populated falls back to "Your planner" + the workspace name as
  // subtitle so the header doesn't render empty.
  const navSubtitle =
    (skin === "co_branded" || skin === "white_label") &&
    !plannerDisplayName &&
    workspace?.name
      ? workspace.name
      : null;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={
        {
          "--accent": brand.accentHex,
          "--brand-accent": brand.accentHex,
        } as React.CSSProperties
      }
    >
      {impersonatingWorkspaceName && (
        <ImpersonationBanner workspaceName={impersonatingWorkspaceName} />
      )}
      <WorkspaceModeProvider mode={mode}>
        {/* Audit #42: skip-to-content link — visually hidden until focused. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-stone-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <Nav
          userEmail={user.email ?? null}
          role={role}
          workspaceName={workspace?.name ?? null}
          weddingDate={workspace?.wedding_date ?? null}
          plannerDisplayName={plannerDisplayName}
          plannerLogoUrl={plannerLogoUrl}
          accentHex={brand.accentHex}
          brand={brand}
          brandSubtitleFallback={navSubtitle}
        />
        <main id="main-content" className="container flex-1 py-10">
          {children}
        </main>
      </WorkspaceModeProvider>
    </div>
  );
}
