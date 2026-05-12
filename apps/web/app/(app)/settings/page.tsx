// /settings — hub page for couple-facing settings. Lists the available
// sub-pages (Preferences + Public site) as cards. Header style matches
// /settings/preferences and /settings/public-site so the section feels
// consistent.
//
// New surfaces (notifications, account, billing) get added here as they
// land — the footer note hints at that without committing to a date.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Globe, Sliders } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SettingsCard {
  href: string;
  title: string;
  description: string;
  icon: typeof Globe;
}

const cards: SettingsCard[] = [
  {
    href: "/settings/preferences",
    title: "Preferences",
    description:
      "Wedding date, currency, couple names, contact info.",
    icon: Sliders,
  },
  {
    href: "/settings/public-site",
    title: "Public site",
    description:
      "URL slug, theme, story, schedule, FAQ. The page your guests see.",
    icon: Globe,
  },
];

export default async function SettingsHubPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
          Settings
        </div>
        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
          Settings
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Workspace-level configuration — what your wedding is, where it
          is, and what guests see.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-stone-400 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-700">
                <Icon className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h2 className="font-serif text-2xl font-light tracking-tight">
                  {c.title}
                </h2>
                <p className="text-sm text-stone-600">{c.description}</p>
              </div>
              <div className="mt-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.2em] text-stone-500 transition group-hover:text-stone-900">
                Open <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-stone-500">
        More settings coming soon — notifications, account, billing.
      </p>
    </div>
  );
}
