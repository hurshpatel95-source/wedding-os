import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@wedding-os/db";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");
  // Public routes anyone can hit without sign-in:
  // - /marketing  → SaaS landing page for new planners
  // - /signup     → self-serve planner signup form
  // - /book/<slug>→ planner's public consult-booking page
  // - /w/<slug>   → couple's public wedding site
  // - /rsvp/<token> → guest RSVP self-serve
  // - /api/public/* → anon-callable endpoints (lead capture, org lookup)
  const isPublicRoute =
    path === "/" && false ||
    path.startsWith("/marketing") ||
    path.startsWith("/signup") ||
    path.startsWith("/book/") ||
    path.startsWith("/w/") ||
    path.startsWith("/rsvp/") ||
    path.startsWith("/sign/") ||
    path.startsWith("/proposal/") ||
    path.startsWith("/api/public/") ||
    path.startsWith("/api/rsvp/") ||
    path.startsWith("/api/signup") ||
    path.startsWith("/api/sign/") ||
    path.startsWith("/api/proposal/") ||
    path.startsWith("/api/stripe/webhook");

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    // Route signed-in users by org_role. Read defensively — pre-migration the
    // column doesn't exist; we default to "/" in that case.
    let destination = "/";
    try {
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
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.org_role === "org_admin") destination = "/admin";
    } catch {
      // ignore — default destination is "/"
    }
    const url = request.nextUrl.clone();
    url.pathname = destination;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
