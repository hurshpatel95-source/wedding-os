"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComposeDialog } from "@/components/email/compose-dialog";
import type { EmailKind } from "@/lib/email-templates";

export function VendorComposeButton({
  vendorId,
  vendorName,
  vendorEmail,
  defaultKind,
  variant = "outline",
}: {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string | null;
  defaultKind?: EmailKind;
  variant?: "default" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" />
        Compose with AI
      </Button>
      {open && (
        <ComposeDialog
          open={open}
          onOpenChange={setOpen}
          vendorId={vendorId}
          toEmail={vendorEmail ?? null}
          defaultKind={defaultKind}
          contextLabel={vendorName}
        />
      )}
    </>
  );
}
