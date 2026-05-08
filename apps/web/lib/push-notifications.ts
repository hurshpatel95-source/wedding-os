// Browser push notifications scaffolding — NOT IMPLEMENTED IN WAVE 3.
//
// To wire this up later you will need:
//   1. VAPID keys (web-push generate-vapid-keys) stored in env:
//        - VAPID_PUBLIC_KEY (exposed to client as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//        - VAPID_PRIVATE_KEY (server-only)
//        - VAPID_CONTACT_EMAIL (mailto: for the push provider)
//   2. A service worker at apps/web/public/sw.js that handles the
//      `push` event and shows the notification.
//   3. A push_subscriptions table (workspace_id, user_id, endpoint, keys)
//      and an API route to register/unregister subscriptions.
//   4. The `web-push` npm package on the server side.
//
// Until then this file is a stable import surface so call-sites can
// reference `sendPushNotification(...)` without breaking once it's built.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertRow } from "@/lib/autopilot-types";

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;          // deep link the SW will open on click
  icon?: string;
  tag?: string;          // de-dupe identifier
}

export interface PushDispatchResult {
  attempted: number;
  delivered: number;
  failed: number;
  skipped: boolean;      // true when push isn't configured yet
  reason?: string;
}

/**
 * Fan out a push notification to every active subscription for a workspace.
 *
 * TODO(wave-4): implement once VAPID keys + service worker + push_subscriptions
 * table land. Currently a no-op that returns skipped=true so callers can
 * already invoke it without conditional logic.
 */
export async function sendPushToWorkspace(
  _sb: SupabaseClient,
  _workspaceId: string,
  _payload: PushPayload,
): Promise<PushDispatchResult> {
  return {
    attempted: 0,
    delivered: 0,
    failed: 0,
    skipped: true,
    reason: "push notifications not yet implemented (no VAPID keys / service worker)",
  };
}

/**
 * Convert an AlertRow into the push payload we'd want to ship. Lives here
 * (not in alert-helpers) so push-side concerns stay isolated.
 */
export function alertToPushPayload(
  alert: AlertRow,
  baseUrl: string,
): PushPayload {
  const url = alert.action_url
    ? alert.action_url.startsWith("http")
      ? alert.action_url
      : `${baseUrl.replace(/\/+$/, "")}${alert.action_url}`
    : `${baseUrl.replace(/\/+$/, "")}/autopilot`;
  return {
    title: alert.title,
    body: alert.body ?? undefined,
    url,
    tag: `alert-${alert.id}`,
  };
}

/** True once VAPID env vars are present. Helpful for UI gating. */
export function pushNotificationsEnabled(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_CONTACT_EMAIL,
  );
}
