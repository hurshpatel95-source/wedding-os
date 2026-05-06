"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LibraryVenueDeleteButton({
  venueId,
  venueName,
}: {
  venueId: string;
  venueName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete "${venueName}" from the library? This also deletes its media. Workspaces that already have a clone of this venue are NOT affected.`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/admin/library/venues/${venueId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Delete failed");
      setBusy(false);
      return;
    }
    router.push("/admin/library/venues");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleDelete}
      disabled={busy}
    >
      <Trash2 className="h-4 w-4" />
      {busy ? "Deleting…" : "Delete venue"}
    </Button>
  );
}
