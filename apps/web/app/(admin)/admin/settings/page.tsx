import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Mail,
  Route,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SettingSection {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status?: "live" | "soon";
}

const sections: SettingSection[] = [
  {
    href: "/admin/settings/team",
    title: "Team",
    description:
      "Invite planners and assistants to share your studio dashboard.",
    icon: Users,
    status: "live",
  },
  {
    href: "/admin/settings/email-templates",
    title: "Email templates",
    description:
      "Reusable copy for vendor outreach, save-the-dates, and follow-ups.",
    icon: Mail,
    status: "soon",
  },
  {
    href: "/admin/settings/lead-routing",
    title: "Lead routing",
    description:
      "Auto-assign incoming leads based on source, budget, or region.",
    icon: Route,
    status: "soon",
  },
  {
    href: "/admin/settings/calendar",
    title: "Calendar connections",
    description:
      "Sync your Google Calendar so the booking page hides conflicts.",
    icon: Calendar,
    status: "soon",
  },
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Studio
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Configure how your studio runs — team members, automated lead
          routing, email templates, and calendar sync.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="group">
              <Card className="h-full transition hover:border-rose-300 hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 py-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    {s.status === "soon" && (
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stone-500">
                        Soon
                      </span>
                    )}
                    {s.status === "live" && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-serif text-xl text-stone-900">
                      {s.title}
                    </h2>
                    <p className="mt-1 text-sm text-stone-600">
                      {s.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-rose-700 opacity-0 transition group-hover:opacity-100">
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
