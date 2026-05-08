"use client";

// Lightweight "you're brand new!" banner for couples just past the
// /couples-signup magic-link. Mounts on the couple-side dashboard
// (/(app)/page.tsx) but the UI-POLISH agent currently owns that file, so
// COUPLES-SIGNUP leaves it unmounted and includes mount instructions in the
// punch list:
//
//   import { WelcomeBanner } from "@/components/couples-welcome/welcome-banner";
//   ...
//   <WelcomeBanner workspaceCreatedAt={workspace.created_at} />
//
// Place it near the top of the dashboard hero section so it's the first
// thing they see after they log in for the first time.

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "couples-welcome-banner-dismissed";
const SHOW_FOR_DAYS = 7;

export function WelcomeBanner({
  workspaceCreatedAt,
}: {
  workspaceCreatedAt: string;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.localStorage.getItem(STORAGE_KEY);
    setDismissed(flag === "1");
  }, []);

  // Hide if it was created more than SHOW_FOR_DAYS ago, regardless of dismiss.
  let stale = false;
  try {
    const ageMs = Date.now() - new Date(workspaceCreatedAt).getTime();
    stale = ageMs > SHOW_FOR_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    stale = true;
  }

  // Wait for the localStorage check to land before deciding to render. This
  // avoids the SSR/CSR flicker where the banner flashes on for couples who
  // already dismissed it.
  if (dismissed === null) return null;
  if (dismissed) return null;
  if (stale) return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-amber-50 to-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-500 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="font-serif text-base font-medium tracking-tight text-stone-900">
            Welcome to wedding-os.
          </div>
          <p className="mt-0.5 text-sm leading-snug text-stone-700">
            Start by saying hi to your AI planner — it already knows your
            timeline and will draft your first checklist with you.{" "}
            <Link
              href="/assistant"
              className="font-medium text-rose-700 underline-offset-2 hover:underline"
            >
              Open the co-pilot →
            </Link>
          </p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss welcome banner"
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            // ignore storage errors (private mode, etc.)
          }
          setDismissed(true);
        }}
        className="shrink-0 rounded-full p-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
