"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorFormDialog } from "@/components/vendors/vendor-form-dialog";
import type { VendorRow } from "@/lib/vendor-types";

export function VendorEditButton({ vendor }: { vendor: VendorRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit vendor
      </Button>
      {open && <VendorFormDialog open={open} onOpenChange={setOpen} vendor={vendor} />}
    </>
  );
}
