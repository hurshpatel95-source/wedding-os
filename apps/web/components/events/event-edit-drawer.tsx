"use client";

// Move 5 — Day 2. EventEditDrawer.
//
// Shape lifted from components/plan/task-edit-drawer.tsx so the UI feels
// consistent with the rest of the app (right-hand sheet over a dim
// backdrop, header + scrollable body + footer with save/cancel).
//
// One drawer handles both edit and add-event flows:
//   - Edit: pass an `existing` detail row. PATCH updates it.
//   - Add:  pass `existing={null}`. PATCH with `is_active=true` upserts.
//
// Save POSTs `/api/events/[role]` via PATCH. On success we call
// `router.refresh()` so the parent server component re-reads from the
// DB and the card grid reflects the new state.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVENT_ROLE_LABEL,
  type EventDetailRow,
  type EventRole,
} from "@/lib/event-types";

export interface VenueOption {
  id: string;
  name: string;
}

// Convert a stored ISO timestamp to the value an <input type="datetime-local">
// expects (YYYY-MM-DDTHH:mm in the user's local TZ).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

// Convert the local-input string back to an ISO timestamp (or null
// for empty). The browser parses YYYY-MM-DDTHH:mm in the local TZ,
// then .toISOString() normalizes to UTC.
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function EventEditDrawer({
  open,
  onClose,
  eventRole,
  existing,
  venues,
}: {
  open: boolean;
  onClose: () => void;
  eventRole: EventRole;
  existing: EventDetailRow | null;
  venues: VenueOption[];
}) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState<string>(
    existing?.display_name ?? "",
  );
  const [startAt, setStartAt] = useState<string>(
    isoToLocalInput(existing?.start_at ?? null),
  );
  const [endAt, setEndAt] = useState<string>(
    isoToLocalInput(existing?.end_at ?? null),
  );
  const [venueId, setVenueId] = useState<string>(existing?.venue_id ?? "none");
  const [description, setDescription] = useState<string>(
    existing?.description ?? "",
  );
  const [isActive, setIsActive] = useState<boolean>(existing?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  // When the drawer re-opens for a different event, reset state to the
  // new row's values.
  useEffect(() => {
    setDisplayName(existing?.display_name ?? "");
    setStartAt(isoToLocalInput(existing?.start_at ?? null));
    setEndAt(isoToLocalInput(existing?.end_at ?? null));
    setVenueId(existing?.venue_id ?? "none");
    setDescription(existing?.description ?? "");
    setIsActive(existing?.is_active ?? true);
  }, [existing, eventRole, open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        display_name: displayName.trim() || null,
        start_at: localInputToIso(startAt),
        end_at: localInputToIso(endAt),
        venue_id: venueId === "none" ? null : venueId,
        description: description.trim() || null,
        is_active: isActive,
      };
      const res = await fetch(`/api/events/${eventRole}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "Couldn't save the event.");
        return;
      }
      toast.success("Event saved.");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!existing) {
      // Not yet persisted — just close.
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventRole}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "Couldn't remove the event.");
        return;
      }
      toast.success("Event removed.");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const eyebrow = existing ? "Edit event" : "Add event";
  const title = displayName.trim() || EVENT_ROLE_LABEL[eventRole];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              {eyebrow}
            </div>
            <h2 className="mt-1 font-serif text-xl font-light tracking-tight">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 px-6 py-5">
          <Field
            label="Display name"
            hint={`Optional — defaults to "${EVENT_ROLE_LABEL[eventRole]}"`}
          >
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={EVENT_ROLE_LABEL[eventRole]}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Starts at">
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Ends at" hint="Optional">
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Venue" hint="Optional — pick from your shortlist">
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="No venue yet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No venue yet</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Description" hint="Optional — short markdown">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="A few notes for this event…"
              className="w-full resize-y rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </Field>

          <label className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-rose-700 focus:ring-rose-500"
            />
            <span className="flex-1 text-sm">
              <span className="block font-medium text-stone-800">Active</span>
              <span className="block text-xs text-stone-500">
                Inactive events stay hidden from filters and the card grid.
              </span>
            </span>
          </label>
        </div>

        <footer className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {existing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDeactivate}
              disabled={saving}
              className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            >
              Remove event
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {label}
        </span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
