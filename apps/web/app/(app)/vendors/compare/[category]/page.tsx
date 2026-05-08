// Side-by-side quote comparison page. Renders all vendors in the given
// category for the current workspace (RLS-scoped) and lets the couple pick
// a winner. Empty state nudges them to /vendors/find.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
} from "@/lib/vendor-categories";
import {
  QuoteCompare,
  type CompareVendor,
} from "@/components/vendor-folders/quote-compare";
import type { VendorCategory } from "@/lib/vendor-types";

export const dynamic = "force-dynamic";

interface VendorCompareRow {
  id: string;
  name: string;
  autopilot_status: string | null;
  quote_eur: number | string | null;
  quote_summary: string | null;
  ai_summary: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
}

export default async function VendorComparePage({
  params,
}: {
  params: { category: string };
}) {
  const category = params.category as VendorCategory;
  if (!(VENDOR_CATEGORIES as readonly string[]).includes(category)) {
    notFound();
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes vendors to the caller's workspace; we still pass category as
  // an explicit filter so the query plan is index-friendly.
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (
            col: string,
            opts: { ascending: boolean; nullsFirst?: boolean },
          ) => Promise<{
            data: VendorCompareRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: rows } = await sb
    .from("vendors")
    .select(
      "id, name, autopilot_status, quote_eur, quote_summary, ai_summary, last_inbound_at, last_outbound_at",
    )
    .eq("category", category)
    .order("name", { ascending: true });

  const vendors: CompareVendor[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    autopilot_status:
      (r.autopilot_status as CompareVendor["autopilot_status"]) ?? "none",
    quote_eur:
      r.quote_eur == null
        ? null
        : typeof r.quote_eur === "string"
          ? Number(r.quote_eur)
          : r.quote_eur,
    quote_summary: r.quote_summary,
    ai_summary: r.ai_summary,
    last_inbound_at: r.last_inbound_at,
    last_outbound_at: r.last_outbound_at,
  }));

  const label = VENDOR_CATEGORY_LABEL[category];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
            Compare
          </p>
          <h1 className="font-serif text-3xl">{label}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Side-by-side view of every {label.toLowerCase()} you&apos;re
            tracking. Pick a winner when you&apos;re ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/vendors"
            className="inline-flex h-9 items-center rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            All vendors
          </Link>
          <Link
            href={`/vendors/find?category=${encodeURIComponent(category)}`}
            className="inline-flex h-9 items-center rounded-md bg-stone-900 px-3 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            Find more
          </Link>
        </div>
      </header>

      <QuoteCompare vendors={vendors} category={label} />
    </div>
  );
}
