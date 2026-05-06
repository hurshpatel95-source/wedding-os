"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("any");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [layout, setLayout] = useState<Layout>("group");

  // Bulk selection state — admin only
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return vendors.filter((v) => {
      if (needle) {
        // Couples search by name only; admins also search contact/notes (CRM data).
        const hay = isAdmin
          ? `${v.name} ${v.contact_name ?? ""} ${v.contact_email ?? ""} ${v.notes ?? ""}`.toLowerCase()
          : v.name.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (category !== "any" && v.category !== category) return false;
      if (status !== "all" && v.status !== status) return false;
      return true;
    });
  }, [vendors, q, category, status, isAdmin]);

  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map((v) => v.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const bulkSetStatus = async (newStatus: VendorStatus) => {
    if (selected.size === 0) return;
    if (!confirm(`Set ${selected.size} vendor${selected.size === 1 ? "" : "s"} to "${VENDOR_STATUS_LABEL[newStatus]}"?`)) return;
    setBulkBusy(true);
    const supabase = createClient() as unknown as {
      from: (t: string) => {
        update: (patch: Record<string, unknown>) => {
          in: (col: string, vals: string[]) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
    const { error } = await supabase
      .from("vendors")
      .update({ status: newStatus })
      .in("id", Array.from(selected));
    setBulkBusy(false);
    if (error) {
      alert(`Bulk update failed: ${error.message}`);
      return;
    }
    setSelected(new Set());
    router.refresh();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Delete ${selected.size} vendor${selected.size === 1 ? "" : "s"}? This is irreversible.`,
      )
    )
      return;
    setBulkBusy(true);
    const supabase = createClient() as unknown as {
      from: (t: string) => {
        delete: () => {
          in: (col: string, vals: string[]) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
    const { error } = await supabase
      .from("vendors")
      .delete()
      .in("id", Array.from(selected));
    setBulkBusy(false);
    if (error) {
      alert(`Bulk delete failed: ${error.message}`);
      return;
    }
    setSelected(new Set());
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="vq">Search</Label>
          <Input
            id="vq"
            placeholder={isAdmin ? "Name, contact, or notes" : "Vendor name"}
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

      {/* Bulk action bar — admin only */}
      {isAdmin && selected.size > 0 && (
        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-stone-300 bg-white p-3 shadow-md">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900"
          >
            <X className="h-3 w-3" /> Clear
          </button>
          <button
            type="button"
            onClick={selectAllFiltered}
            className="text-xs text-stone-600 hover:text-stone-900"
          >
            Select all {filtered.length} filtered
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Select
              value="set"
              onValueChange={(v) => {
                if (v !== "set") bulkSetStatus(v as VendorStatus);
              }}
              disabled={bulkBusy}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Set status…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="set" disabled>
                  Set status to…
                </SelectItem>
                {VENDOR_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {VENDOR_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={bulkDelete}
              disabled={bulkBusy}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

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
              <VendorCard
                key={v.id}
                vendor={v}
                isAdmin={isAdmin}
                isSelected={selected.has(v.id)}
                onToggleSelected={() => toggleOne(v.id)}
              />
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
                      <VendorCard
                        key={v.id}
                        vendor={v}
                        isAdmin={isAdmin}
                        isSelected={selected.has(v.id)}
                        onToggleSelected={() => toggleOne(v.id)}
                      />
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

function VendorCard({
  vendor,
  isAdmin,
  isSelected,
  onToggleSelected,
}: {
  vendor: VendorListItem;
  isAdmin: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
}) {
  const Icon = VENDOR_CATEGORY_ICON[vendor.category];
  const depositSoon = isDepositDueSoon(vendor.deposit_due_at, vendor.deposit_paid_at);

  return (
    <Link href={`/vendors/${vendor.id}`} className="group relative block">
      {isAdmin && (
        <button
          type="button"
          aria-label={isSelected ? "Deselect vendor" : "Select vendor"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelected();
          }}
          className={`absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${
            isSelected
              ? "border-stone-900 bg-stone-900 text-white"
              : "border-stone-300 bg-white/80 hover:border-stone-500"
          }`}
        >
          {isSelected ? "✓" : ""}
        </button>
      )}
      <Card
        className={`h-full overflow-hidden border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md ${
          isSelected ? "ring-2 ring-stone-900 ring-offset-2" : ""
        }`}
      >
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <Badge
              variant="secondary"
              className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${
                isAdmin ? "ml-7" : ""
              }`}
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
            {/* Contact info is CRM data — admin only. */}
            {isAdmin && (vendor.contact_name || vendor.contact_email) && (
              <p className="mt-1 line-clamp-1 text-sm text-stone-500">
                {[vendor.contact_name, vendor.contact_email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {/* Pricing + deposit alerts are CRM. Couples just see name + status. */}
          {isAdmin && (
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
          )}
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
