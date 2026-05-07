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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GUEST_SIDES,
  RSVP_STATUSES,
  SIDE_LABEL,
  RSVP_LABEL,
  type GuestSide,
  type RsvpStatus,
} from "@/lib/guest-types";
import type { Database } from "@wedding-os/db";

type Guest = Database["public"]["Tables"]["guests"]["Row"];

export interface GuestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest?: Pick<
    Guest,
    | "id"
    | "full_name"
    | "email"
    | "phone"
    | "side"
    | "relationship"
    | "address"
    | "city"
    | "region"
    | "postal_code"
    | "country"
    | "dietary"
    | "allergies"
    | "notes"
    | "overall_rsvp"
  > & {
    // post-0025 columns; not yet in generated types
    plus_one_max?: number | null;
  };
  workspaceId?: string;
  orgId?: string;
}

export function GuestFormDialog({
  open,
  onOpenChange,
  guest,
  workspaceId,
  orgId,
}: GuestFormDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(guest?.full_name ?? "");
  const [email, setEmail] = useState(guest?.email ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [side, setSide] = useState<GuestSide | "unset">(guest?.side ?? "unset");
  const [relationship, setRelationship] = useState(guest?.relationship ?? "");
  const [address, setAddress] = useState(guest?.address ?? "");
  const [city, setCity] = useState(guest?.city ?? "");
  const [region, setRegion] = useState(guest?.region ?? "");
  const [postalCode, setPostalCode] = useState(guest?.postal_code ?? "");
  const [country, setCountry] = useState(guest?.country ?? "");
  const [dietary, setDietary] = useState(guest?.dietary ?? "");
  const [allergies, setAllergies] = useState(guest?.allergies ?? "");
  const [notes, setNotes] = useState(guest?.notes ?? "");
  const [rsvp, setRsvp] = useState<RsvpStatus>(guest?.overall_rsvp ?? "pending");
  const [plusOneMax, setPlusOneMax] = useState<number>(
    typeof guest?.plus_one_max === "number" ? guest.plus_one_max : 0,
  );

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const clampedPlusOneMax = Math.max(0, Math.min(5, Math.floor(plusOneMax || 0)));
    // plus_one_max isn't in the generated Guest types yet (added in
    // migration 0025) — cast on insert/update so TS doesn't complain.
    const payload = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      side: side === "unset" ? null : side,
      relationship: relationship.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      region: region.trim() || null,
      postal_code: postalCode.trim() || null,
      country: country.trim() || null,
      dietary: dietary.trim() || null,
      allergies: allergies.trim() || null,
      notes: notes.trim() || null,
      overall_rsvp: rsvp,
      plus_one_max: clampedPlusOneMax,
    };

    if (guest?.id) {
      const { error: upErr } = await supabase
        .from("guests")
        .update(payload as never)
        .eq("id", guest.id);
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
      const { error: insErr } = await supabase
        .from("guests")
        .insert({
          ...payload,
          workspace_id: workspaceId,
          org_id: orgId,
        } as never);
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
          <DialogTitle>{guest ? "Edit guest" : "Add guest"}</DialogTitle>
          <DialogDescription>
            {guest ? "Update guest details and RSVP." : "Add a new guest manually."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="fn">Full name *</Label>
            <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ph">Phone</Label>
              <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Side</Label>
              <Select value={side} onValueChange={(v) => setSide(v as typeof side)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not set</SelectItem>
                  {GUEST_SIDES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SIDE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 col-span-2">
              <Label htmlFor="rel">Relationship</Label>
              <Input
                id="rel"
                placeholder="uncle / college friend / father"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="addr">Address</Label>
            <Input
              id="addr"
              placeholder="123 Main St."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg">State / region</Label>
              <Input id="reg" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pc">Postal</Label>
              <Input
                id="pc"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cn">Country</Label>
              <Input id="cn" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="diet">Dietary</Label>
              <Input
                id="diet"
                placeholder="vegetarian, jain, no alcohol"
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="alg">Allergies</Label>
              <Input
                id="alg"
                placeholder="nuts, shellfish"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>RSVP</Label>
              <Select value={rsvp} onValueChange={(v) => setRsvp(v as RsvpStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RSVP_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RSVP_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="po">Plus-ones allowed</Label>
              <Input
                id="po"
                type="number"
                min={0}
                max={5}
                step={1}
                value={plusOneMax}
                onChange={(e) =>
                  setPlusOneMax(Number.parseInt(e.target.value || "0", 10) || 0)
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Guest can self-add up to this many on their RSVP page.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !fullName.trim()}>
            {submitting ? "Saving…" : guest ? "Save changes" : "Add guest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
