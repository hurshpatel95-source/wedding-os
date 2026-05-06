"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  VENDOR_STATUSES,
  VENDOR_STATUS_LABEL,
} from "@/lib/vendor-categories";
import type {
  VendorCategory,
  VendorRow,
  VendorStatus,
} from "@/lib/vendor-types";

export interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Pick<
    VendorRow,
    | "id"
    | "name"
    | "category"
    | "status"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "website"
    | "instagram"
    | "quoted_price_eur"
    | "deposit_amount_eur"
    | "deposit_due_at"
    | "notes"
    | "include_in_pricing"
    | "is_couple_visible"
  >;
  workspaceId?: string;
  orgId?: string;
}

export function VendorFormDialog({
  open,
  onOpenChange,
  vendor,
  workspaceId,
  orgId,
}: VendorFormDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(vendor?.name ?? "");
  const [category, setCategory] = useState<VendorCategory>(vendor?.category ?? "florist");
  const [status, setStatus] = useState<VendorStatus>(vendor?.status ?? "researching");
  const [contactName, setContactName] = useState(vendor?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(vendor?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(vendor?.contact_phone ?? "");
  const [website, setWebsite] = useState(vendor?.website ?? "");
  const [instagram, setInstagram] = useState(vendor?.instagram ?? "");
  const [quotedPrice, setQuotedPrice] = useState(
    vendor?.quoted_price_eur != null ? String(vendor.quoted_price_eur) : "",
  );
  const [depositAmount, setDepositAmount] = useState(
    vendor?.deposit_amount_eur != null ? String(vendor.deposit_amount_eur) : "",
  );
  const [depositDueAt, setDepositDueAt] = useState(vendor?.deposit_due_at ?? "");
  const [notes, setNotes] = useState(vendor?.notes ?? "");
  const [includeInPricing, setIncludeInPricing] = useState<boolean>(
    vendor?.include_in_pricing ?? true,
  );
  const [isCoupleVisible, setIsCoupleVisible] = useState<boolean>(
    vendor?.is_couple_visible ?? true,
  );

  // Build grouped category options
  const groupedCategories = VENDOR_GROUP_ORDER.map((group) => ({
    group,
    cats: (Object.keys(VENDOR_CATEGORY_GROUP) as VendorCategory[])
      .filter((c) => VENDOR_CATEGORY_GROUP[c] === group)
      .sort((a, b) => VENDOR_CATEGORY_LABEL[a].localeCompare(VENDOR_CATEGORY_LABEL[b])),
  })).filter((g) => g.cats.length > 0);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const parsedQuoted = quotedPrice.trim() === "" ? null : Number(quotedPrice);
    const parsedDeposit = depositAmount.trim() === "" ? null : Number(depositAmount);
    if (parsedQuoted != null && Number.isNaN(parsedQuoted)) {
      setError("Quoted price must be a number");
      setSubmitting(false);
      return;
    }
    if (parsedDeposit != null && Number.isNaN(parsedDeposit)) {
      setError("Deposit amount must be a number");
      setSubmitting(false);
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      status,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      website: website.trim() || null,
      instagram: instagram.trim() || null,
      quoted_price_eur: parsedQuoted,
      quoted_currency: "EUR",
      deposit_amount_eur: parsedDeposit,
      deposit_due_at: depositDueAt.trim() || null,
      notes: notes.trim() || null,
      include_in_pricing: includeInPricing,
      is_couple_visible: isCoupleVisible,
    };

    // `vendors` is not yet in the generated Database types; cast to bypass the typed builder.
    const sb = supabase as unknown as {
      from: (table: string) => {
        update: (values: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
        insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };

    if (vendor?.id) {
      const { error: upErr } = await sb.from("vendors").update(payload).eq("id", vendor.id);
      if (upErr) {
        setError(upErr.message);
        setSubmitting(false);
        return;
      }
    } else {
      if (!workspaceId || !orgId) {
        setError("Missing workspace context");
        setSubmitting(false);
        return;
      }
      const { error: insErr } = await sb
        .from("vendors")
        .insert({ ...payload, workspace_id: workspaceId, org_id: orgId });
      if (insErr) {
        setError(insErr.message);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
          <DialogDescription>
            {vendor ? "Update vendor details." : "Add a new vendor for the wedding."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="vname">Name *</Label>
            <Input id="vname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
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
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VendorStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {VENDOR_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vcn">Contact name</Label>
              <Input
                id="vcn"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vce">Contact email</Label>
              <Input
                id="vce"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vcp">Contact phone</Label>
              <Input
                id="vcp"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vweb">Website</Label>
              <Input
                id="vweb"
                placeholder="https://"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vig">Instagram</Label>
              <Input
                id="vig"
                placeholder="@handle"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vqp">Quoted price (EUR)</Label>
              <Input
                id="vqp"
                inputMode="decimal"
                placeholder="0"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vda">Deposit amount (EUR)</Label>
              <Input
                id="vda"
                inputMode="decimal"
                placeholder="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vdd">Deposit due date</Label>
              <Input
                id="vdd"
                type="date"
                value={depositDueAt}
                onChange={(e) => setDepositDueAt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vnotes">Notes</Label>
            <Textarea
              id="vnotes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card p-3 text-sm">
              <input
                type="checkbox"
                checked={includeInPricing}
                onChange={(e) => setIncludeInPricing(e.target.checked)}
              />
              Include in pricing roll-up
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card p-3 text-sm">
              <input
                type="checkbox"
                checked={isCoupleVisible}
                onChange={(e) => setIsCoupleVisible(e.target.checked)}
              />
              Visible to couple
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? "Saving…" : vendor ? "Save changes" : "Add vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
