import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { gmailOauthReady } from "@/lib/gmail-server";
import { loadMostRecentGmailConnection } from "@/lib/gmail-connection-loader";
import { GmailConnectionPanel } from "@/components/gmail/gmail-connection-panel";
import { FeaturePreviewCard } from "@/components/feature-status/feature-preview-card";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: { connected?: string; error?: string };
}

export default async function GmailSettingsPage({ searchParams }: PageProps) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.workspace_id) {
    return (
      <div className="space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>
        <header className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Email connection
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
            Wedding Gmail
          </h1>
        </header>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          You need a workspace before you can connect Gmail. Finish onboarding
          first.
        </div>
      </div>
    );
  }

  const connection = await loadMostRecentGmailConnection(
    supabase,
    profile.workspace_id,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to dashboard
      </Link>

      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Email connection
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Wedding Gmail
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Connect a wedding-only Gmail address so we can read vendor
          replies, draft outreach in your voice, and send on your behalf.
        </p>
      </header>

      {!gmailOauthReady ? (
        <FeaturePreviewCard feature="gmail" />
      ) : (
        <GmailConnectionPanel
          connection={
            connection
              ? {
                  id: connection.id,
                  email: connection.email,
                  status: connection.status,
                  last_synced_at: connection.last_synced_at,
                  last_error: connection.last_error,
                  created_at: connection.created_at,
                }
              : null
          }
          gmailConfigured={gmailOauthReady}
          flashConnected={searchParams?.connected ?? null}
          flashError={searchParams?.error ?? null}
        />
      )}
    </div>
  );
}
