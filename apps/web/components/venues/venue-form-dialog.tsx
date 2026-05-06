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
import { STATUS_LABEL, VENUE_STATUSES } from "@/lib/venue-status";
import { EVENT_ROLES, EVENT_ROLE_LABEL } from "@/lib/event-roles";
import type { Database } from "@wedding-os/db";

type Venue = Database["public"]["Tables"]["venues"]["Row"];
type VenueStatus = Database["public"]["Enums"]["venue_status"];
type IndoorOutdoor = Database["public"]["Enums"]["indoor_outdoor"];
type EventRole = Database["public"]["Enums"]["event_role"];

export interface VenueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue?: Pick<
    Venue,
    | "id"
    | "name"
    | "address"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "capacity_min"
    | "capacity_max"
    | "indoor_outdoor"
    | "in_house_catering"
    | "has_accommodation"
    | "planner_notes"
    | "status"
    | "event_roles"
    | "hire_fee_weekend_eur"
    | "hire_fee_weekday_eur"
    | "hire_fee_sunday_eur"
    | "minimum_pax_weekend"
    | "minimum_pax_sunday"
    | "shortfall_per_pax_eur"
    | "spaces"
    | "hire_fee_notes"
    | "pros"
    | "cons"
  >;
  workspaceId?: string;
  orgId?: string;
}

