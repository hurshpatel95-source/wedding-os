import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Honor an explicit ?next= override; otherwise route by org_role.
      let destination = next ?? "/";
      if (!next) {
        try {
          const userId = data.user?.id;
          if (userId) {
            // Cast — `org_role` may not exist in types until the planner-OS
            // migration is applied. Read defensively.
            const sb = supabase as unknown as {
              from: (t: string) => {
                select: (c: string) => {
                  eq: (
                    col: string,
                    val: string,
                  ) => {
                    maybeSingle: () => Promise<{
                      data: { org_role?: string | null } | null;
                    }>;
                  };
                };
              };
            };
            const { data: profile } = await sb
              .from("users")
              .select("org_role")
              .eq("id", userId)
              .maybeSingle();
            if (profile?.org_role === "org_admin") {
              destination = "/admin";
            }
          }
        } catch {
          // pre-migration — leave destination as "/"
        }
      }
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
