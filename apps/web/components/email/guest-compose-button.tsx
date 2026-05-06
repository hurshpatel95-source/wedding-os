"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComposeDialog } from "@/components/email/compose-dialog";
import type { EmailKind } from "@/lib/email-templates";

export function GuestComposeButton({
  defaultFilter,
  defaultKind,
  variant = "outline",
  label = "Compose with AI",
}: {
  defaultFilter?: { side?: "groom" | "bride" | "both"; rsvp?: "pending" | "yes" | "no" | "maybe" };
  defaultKind?: EmailKind;
  variant?: "default" | "outline" | "ghost";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const desc = describeFilter(defaultFilter);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" />
        {label}
      </Button>
      {open && (
        <ComposeDialog
          open={open}
          onOpenChange={setOpen}
          guestFilter={defaultFilter}
          defaultKind={defaultKind}
          contextLabel={desc}
        />
      )}
    </>
  );
}

function describeFilter(
  f?: { side?: string; rsvp?: string },
): string | undefined {
  if (!f) return undefined;
  const parts: string[] = [];
  if (f.side) parts.push(`side=${f.side}`);
  if (f.rsvp) parts.push(`RSVP=${f.rsvp}`);
  return parts.length ? `guests where ${parts.join(", ")}` : undefined;
}
