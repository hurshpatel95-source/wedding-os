import Link from "next/link";
import { Calendar as CalendarIcon } from "lucide-react";

export const dynamic = "force-dynamic";

interface SettingsCard {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

// Each Wave 2 agent appends their card to this list. Keep it alphabetised
// when more land.
const CARDS: SettingsCard[] = [
  {
    href: "/admin/settings/calendar",
    title: "Calendar sync",
    description:
      "Connect Google Calendar or an iCal feed so /book/<slug> hides slots when you're already busy.",
    icon: <CalendarIcon className="h-5 w-5" />,
  },
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Settings
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Configure how your studio runs — calendar sync, team, templates,
          routing, and more.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400 hover:shadow"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-700 group-hover:bg-stone-900 group-hover:text-white">
                {c.icon}
              </span>
              <div>
                <div className="font-serif text-lg font-light tracking-tight text-stone-900">
                  {c.title}
                </div>
                <p className="mt-1 text-sm text-stone-600">{c.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
