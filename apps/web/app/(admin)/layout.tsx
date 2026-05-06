import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // `org_role` is part of the new planner-OS slab — read defensively in case
  // the migration hasn't been applied yet.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };

  const { data: profile } = await sb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgRole = (profile?.org_role ?? null) as "org_admin" | "member" | null;
  if (orgRole !== "org_admin") redirect("/");

  // Fetch all workspaces in this org for the "View as workspace" stub picker.
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .order("created_at", { ascending: true });

  return (
    <div className="flex min-h-screen flex-col">
      <AdminNav
        userEmail={user.email ?? null}
        workspaces={workspaces ?? []}
      />
      <main className="container flex-1 py-10">{children}</main>
    </div>
  );
}
