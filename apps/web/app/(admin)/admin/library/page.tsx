import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminLibraryPage() {
  const supabase = createClient();

  // Both library tables are org-scoped via RLS; read defensively in case the
  // migration hasn't been applied yet.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (
        cols: string,
        opts: { count: "exact"; head: true },
      ) => Promise<{ count: number | null }>;
    };
  };

  let venuesCount: number | null = null;
  let vendorsCount: number | null = null;
  try {
    const r = await sb
      .from("library_venues")
      .select("id", { count: "exact", head: true });
    venuesCount = r.count ?? 0;
  } catch {
    venuesCount = null;
  }
  try {
    const r = await sb
      .from("library_vendors")
      .select("id", { count: "exact", head: true });
    vendorsCount = r.count ?? 0;
  } catch {
    vendorsCount = null;
  }

  return (
    <div className="space-y-10">
      <header>
        <div className="mb-3 text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Library
        </div>
        <h1 className="font-serif text-4xl font-light leading-tight tracking-tight md:text-5xl">
          Reusable venues &amp; vendors
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
          One canonical record per venue / vendor in your studio. Push from here
          into a couple&apos;s workspace when you&apos;re ready to shortlist.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Link href="/admin/library/venues" className="group block">
          <Card className="h-full overflow-hidden border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="text-3xl font-serif font-light text-stone-900">
                  {venuesCount === null ? "—" : venuesCount}
                </div>
              </div>
              <div>
                <h2 className="font-serif text-2xl font-medium leading-tight tracking-tight">
                  Venues
                </h2>
                <p className="mt-2 text-sm text-stone-500">
                  Catalog of every venue you&apos;ve worked with — capacity,
                  hire fee, photos, brochure notes.
                </p>
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-stone-400 group-hover:text-stone-600">
                Open library →
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/library/vendors" className="group block">
          <Card className="h-full overflow-hidden border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white">
                  <Users className="h-5 w-5" />
                </div>
                <div className="text-3xl font-serif font-light text-stone-900">
                  {vendorsCount === null ? "—" : vendorsCount}
                </div>
              </div>
              <div>
                <h2 className="font-serif text-2xl font-medium leading-tight tracking-tight">
                  Vendors
                </h2>
                <p className="mt-2 text-sm text-stone-500">
                  Photographers, florists, decor, sound — your preferred-supplier
                  list with default rates.
                </p>
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-stone-400 group-hover:text-stone-600">
                Open library →
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
