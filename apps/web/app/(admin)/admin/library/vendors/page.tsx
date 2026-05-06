import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LibraryVendorList } from "@/components/admin-library/vendors/library-vendor-list";
import type { LibraryVendorListItem } from "@/lib/library-vendor-types";

export const dynamic = "force-dynamic";

export default async function AdminLibraryVendorsPage() {
  const supabase = createClient();

  // `library_vendors` rows are protected by RLS — the layout already gates
  // `org_admin` access. We cast for a tighter return-type than the generic
  // typed builder gives us for the new planner-OS slab.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: LibraryVendorListItem[] | null }>;
      };
    };
  };

  const { data: vendors } = await sb
    .from("library_vendors")
    .select(
      "id, name, category, contact_name, contact_email, contact_phone, default_quoted_price_eur, notes, created_at",
    )
    .order("name", { ascending: true });

  const list: LibraryVendorListItem[] = vendors ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
            Library
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
            Vendors
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Reusable vendor roster shared across every couple workspace in your
            studio. Add a vendor once, push it into a wedding when you're ready.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/library/vendors/new">
            <Plus className="h-4 w-4" />
            New vendor
          </Link>
        </Button>
      </header>

      <LibraryVendorList vendors={list} />
    </div>
  );
}
