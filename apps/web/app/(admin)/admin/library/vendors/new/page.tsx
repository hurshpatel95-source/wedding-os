import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LibraryVendorForm } from "@/components/admin-library/vendors/library-vendor-form";

export const dynamic = "force-dynamic";

export default function NewLibraryVendorPage() {
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
          <CardTitle className="font-serif text-3xl">New library vendor</CardTitle>
          <p className="text-sm text-stone-500">
            Save once. Push into any couple workspace later.
          </p>
        </CardHeader>
        <CardContent>
          <LibraryVendorForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
