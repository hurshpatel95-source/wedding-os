"use client";

// Lightweight "you're brand new!" banner for couples just past the
// /couples-signup magic-link. Mounts on the couple-side dashboard
// (/(app)/page.tsx) but the UI-POLISH agent currently owns that file, so
// COUPLES-SIGNUP leaves it unmounted and includes mount instructions in the
// punch list:
//
//   import { WelcomeBanner } from "@/components/couples-welcome/welcome-banner";
//   ...
//   <WelcomeBanner workspaceCreatedAt={workspace.created_at} ... />
//
// Place it near the top of the dashboard hero section so it's the first
// thing they see after they log in for the first time.
//
// Audit #9 (2026-05-12) — banner used to push a single Co-pilot CTA. Now
// it surfaces a 3-step "first moves" list: confirm wedding date, generate
// the AI budget baseline, pick the wedding URL — plus the Co-pilot link
// as a third option that's always present. Each step is gated on
// workspace state so we don't push something Rachel already finished.

import Link from "next/link";
import {
  Calendar,
  Globe,
  MessageSquare,
  Sparkles,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "couples-welcome-banner-dismissed";
const SHOW_FOR_DAYS = 7;

interface StarterStep {
  key: string;
  icon: LucideIcon;
  title: string;
  subhead: string;
  href: string;
}

export function WelcomeBanner({
  workspaceCreatedAt,
  hasWeddingDate = false,
  hasBudget = false,
  hasPublicSlug = false,
  justOnboarded = false,
}: {
  workspaceCreatedAt: string;
  hasWeddingDate?: boolean;
  hasBudget?: boolean;
  hasPublicSlug?: boolean;
  /** Set when the user just completed the /onboarding chat. Used to clarify
   * why step 1 is asking for something we should already know — onboarding
   * sometimes can't extract a wedding date from natural-language chat. */
  justOnboarded?: boolean;
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

  // Pick the first two starter steps based on workspace state — only one
  // shows at a time so the banner stays focused. The Co-pilot link is
  // always present as the third option.
  const steps: StarterStep[] = [];
  if (!hasWeddingDate) {
    steps.push({
      key: "date",
      icon: Calendar,
      title: "Add your wedding date",
      subhead: justOnboarded
        ? "We didn't catch this in our chat — please add it."
        : "So timelines and countdowns line up.",
      href: "/settings/preferences",
    });
  } else if (!hasBudget) {
    steps.push({
      key: "budget",
      icon: Wallet,
      title: "Generate your AI budget",
      subhead: "A starter budget scaled to your guest count.",
      href: "/budget",
    });
  } else if (!hasPublicSlug) {
    steps.push({
      key: "slug",
      icon: Globe,
      title: "Pick your wedding URL",
      subhead: "Share /w/your-names with guests when you’re ready.",
      href: "/settings/public-site",
    });
  }
  steps.push({
    key: "copilot",
    icon: MessageSquare,
    title: "Talk to the AI Co-pilot",
    subhead: "Ask anything — it already knows your wedding.",
    href: "/assistant",
  });

  return (
    <div className="mb-6 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-amber-50 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="font-serif text-base font-medium tracking-tight text-stone-900">
              Welcome to Acquired Planner.
            </div>
            <p className="mt-0.5 text-sm leading-snug text-stone-700">
              A couple of quick first moves to get you set up.
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

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className="flex items-start gap-3 rounded-xl border border-rose-100 bg-white/70 p-3 transition hover:border-rose-300 hover:bg-white"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-stone-900">
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-600">
                    {step.subhead}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
