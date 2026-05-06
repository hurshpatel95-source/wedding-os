"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_ROLES, EVENT_ROLE_LABEL } from "@/lib/event-roles";
import type { LibraryVenueFormPayload } from "@/lib/library-venue-types";
import type { Database } from "@wedding-os/db";

type EventRole = Database["public"]["Enums"]["event_role"];

export interface LibraryVenueFormProps {
  mode: "create" | "edit";
  venueId?: string;
  initial?: Partial<LibraryVenueFormPayload>;
  onSaved?: (id: string) => void;
}

export function LibraryVenueForm({
  mode,
  venueId,
  initial,
  onSaved,
}: LibraryVenueFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState(
    initial?.lat != null ? String(initial.lat) : "",
  );
  const [lng, setLng] = useState(
    initial?.lng != null ? String(initial.lng) : "",
  );
  const [capSeated, setCapSeated] = useState(
    initial?.capacity_seated != null ? String(initial.capacity_seated) : "",
  );
  const [capStanding, setCapStanding] = useState(
    initial?.capacity_standing != null ? String(initial.capacity_standing) : "",
  );
  const [hireFee, setHireFee] = useState(
    initial?.hire_fee_eur != null ? String(initial.hire_fee_eur) : "",
  );
  const [hireFeeNotes, setHireFeeNotes] = useState(
    initial?.hire_fee_notes ?? "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [internalNotes, setInternalNotes] = useState(
    initial?.internal_notes ?? "",
  );
  const [eventRoles, setEventRoles] = useState<EventRole[]>(
    (initial?.event_roles as EventRole[]) ?? [],
  );
  const [prosText, setProsText] = useState((initial?.pros ?? []).join("\n"));
  const [consText, setConsText] = useState((initial?.cons ?? []).join("\n"));

  // AI brochure intake state
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeMsg, setIntakeMsg] = useState<string | null>(null);

  const toggleRole = (r: EventRole) => {
    setEventRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const handleIntakeFile = async (file: File) => {
    setIntakeBusy(true);
    setIntakeMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/library/venues/intake", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as
        | {
            extraction: {
              name: string | null;
              city: string | null;
              region: string | null;
              country: string | null;
              capacity_seated: number | null;
              capacity_standing: number | null;
              hire_fee_eur: number | null;
              hire_fee_notes: string | null;
              description: string | null;
              event_roles: EventRole[];
              confidence: number;
              notes: string | null;
            };
            warning?: string;
          }
        | { error: string };
      if (!res.ok) {
        setIntakeMsg(
          "error" in json
            ? json.error
            : "Brochure intake failed.",
        );
        return;
      }
      if ("extraction" in json) {
        const x = json.extraction;
        if (x.name && !name) setName(x.name);
        if (x.city && !city) setCity(x.city);
        if (x.region && !region) setRegion(x.region);
        if (x.country && !country) setCountry(x.country);
        if (x.capacity_seated != null && !capSeated)
          setCapSeated(String(x.capacity_seated));
        if (x.capacity_standing != null && !capStanding)
          setCapStanding(String(x.capacity_standing));
        if (x.hire_fee_eur != null && !hireFee)
          setHireFee(String(x.hire_fee_eur));
        if (x.hire_fee_notes && !hireFeeNotes) setHireFeeNotes(x.hire_fee_notes);
        if (x.description && !description) setDescription(x.description);
        if (x.event_roles && x.event_roles.length > 0 && eventRoles.length === 0)
          setEventRoles(x.event_roles);
        setIntakeMsg(
          `Extracted with confidence ${(x.confidence * 100).toFixed(0)}%. Review and save.`,
        );
      }
    } catch (e) {
      setIntakeMsg(`Intake error: ${(e as Error).message}`);
    } finally {
      setIntakeBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload: LibraryVenueFormPayload = {
      name: name.trim(),
      city: city.trim() || null,
      region: region.trim() || null,
      country: country.trim() || null,
      address: address.trim() || null,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      capacity_seated: capSeated ? Number(capSeated) : null,
      capacity_standing: capStanding ? Number(capStanding) : null,
      hire_fee_eur: hireFee ? Number(hireFee) : null,
      hire_fee_notes: hireFeeNotes.trim() || null,
      description: description.trim() || null,
      internal_notes: internalNotes.trim() || null,
      event_roles: eventRoles,
      pros: prosText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      cons: consText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    };

    const url =
      mode === "create"
        ? "/api/admin/library/venues"
        : `/api/admin/library/venues/${venueId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `${method} failed (${res.status})`);
      setSubmitting(false);
      return;
    }

    const j = (await res.json()) as { id?: string };
    setSubmitting(false);
    if (mode === "create" && j.id) {
      onSaved?.(j.id);
      router.push(`/admin/library/venues/${j.id}`);
    } else {
      onSaved?.(venueId!);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* AI brochure intake */}
      <div className="rounded-lg border border-stone-200 bg-stone-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-stone-500" />
            <div>
              <h3 className="text-sm font-medium">Auto-fill from brochure</h3>
              <p className="text-xs text-stone-500">
                Drop a venue PDF or screenshot — Claude pre-fills the form.
              </p>
            </div>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              disabled={intakeBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleIntakeFile(f);
                e.target.value = "";
              }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
              {intakeBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Pick brochure
                </>
              )}
            </span>
          </label>
        </div>
        {intakeMsg && (
          <p className="mt-3 text-xs text-stone-500">{intakeMsg}</p>
        )}
      </div>

      {/* Basic identity */}
      <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
        <h3 className="font-serif text-base">Identity</h3>
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mas de Sant Llei"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Carrer del…"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Catalonia"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Spain"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value.replace(/[^\d.\-]/g, ""))}
              placeholder="41.6217"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value.replace(/[^\d.\-]/g, ""))}
              placeholder="2.7654"
            />
          </div>
        </div>
      </div>

      {/* Capacity + hire fee */}
      <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
        <h3 className="font-serif text-base">Capacity &amp; hire fee</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Seated capacity</Label>
            <Input
              inputMode="numeric"
              value={capSeated}
              onChange={(e) =>
                setCapSeated(e.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="200"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Standing capacity</Label>
            <Input
              inputMode="numeric"
              value={capStanding}
              onChange={(e) =>
                setCapStanding(e.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="350"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Hire fee (€)</Label>
          <Input
            inputMode="decimal"
            value={hireFee}
            onChange={(e) =>
              setHireFee(e.target.value.replace(/[^\d.]/g, ""))
            }
            placeholder="14000"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Hire fee notes</Label>
          <Textarea
            rows={2}
            value={hireFeeNotes}
            onChange={(e) => setHireFeeNotes(e.target.value)}
            placeholder="Sat €14k / Fri €12.4k. Min 220 pax Sun, shortfall €80/pax."
          />
        </div>
      </div>

      {/* Event roles */}
      <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-5">
        <h3 className="font-serif text-base">Event roles</h3>
        <p className="text-xs text-stone-500">
          Which event types this venue can host.
        </p>
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

      {/* Description + pros/cons */}
      <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
        <h3 className="font-serif text-base">Description &amp; notes</h3>
        <div className="grid gap-1.5">
          <Label>Description</Label>
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this venue is, who it's for. Couples will see this."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Pros (one per line)</Label>
            <Textarea
              rows={5}
              value={prosText}
              onChange={(e) => setProsText(e.target.value)}
              placeholder={"Stunning sunset views\nFlexible layout"}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Cons (one per line)</Label>
            <Textarea
              rows={5}
              value={consText}
              onChange={(e) => setConsText(e.target.value)}
              placeholder={"No on-site parking\nStrict noise curfew"}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Internal notes (planner-only)</Label>
          <Textarea
            rows={3}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Private — won't be shown to couples."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
          {submitting
            ? "Saving…"
            : mode === "create"
              ? "Create venue"
              : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