export function VenueFormDialog({
  open,
  onOpenChange,
  venue,
  workspaceId,
  orgId,
}: VenueFormDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [contactName, setContactName] = useState(venue?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(venue?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(venue?.contact_phone ?? "");
  const [capMin, setCapMin] = useState(venue?.capacity_min?.toString() ?? "");
  const [capMax, setCapMax] = useState(venue?.capacity_max?.toString() ?? "");
  const [io, setIO] = useState<IndoorOutdoor | "unset">(venue?.indoor_outdoor ?? "unset");
  const [catering, setCatering] = useState<boolean>(venue?.in_house_catering ?? false);
  const [accom, setAccom] = useState<boolean>(venue?.has_accommodation ?? false);
  const [notes, setNotes] = useState(venue?.planner_notes ?? "");
  const [status, setStatus] = useState<VenueStatus>(venue?.status ?? "shortlisted");
  const [eventRoles, setEventRoles] = useState<EventRole[]>(venue?.event_roles ?? []);

  const toggleRole = (r: EventRole) => {
    setEventRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  // Hire-fee fields
  const [hireWeekend, setHireWeekend] = useState<string>(
    venue?.hire_fee_weekend_eur?.toString() ?? "",
  );
  const [hireWeekday, setHireWeekday] = useState<string>(
    venue?.hire_fee_weekday_eur?.toString() ?? "",
  );
  const [hireSunday, setHireSunday] = useState<string>(
    venue?.hire_fee_sunday_eur?.toString() ?? "",
  );
  const [minWeekend, setMinWeekend] = useState<string>(
    venue?.minimum_pax_weekend?.toString() ?? "",
  );
  const [minSunday, setMinSunday] = useState<string>(
    venue?.minimum_pax_sunday?.toString() ?? "",
  );
  const [shortfall, setShortfall] = useState<string>(
    venue?.shortfall_per_pax_eur?.toString() ?? "",
  );
  const [spaces, setSpaces] = useState<{ label: string; price_eur: number }[]>(
    venue?.spaces ?? [],
  );
  const [hireFeeNotes, setHireFeeNotes] = useState<string>(venue?.hire_fee_notes ?? "");

  // Pros & cons — stored as text[] arrays, edited as one-per-line text
  const [prosText, setProsText] = useState<string>((venue?.pros ?? []).join("\n"));
  const [consText, setConsText] = useState<string>((venue?.cons ?? []).join("\n"));

  const updateSpace = (i: number, patch: Partial<{ label: string; price_eur: number }>) => {
    setSpaces((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const addSpace = () => setSpaces((prev) => [...prev, { label: "", price_eur: 0 }]);
  const removeSpace = (i: number) =>
    setSpaces((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      capacity_min: capMin ? Number(capMin) : null,
      capacity_max: capMax ? Number(capMax) : null,
      indoor_outdoor: io === "unset" ? null : io,
      in_house_catering: catering,
      has_accommodation: accom,
      planner_notes: notes.trim() || null,
      status,
      event_roles: eventRoles,
      hire_fee_weekend_eur: hireWeekend ? Number(hireWeekend) : null,
      hire_fee_weekday_eur: hireWeekday ? Number(hireWeekday) : null,
      hire_fee_sunday_eur: hireSunday ? Number(hireSunday) : null,
      minimum_pax_weekend: minWeekend ? Number(minWeekend) : null,
      minimum_pax_sunday: minSunday ? Number(minSunday) : null,
      shortfall_per_pax_eur: shortfall ? Number(shortfall) : null,
      spaces: spaces.filter((s) => s.label.trim().length > 0),
      hire_fee_notes: hireFeeNotes.trim() || null,
      pros: prosText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      cons: consText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    };

    if (venue?.id) {
      const { error: upErr } = await supabase.from("venues").update(payload).eq("id", venue.id);
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
        .from("venues")
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
          <DialogTitle>{venue ? "Edit venue" : "Add venue"}</DialogTitle>
          <DialogDescription>
            {venue ? "Update venue details." : "Add a new venue to the shortlist."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="capMin">Min capacity</Label>
              <Input
                id="capMin"
                inputMode="numeric"
                value={capMin}
                onChange={(e) => setCapMin(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="capMax">Max capacity</Label>
              <Input
                id="capMax"
                inputMode="numeric"
                value={capMax}
                onChange={(e) => setCapMax(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Indoor/Outdoor</Label>
              <Select value={io} onValueChange={(v) => setIO(v as typeof io)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not set</SelectItem>
                  <SelectItem value="indoor">Indoor</SelectItem>
                  <SelectItem value="outdoor">Outdoor</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VenueStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card p-3 text-sm">
              <input
                type="checkbox"
                checked={catering}
                onChange={(e) => setCatering(e.target.checked)}
              />
              In-house catering
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card p-3 text-sm">
              <input
                type="checkbox"
                checked={accom}
                onChange={(e) => setAccom(e.target.checked)}
              />
              On-site accommodation
            </label>
          </div>

          <div className="space-y-2">
            <Label>Event roles this venue can host</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EVENT_ROLES.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-2 rounded-md border bg-card p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={eventRoles.includes(r)}
                    onChange={() => toggleRole(r)}
                  />
                  {EVENT_ROLE_LABEL[r]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cn">Contact name</Label>
              <Input id="cn" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ce">Contact email</Label>
              <Input
                id="ce"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cp">Contact phone</Label>
              <Input id="cp" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Planner notes</Label>
            <Textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Pros & cons */}
          <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/40 p-4">
            <div>
              <h3 className="font-serif text-base">Pros &amp; cons</h3>
              <p className="text-xs text-stone-500">
                Quick gut-check bullets shown in the venue overview sidebar.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pros">Pros (one per line)</Label>
                <Textarea
                  id="pros"
                  rows={5}
                  placeholder={"Stunning sunset views\nFlexible layout"}
                  value={prosText}
                  onChange={(e) => setProsText(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cons">Cons (one per line)</Label>
                <Textarea
                  id="cons"
                  rows={5}
                  placeholder={"No on-site parking\nStrict noise curfew"}
                  value={consText}
                  onChange={(e) => setConsText(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Hire fees — drives the pricing engine */}
          <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base">Hire fees & minimums</h3>
                <p className="text-xs text-stone-500">
                  Drives every scenario's hire-fee total. Edit and the pricing page recalculates.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Weekend (Sat) €</Label>
                <Input
                  inputMode="decimal"
                  placeholder="14000"
                  value={hireWeekend}
                  onChange={(e) =>
                    setHireWeekend(e.target.value.replace(/[^\d.]/g, ""))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Sunday €</Label>
                <Input
                  inputMode="decimal"
                  placeholder="19000"
                  value={hireSunday}
                  onChange={(e) =>
                    setHireSunday(e.target.value.replace(/[^\d.]/g, ""))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Weekday €</Label>
                <Input
                  inputMode="decimal"
                  placeholder="12400"
                  value={hireWeekday}
                  onChange={(e) =>
                    setHireWeekday(e.target.value.replace(/[^\d.]/g, ""))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Min pax — Sat</Label>
                <Input
                  inputMode="numeric"
                  placeholder="280"
                  value={minWeekend}
                  onChange={(e) => setMinWeekend(e.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Min pax — Sun</Label>
                <Input
                  inputMode="numeric"
                  placeholder="220"
                  value={minSunday}
                  onChange={(e) => setMinSunday(e.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Shortfall €/pax</Label>
                <Input
                  inputMode="decimal"
                  placeholder="80"
                  value={shortfall}
                  onChange={(e) => setShortfall(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Spaces (composite-priced venues)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSpace}>
                  + Add space
                </Button>
              </div>
              {spaces.length === 0 ? (
                <p className="text-xs text-stone-500">
                  Use spaces for venues like Mas de Sant Llei where each area has its own price.
                  Sum of selected spaces overrides the flat hire fee.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {spaces.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        placeholder="Space label (e.g. Orange courtyard)"
                        value={s.label}
                        onChange={(e) => updateSpace(i, { label: e.target.value })}
                      />
                      <Input
                        className="w-32"
                        inputMode="decimal"
                        placeholder="2000"
                        value={s.price_eur}
                        onChange={(e) =>
                          updateSpace(i, {
                            price_eur: Number(e.target.value.replace(/[^\d.]/g, "") || 0),
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSpace(i)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>Hire fee notes</Label>
              <Textarea
                rows={2}
                placeholder="e.g. 'Sat €14k / Fri €12.4k' or 'Friday rate not quoted'"
                value={hireFeeNotes}
                onChange={(e) => setHireFeeNotes(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? "Saving…" : venue ? "Save changes" : "Add venue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
