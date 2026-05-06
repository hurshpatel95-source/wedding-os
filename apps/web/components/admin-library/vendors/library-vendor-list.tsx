"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/utils";
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_GROUP,
  VENDOR_CATEGORY_ICON,
  VENDOR_CATEGORY_LABEL,
  VENDOR_GROUP_ORDER,
} from "@/lib/vendor-categories";
import type { VendorCategory } from "@/lib/vendor-types";
import type { LibraryVendorListItem } from "@/lib/library-vendor-types";

type CategoryFilter = "any" | VendorCategory;

export function LibraryVendorList({
  vendors,
}: {
  vendors: LibraryVendorListItem[];
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("any");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return vendors.filter((v) => {
      if (needle) {
        const hay =
          `${v.name} ${v.contact_name ?? ""} ${v.contact_email ?? ""} ${v.contact_phone ?? ""} ${v.notes ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (category !== "any" && v.category !== category) return false;
      return true;
    });
  }, [vendors, q, category]);

  // Group filtered vendors by category, sorted by VENDOR_GROUP_ORDER then label
  const grouped = useMemo(() => {
    const byGroup = new Map<string, Map<VendorCategory, LibraryVendorListItem[]>>();
    for (const v of filtered) {
      const group = VENDOR_CATEGORY_GROUP[v.category];
      if (!byGroup.has(group)) byGroup.set(group, new Map());
      const inner = byGroup.get(group)!;
      if (!inner.has(v.category)) inner.set(v.category, []);
      inner.get(v.category)!.push(v);
    }
    return byGroup;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="lvq">Search</Label>
          <Input
            id="lvq"
            placeholder="Name, contact, or notes"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {VENDOR_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {VENDOR_CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="font-serif text-2xl text-stone-700">Library is empty</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Add reusable vendors here once and push them into any couple
              workspace later.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No vendors match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {VENDOR_GROUP_ORDER.map((groupName) => {
            const groupCats = grouped.get(groupName);
            if (!groupCats || groupCats.size === 0) return null;
            const totalInGroup = Array.from(groupCats.values()).reduce(
              (sum, list) => sum + list.length,
              0,
            );
            // Sort categories within the group by VENDOR_CATEGORY_LABEL
            const sortedCats = Array.from(groupCats.keys()).sort((a, b) =>
              VENDOR_CATEGORY_LABEL[a].localeCompare(VENDOR_CATEGORY_LABEL[b]),
            );
            return (
              <section key={groupName} className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-stone-200 pb-2">
                  <h2 className="font-serif text-2xl tracking-tight text-stone-800">
                    {groupName}
                  </h2>
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {totalInGroup} vendor{totalInGroup === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-5">
                  {sortedCats.map((cat) => {
                    const list = groupCats.get(cat)!;
                    const Icon = VENDOR_CATEGORY_ICON[cat];
                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-500">
                          <Icon className="h-3 w-3" />
                          {VENDOR_CATEGORY_LABEL[cat]}
                          <span className="text-stone-400">· {list.length}</span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {list
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((v) => (
                              <LibraryVendorCard key={v.id} vendor={v} />
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LibraryVendorCard({ vendor }: { vendor: LibraryVendorListItem }) {
  const Icon = VENDOR_CATEGORY_ICON[vendor.category];
  return (
    <Link
      href={`/admin/library/vendors/${vendor.id}`}
      className="group block"
    >
      <Card className="h-full overflow-hidden border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <Badge
              variant="secondary"
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider"
            >
              <Icon className="h-3 w-3" />
              {VENDOR_CATEGORY_LABEL[vendor.category]}
            </Badge>
          </div>

          <div>
            <h3 className="font-serif text-xl font-medium leading-tight tracking-tight text-stone-900">
              {vendor.name}
            </h3>
            {(vendor.contact_name || vendor.contact_email) && (
              <p className="mt-1 line-clamp-1 text-sm text-stone-500">
                {[vendor.contact_name, vendor.contact_email].filter(Boolean).join(" · ")}
              </p>
            )}
            {vendor.contact_phone && (
              <p className="mt-0.5 line-clamp-1 text-xs text-stone-400">
                {vendor.contact_phone}
              </p>
            )}
          </div>

          <div className="mt-auto border-t border-stone-100 pt-3 text-sm">
            {vendor.default_quoted_price_eur != null ? (
              <span className="font-medium text-stone-700">
                {formatMoney(Number(vendor.default_quoted_price_eur), "EUR")}
                <span className="ml-1 text-xs font-normal text-stone-400">
                  default
                </span>
              </span>
            ) : (
              <span className="text-xs uppercase tracking-wider text-stone-400">
                No default price
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
