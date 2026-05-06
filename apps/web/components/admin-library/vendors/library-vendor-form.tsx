"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VENDOR_CATEGORY_GROUP,
  VENDOR_CATEGORY_LABEL,
  VENDOR_GROUP_ORDER,
} from "@/lib/vendor-categories";
import type { VendorCategory } from "@/lib/vendor-types";
import type { LibraryVendorRow } from "@/lib/library-vendor-types";

export interface LibraryVendorFormProps {
  mode: "create" | "edit";
  vendor?: Pick<
    LibraryVendorRow,
    | "id"
    | "name"
    | "category"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "default_quoted_price_eur"
    | "notes"
  >;
}

const groupedCategories = VENDOR_GROUP_ORDER.map((group) => ({
  group,
  cats: (Object.keys(VENDOR_CATEGORY_GROUP) as VendorCategory[])
    .filter((c) => VENDOR_CATEGORY_GROUP[c] === group)
    .sort((a, b) => VENDOR_CATEGORY_LABEL[a].localeCompare(VENDOR_CATEGORY_LABEL[b])),
})).filter((g) => g.cats.length > 0);

export function LibraryVendorForm({ mode, vendor }: LibraryVendorFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(vendor?.name ?? "");
  const [category, setCategory] = useState<VendorCategory>(
    vendor?.category ?? "florist",
  );
  const [contactName, setContactName] = useState(vendor?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(vendor?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(vendor?.contact_phone ?? "");
  const [defaultPrice, setDefaultPrice] = useState(
    vendor?.default_quoted_price_eur != null
      ? String(vendor.default_quoted_price_eur)
      : "",
  );
  const [notes, setNotes] = useState(vendor?.notes ?? "");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);

    const parsedPrice = defaultPrice.trim() === "" ? null : Number(defaultPrice);
    if (parsedPrice != null && Number.isNaN(parsedPrice)) {
      setError("Default quoted price must be a number");
      setSubmitting(false);
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      default_quoted_price_eur: parsedPrice,
      notes: notes.trim() || null,
    };

    const url =
      mode === "create"
        ? "/api/admin/library/vendors"
        : `/api/admin/library/vendors/${vendor!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Failed to save vendor");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push("/admin/library/vendors");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!vendor?.id) return;
    if (!confirm(`Delete ${vendor.name}? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/library/vendors/${vendor.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Failed to delete vendor");
      setDeleting(false);
      return;
    }
    setDeleting(false);
    router.push("/admin/library/vendors");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-1.5">
        <Label htmlFor="lvname">Name *</Label>
        <Input
          id="lvname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Category *</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as VendorCategory)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupedCategories.map(({ group, cats }) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {cats.map((c) => (
                  <SelectItem key={c} value={c}>
                    {VENDOR_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lvcn">Contact name</Label>
          <Input
            id="lvcn"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lvce">Contact email</Label>
          <Input
            id="lvce"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lvcp">Contact phone</Label>
          <Input
            id="lvcp"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5 md:max-w-xs">
        <Label htmlFor="lvdp">Default quoted price (EUR)</Label>
        <Input
          id="lvdp"
          inputMode="decimal"
          placeholder="0"
          value={defaultPrice}
          onChange={(e) => setDefaultPrice(e.target.value.replace(/[^\d.]/g, ""))}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lvnotes">Notes</Label>
        <Textarea
          id="lvnotes"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-6">
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting || deleting || !name.trim()}>
            {submitting
              ? "Saving…"
              : mode === "create"
                ? "Add to library"
                : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/library/vendors")}
            disabled={submitting || deleting}
          >
            Cancel
          </Button>
        </div>
        {mode === "edit" && (
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={submitting || deleting}
            className="text-destructive hover:text-destructive"
          >
            {deleting ? "Deleting…" : "Delete vendor"}
          </Button>
        )}
      </div>
    </form>
  );
}
