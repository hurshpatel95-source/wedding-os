import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarConnections } from "@/components/admin-calendar/calendar-connections";
import { readGoogleOAuthEnv } from "@/lib/calendar-sync";
import type { CalendarConnectionRow } from "@/lib/wave2-types";

export const dynamic = "force-dynamic";

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profileSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { org_role?: string | null; org_id?: string | null } | null;
          }>;
        };
      };
    };
  };
  const { data: profile } = await profileSb
    .from("users")
    .select("org_role, org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id || profile.org_role !== "org_admin") {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
        <p className="text-sm text-stone-500">Org admins only.</p>
      </div>
    );
  }

  const listSb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: CalendarConnectionRow[] | null }>;
        };
      };
    };
  };
  const { data: rows } = await listSb
    .from("calendar_connections")
    .select(
      "id, org_id, user_id, provider, label, refresh_token, access_token, access_token_expires_at, ical_url, external_calendar_id, status, last_synced_at, last_error, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const connections = (rows ?? []) as CalendarConnectionRow[];
  const googleConfigured = !!readGoogleOAuthEnv();

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          <Link
            href="/admin/settings"
            className="hover:text-stone-800 underline-offset-4 hover:underline"
          >
            Settings
          </Link>{" "}
          / Calendar
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Calendar sync
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect your Google Calendar (or paste an iCal feed URL) so{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs">
            /book/&lt;slug&gt;
          </code>{" "}
          can dim time slots when you&rsquo;re already busy. Your calendar
          contents stay private — we only read busy/free.
        </p>
      </header>

      <CalendarConnections
        initialConnections={connections}
        googleConfigured={googleConfigured}
        flashConnected={searchParams.connected ?? null}
        flashError={searchParams.error ?? null}
      />
    </div>
  );
}
