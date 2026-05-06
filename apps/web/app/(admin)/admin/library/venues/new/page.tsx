import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LibraryVenueForm } from "@/components/admin-library/venues/library-venue-form";

export const dynamic = "force-dynamic";

export default function AdminLibraryVenueNewPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href="/admin/library/venues"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-stone-500 transition hover:text-stone-900"
        >
          <ChevronLeft className="h-3 w-3" />
          Venues
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-4xl font-light leading-tight tracking-tight">
          New venue
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Add a venue to your studio library. Photos &amp; videos can be
          uploaded after the first save.
        </p>
      </header>

      <LibraryVenueForm mode="create" />
    </div>
  );
}
