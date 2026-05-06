"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VenueFormDialog } from "@/components/venues/venue-form-dialog";
import type { Database } from "@wedding-os/db";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

export function VenueEditButton({ venue }: { venue: Venue }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      {open && <VenueFormDialog open={open} onOpenChange={setOpen} venue={venue} />}
    </>
  );
}
