import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Studio settings
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Configure how your studio runs — team, communications, and routing.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <SettingsCard
          title="Lead routing"
          description="Auto-assign new inquiries to a team member based on source, budget, region, and guest count."
          href="/admin/settings/lead-routing"
          icon={Inbox}
        />
      </section>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition hover:border-stone-400">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-700 transition group-hover:bg-stone-900 group-hover:text-white">
              <Icon className="h-4 w-4" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-stone-400 transition group-hover:text-stone-900" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-medium text-stone-900">
              {title}
            </h3>
            <p className="mt-1 text-xs text-stone-500">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
