import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewClientForm } from "@/components/admin-clients/new-client-form";

export const dynamic = "force-dynamic";

interface LibraryVenueOpt {
  id: string;
  name: string;
  city: string | null;
}
interface LibraryVendorOpt {
  id: string;
  name: string;
  category: string;
}

export default async function NewClientPage() {
  const supabase = createClient();

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: Array<Record<string, unknown>> | null;
        }>;
      };
    };
  };

  const [{ data: libVenuesRaw }, { data: libVendorsRaw }] = await Promise.all([
    sb
      .from("library_venues")
      .select("id, name, city")
      .order("name", { ascending: true }),
    sb
      .from("library_vendors")
      .select("id, name, category")
      .order("name", { ascending: true }),
  ]);

  const libraryVenues: LibraryVenueOpt[] =
    (libVenuesRaw ?? []).map((v) => ({
      id: String(v.id),
      name: String(v.name),
      city: (v.city as string | null) ?? null,
    }));
  const libraryVendors: LibraryVendorOpt[] =
    (libVendorsRaw ?? []).map((v) => ({
      id: String(v.id),
      name: String(v.name),
      category: String(v.category),
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">New client</CardTitle>
        </CardHeader>
        <CardContent>
          <NewClientForm
            libraryVenues={libraryVenues}
            libraryVendors={libraryVendors}
          />
        </CardContent>
      </Card>
    </div>
  );
}
