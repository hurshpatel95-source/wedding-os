"use client";

// Move 5 — Day 2. Two small client trigger components for the events
// page. The page itself is a server component; these wrap the drawer
// state so each card's "Edit" button and each inactive chip's
// "Add" affordance can open the same EventEditDrawer with the right
// initial state.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EventEditDrawer,
  type VenueOption,
} from "@/components/events/event-edit-drawer";
import {
  EVENT_ROLE_LABEL,
  type EventDetailRow,
  type EventRole,
} from "@/lib/event-types";

/**
 * Mounted inside each EventCard. Replaces the Day-1 disabled
 * "Edit" button. Opens a drawer pre-filled with the event's detail row.
 */
export function EditEventButton({
  eventRole,
  existing,
  venues,
}: {
  eventRole: EventRole;
  existing: EventDetailRow | null;
  venues: VenueOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
      <EventEditDrawer
        open={open}
        onClose={() => setOpen(false)}
        eventRole={eventRole}
        existing={existing}
        venues={venues}
      />
    </>
  );
}

/**
 * Used by the "Add another event" affordance. Each chip becomes a
 * button that opens the drawer with `existing=null` so the PATCH path
 * upserts a brand-new event_details row when saved.
 */
export function AddEventChip({
  eventRole,
  venues,
}: {
  eventRole: EventRole;
  venues: VenueOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-stone-300 bg-white text-xs"
      >
        + {EVENT_ROLE_LABEL[eventRole]}
      </Button>
      <EventEditDrawer
        open={open}
        onClose={() => setOpen(false)}
        eventRole={eventRole}
        existing={null}
        venues={venues}
      />
    </>
  );
}
