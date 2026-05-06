import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LibraryVendorForm } from "@/components/admin-library/vendors/library-vendor-form";
import { PushVendorButton } from "@/components/admin-push";
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
      "id, org_id, name, category, contact_name, contact_email, contact_phone, default_quoted_price_eur, notes, website, instagram, planner_rating, default_contract_path, tags, lead_time_days, price_band, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!vendor) notFound();

  // Workspaces in this org so the planner can push the vendor to a client
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .order("created_at", { ascending: true });

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

      {(workspaces ?? []).length > 0 && (
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50/60 via-white to-amber-50/60">
          <CardContent className="space-y-3 py-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Send to a client
              </div>
              <p className="mt-1 text-sm text-stone-700">
                Clones this vendor into the selected workspace. The library
                copy stays untouched.
              </p>
            </div>
            <PushVendorButton
              libraryVendorId={vendor.id}
              workspaces={workspaces ?? []}
            />
          </CardContent>
        </Card>
      )}

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
              website: vendor.website ?? null,
              instagram: vendor.instagram ?? null,
              planner_rating: vendor.planner_rating ?? null,
              tags: vendor.tags ?? [],
              lead_time_days: vendor.lead_time_days ?? null,
              price_band: vendor.price_band ?? null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
