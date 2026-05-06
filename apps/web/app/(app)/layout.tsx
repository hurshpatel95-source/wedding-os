import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: workspace }] = await Promise.all([
    supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("workspaces")
      .select("name, wedding_date")
      .limit(1)
      .maybeSingle(),
  ]);

  const role = (profile?.role ?? null) as "admin" | "couple" | null;

  return (
    <div className="flex min-h-screen flex-col">
      <Nav
        userEmail={user.email ?? null}
        role={role}
        workspaceName={workspace?.name ?? null}
        weddingDate={workspace?.wedding_date ?? null}
      />
      <main className="container flex-1 py-10">{children}</main>
    </div>
  );
}
