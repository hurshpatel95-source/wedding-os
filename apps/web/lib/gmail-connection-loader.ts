// Server-only: load the workspace's active Gmail connection row, or fail
// fast with a typed reason. Used by every /api/gmail/* route except the
// OAuth + webhook routes.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GmailConnectionRow } from "@/lib/autopilot-types";

export async function loadActiveGmailConnection(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<GmailConnectionRow | null> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<{
                  data: GmailConnectionRow | null;
                }>;
              };
            };
          };
        };
      };
    };
  };
  const { data } = await sb
    .from("gmail_connections")
    .select(
      "id, org_id, workspace_id, user_id, email, refresh_token, access_token, access_token_expires_at, scopes, status, last_history_id, last_synced_at, last_error, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function loadMostRecentGmailConnection(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<GmailConnectionRow | null> {
  // Same as loadActive but doesn't require status=active. Used for the
  // settings page so we can show revoked/error rows too.
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{
                data: GmailConnectionRow | null;
              }>;
            };
          };
        };
      };
    };
  };
  const { data } = await sb
    .from("gmail_connections")
    .select(
      "id, org_id, workspace_id, user_id, email, refresh_token, access_token, access_token_expires_at, scopes, status, last_history_id, last_synced_at, last_error, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function persistRefreshedAccessToken(
  supabase: SupabaseClient,
  connectionId: string,
  accessToken: string | null,
  expiresAtIso: string | null,
): Promise<void> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      update: (vals: unknown) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  await sb
    .from("gmail_connections")
    .update({
      access_token: accessToken,
      access_token_expires_at: expiresAtIso,
      status: "active",
      last_error: null,
    })
    .eq("id", connectionId);
}
