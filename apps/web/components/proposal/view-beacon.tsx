"use client";

import { useEffect } from "react";

/**
 * Fires a one-shot POST /api/proposal/[token]/view on first paint of a
 * sent-but-not-yet-viewed proposal so the planner sees the open. Failures
 * are silent — the planner-side activity log is best-effort, never a
 * blocker for the couple seeing the page.
 */
export function ProposalViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    let cancelled = false;
    const send = async () => {
      try {
        await fetch(`/api/proposal/${token}/view`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
          keepalive: true,
        });
      } catch {
        // ignore
      }
    };
    if (!cancelled) {
      void send();
    }
    return () => {
      cancelled = true;
    };
  }, [token]);

  return null;
}
