import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  VENDOR_CATEGORY_GROUP,
  VENDOR_CATEGORY_ICON,
  VENDOR_CATEGORY_LABEL,
  VENDOR_GROUP_ORDER,
} from "@/lib/vendor-categories";
import { VENDOR_AUTOPILOT_LABEL } from "@/lib/autopilot-types";
import type { VendorAutopilotStatus } from "@/lib/autopilot-types";
import type { VendorCategory } from "@/lib/vendor-types";
import type { AutopilotVendor } from "@/app/(app)/autopilot/page";

// Tailwind chip palette per autopilot status. Stone for "not started",
// rose for ones that need a reply (contacted with no inbound), amber for
// quoted/pending, emerald for booked.
const STATUS_CHIP: Record<VendorAutopilotStatus, string> = {
  none: "bg-stone-100 text-stone-700 border-stone-200",
  researching: "bg-sky-50 text-sky-800 border-sky-200",
  contacted: "bg-amber-50 text-amber-800 border-amber-200",
  quoted: "bg-violet-50 text-violet-800 border-violet-200",
  booked: "bg-emerald-50 text-emerald-800 border-emerald-200",
  declined: "bg-stone-100 text-stone-500 border-stone-200",
  unavailable: "bg-stone-100 text-stone-500 border-stone-200",
};

// We render chips in this order so "active" statuses come first.
const STATUS_ORDER: VendorAutopilotStatus[] = [
  "researching",
  "contacted",
  "quoted",
  "booked",
  "unavailable",
  "declined",
  "none",
];

export function VendorPipeline({ vendors }: { vendors: AutopilotVendor[] }) {
  if (vendors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-10 text-center">
        <p className="font-serif text-xl text-stone-700">No vendors yet</p>
        <p className="mt-2 text-sm text-stone-500">
          <Link
            href="/vendors"
            className="underline underline-offset-2 hover:text-stone-900"
          >
            Add your first vendor
          </Link>{" "}
          and Autopilot will start tracking outreach automatically.
        </p>
      </div>
    );
  }

  // Group vendors by category, then by autopilot_status within each
  const byCategory = new Map<VendorCategory, AutopilotVendor[]>();
  for (const v of vendors) {
    const arr = byCategory.get(v.category) ?? [];
    arr.push(v);
    byCategory.set(v.category, arr);
  }

  // Group categories by their human-friendly section ("Design", "Capture", …)
  const categoriesByGroup = new Map<string, VendorCategory[]>();
  for (const cat of byCategory.keys()) {
    const g = VENDOR_CATEGORY_GROUP[cat] ?? "Other";
    const arr = categoriesByGroup.get(g) ?? [];
    arr.push(cat);
    categoriesByGroup.set(g, arr);
  }

  return (
    <div className="space-y-8">
      {VENDOR_GROUP_ORDER.filter((g) => categoriesByGroup.has(g)).map(
        (groupName) => (
          <div key={groupName}>
            <div className="mb-3 text-[11px] uppercase tracking-[0.25em] text-stone-500">
              {groupName}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(categoriesByGroup.get(groupName) ?? []).map((cat) => {
                const list = byCategory.get(cat) ?? [];
                return (
                  <CategoryCard key={cat} category={cat} vendors={list} />
                );
              })}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function CategoryCard({
  category,
  vendors,
}: {
  category: VendorCategory;
  vendors: AutopilotVendor[];
}) {
  const Icon = VENDOR_CATEGORY_ICON[category];
  const label = VENDOR_CATEGORY_LABEL[category];

  // Count by autopilot_status
  const counts = new Map<VendorAutopilotStatus, number>();
  for (const v of vendors) {
    counts.set(v.autopilot_status, (counts.get(v.autopilot_status) ?? 0) + 1);
  }

  // Build a one-line "5 contacted · 2 quoted · 1 unavailable · 0 booked"
  // summary, but only show statuses with count > 0.
  const summaryParts: string[] = [];
  for (const s of STATUS_ORDER) {
    const c = counts.get(s);
    if (c && c > 0) summaryParts.push(`${c} ${VENDOR_AUTOPILOT_LABEL[s].toLowerCase()}`);
  }
  const summary =
    summaryParts.length > 0 ? summaryParts.join(" · ") : "Not started";

  return (
    <Link
      href={`/vendors?category=${category}`}
      className="group block rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100">
            <Icon className="h-4 w-4 text-stone-700" />
          </div>
          <div>
            <div className="font-serif text-lg leading-tight">{label}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-700" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {STATUS_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => (
          <span
            key={s}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP[s]}`}
          >
            {counts.get(s)} {VENDOR_AUTOPILOT_LABEL[s].toLowerCase()}
          </span>
        ))}
        {summaryParts.length === 0 && (
          <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
            {summary}
          </span>
        )}
      </div>
    </Link>
  );
}
