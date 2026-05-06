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
    | "website"
    | "instagram"
    | "planner_rating"
    | "tags"
    | "lead_time_days"
    | "price_band"
  >;
}

const PRICE_BANDS: Array<{ value: string; label: string }> = [
  { value: "unset", label: "Unset" },
  { value: "budget", label: "Budget" },
  { value: "mid", label: "Mid" },
  { value: "premium", label: "Premium" },
  { value: "luxe", label: "Luxe" },
];

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
  const [website, setWebsite] = useState(vendor?.website ?? "");
  const [instagram, setInstagram] = useState(vendor?.instagram ?? "");
  const [rating, setRating] = useState<string>(
    vendor?.planner_rating != null ? String(vendor.planner_rating) : "",
  );
  const [tagsText, setTagsText] = useState((vendor?.tags ?? []).join(", "));
  const [leadTime, setLeadTime] = useState<string>(
    vendor?.lead_time_days != null ? String(vendor.lead_time_days) : "",
  );
  const [priceBand, setPriceBand] = useState<string>(
    vendor?.price_band ?? "unset",
  );

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

    const parsedRating = rating.trim() === "" ? null : Number(rating);
    if (parsedRating != null && (parsedRating < 1 || parsedRating > 5)) {
      setError("Rating must be 1-5");
      setSubmitting(false);
      return;
    }
    const parsedLead = leadTime.trim() === "" ? null : Number(leadTime);

    const tagsArr = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload = {
      name: name.trim(),
      category,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      default_quoted_price_eur: parsedPrice,
      notes: notes.trim() || null,
      website: website.trim() || null,
      instagram: instagram.trim() || null,
      planner_rating: parsedRating,
      tags: tagsArr,
      lead_time_days: parsedLead,
      price_band: priceBand === "unset" ? null : priceBand,
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

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="lvweb">Website</Label>
          <Input
            id="lvweb"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://florist.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lvig">Instagram</Label>
          <Input
            id="lvig"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@florist or full URL"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lvdp">Default price (EUR)</Label>
          <Input
            id="lvdp"
            inputMode="decimal"
            placeholder="0"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Price band</Label>
          <Select value={priceBand} onValueChange={setPriceBand}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_BANDS.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lvlead">Lead time (days)</Label>
          <Input
            id="lvlead"
            inputMode="numeric"
            placeholder="60"
            value={leadTime}
            onChange={(e) => setLeadTime(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="lvrating">My rating (1-5)</Label>
          <Input
            id="lvrating"
            inputMode="numeric"
            placeholder="5"
            value={rating}
            onChange={(e) => setRating(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lvtags">Tags (comma-separated)</Label>
          <Input
            id="lvtags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="indian, fluent english, multi-day"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lvnotes">Internal notes</Label>
        <Textarea
          id="lvnotes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Negotiation history, what worked with past clients, who to ask for…"
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
