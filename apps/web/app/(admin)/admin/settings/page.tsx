import Link from "next/link";
import { Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// The settings hub is a coordination point: multiple Wave 2 features
// hang their config card off this page (email templates, team members,
// notification prefs, etc.). Each feature appends its card below — the
// page is intentionally just a flat grid of links.
export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Studio
        </div>
        <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Studio-wide configuration that applies to every couple workspace.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/settings/email-templates"
          className="group block"
        >
          <Card className="h-full overflow-hidden border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md">
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-medium leading-tight tracking-tight">
                  Email templates
                </h2>
                <p className="mt-2 text-sm text-stone-500">
                  Save the emails you send all the time. Reuse them across
                  clients with one click.
                </p>
              </div>
              <div className="mt-auto text-xs uppercase tracking-[0.2em] text-stone-400 group-hover:text-stone-600">
                Manage templates →
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
