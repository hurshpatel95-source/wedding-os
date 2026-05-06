"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  VENDOR_STATUSES,
  VENDOR_STATUS_LABEL,
  VENDOR_STATUS_VARIANT,
} from "@/lib/vendor-categories";
import type {
  VendorCategory,
  VendorRow,
  VendorStatus,
} from "@/lib/vendor-types";

type VendorListItem = Pick<
  VendorRow,
  | "id"
  | "name"
  | "category"
  | "status"
  | "contact_name"
  | "contact_email"
  | "quoted_price_eur"
  | "deposit_amount_eur"
  | "deposit_due_at"
  | "deposit_paid_at"
  | "notes"
  | "created_at"
>;

type CategoryFilter = "any" | VendorCategory;
type StatusFilter = "all" | VendorStatus;
type Layout = "group" | "flat";

export function VendorGrid({
  vendors,
  role,
}: {
  vendors: VendorListItem[];
  role: "admin" | "couple" | null;
}) {
  void role;
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("any");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [layout, setLayout] = useState<Layout>("group");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return vendors.filter((v) => {
      if (needle) {
        const hay = `${v.name} ${v.contact_name ?? ""} ${v.contact_email ?? ""} ${v.notes ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (category !== "any" && v.category !== category) return false;
      if (status !== "all" && v.status !== status) return false;
      return true;
    });
  }, [vendors, q, category, status]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="vq">Search</Label>
          <Input
            id="vq"
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
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {VENDOR_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {VENDOR_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Group by</Label>
          <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="group">Category groups</SelectItem>
              <SelectItem value="flat">Flat list</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="font-serif text-2xl text-stone-700">No vendors yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Add florists, photographers, DJs, MUAs, transport — every vendor for the wedding.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No vendors match these filters.
          </CardContent>
        </Card>
      ) : layout === "flat" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((v) => (
              <VendorCard key={v.id} vendor={v} />
            ))}
        </div>
      ) : (
        <div className="space-y-8">
          {VENDOR_GROUP_ORDER.map((groupName) => {
            const inGroup = filtered.filter(
              (v) => VENDOR_CATEGORY_GROUP[v.category] === groupName,
            );
            if (inGroup.length === 0) return null;
            return (
              <section key={groupName} className="space-y-3">
                <div className="flex items-baseline justify-between border-b border-stone-200 pb-2">
                  <h2 className="font-serif text-2xl tracking-tight text-stone-800">
                    {groupName}
                  </h2>
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {inGroup.length} vendor{inGroup.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {inGroup
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((v) => (
                      <VendorCard key={v.id} vendor={v} />
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VendorCard({ vendor }: { vendor: VendorListItem }) {
  const Icon = VENDOR_CATEGORY_ICON[vendor.category];
  const depositSoon = isDepositDueSoon(vendor.deposit_due_at, vendor.deposit_paid_at);

  return (
    <Link href={`/vendors/${vendor.id}`} className="group block">
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
            <Badge
              variant={VENDOR_STATUS_VARIANT[vendor.status]}
              className="text-[10px] uppercase tracking-wider"
            >
              {VENDOR_STATUS_LABEL[vendor.status]}
            </Badge>
          </div>

          <div>
            <h3 className="font-serif text-2xl font-medium leading-tight tracking-tight text-stone-900">
              {vendor.name}
            </h3>
            {(vendor.contact_name || vendor.contact_email) && (
              <p className="mt-1 line-clamp-1 text-sm text-stone-500">
                {[vendor.contact_name, vendor.contact_email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
            <div className="text-stone-700">
              {vendor.quoted_price_eur != null ? (
                <span className="font-medium">
                  {formatMoney(Number(vendor.quoted_price_eur), "EUR")}
                </span>
              ) : (
                <span className="text-xs uppercase tracking-wider text-stone-400">
                  No quote yet
                </span>
              )}
            </div>
            {depositSoon && (
              <span className="flex items-center gap-1.5 text-xs text-amber-700">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                Deposit due soon
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function isDepositDueSoon(
  depositDueAt: string | null,
  depositPaidAt: string | null,
): boolean {
  if (!depositDueAt || depositPaidAt) return false;
  try {
    const days = differenceInCalendarDays(parseISO(depositDueAt), new Date());
    return days <= 30;
  } catch {
    return false;
  }
}
