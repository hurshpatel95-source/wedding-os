import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  // Supabase sends the OTP/expired-token errors in the URL hash, but a few
  // routes also pass them as query params. Catch the query path here; the
  // hash path is handled client-side on /login.
  const callbackError = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  if (callbackError) {
    const isExpired =
      errorCode === "otp_expired" ||
      callbackError === "access_denied" ||
      (searchParams.get("error_description") ?? "").toLowerCase().includes("expired");
    return NextResponse.redirect(
      `${origin}/login?error=${isExpired ? "expired" : "auth"}`,
    );
  }

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
    // exchangeCodeForSession failed — most often because the link expired
    // or was already used. Redirect with a friendly banner.
    const isExpired = (error?.message ?? "").toLowerCase().includes("expired");
    return NextResponse.redirect(
      `${origin}/login?error=${isExpired ? "expired" : "auth"}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
