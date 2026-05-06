import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LibraryVendorForm } from "@/components/admin-library/vendors/library-vendor-form";
import {
  VENDOR_CATEGORY_ICON,
  VENDOR_CATEGORY_LABEL,
} from "@/lib/vendor-categories";
import type { LibraryVendorRow } from "@/lib/library-vendor-types";

export const dynamic = "force-dynamic";

export default async function EditLibraryVendorPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  // Cast for the new `library_vendors` slab — same pattern as the list page.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{ data: LibraryVendorRow | null }>;
        };
      };
    };
  };

  const { data: vendor } = await sb
    .from("library_vendors")
    .select(
      "id, org_id, name, category, contact_name, contact_email, contact_phone, default_quoted_price_eur, notes, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!vendor) notFound();

  const Icon = VENDOR_CATEGORY_ICON[vendor.category];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/library/vendors"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to vendors
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="font-serif text-3xl">{vendor.name}</CardTitle>
              <Badge
                variant="secondary"
                className="flex w-fit items-center gap-1 text-[10px] uppercase tracking-wider"
              >
                <Icon className="h-3 w-3" />
                {VENDOR_CATEGORY_LABEL[vendor.category]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LibraryVendorForm
            mode="edit"
            vendor={{
              id: vendor.id,
              name: vendor.name,
              category: vendor.category,
              contact_name: vendor.contact_name,
              contact_email: vendor.contact_email,
              contact_phone: vendor.contact_phone,
              default_quoted_price_eur: vendor.default_quoted_price_eur,
              notes: vendor.notes,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
