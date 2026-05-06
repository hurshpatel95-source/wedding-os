"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { VenueFormDialog } from "@/components/venues/venue-form-dialog";

export function VenueCreateButton() {
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("org_id, workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setOrgId(data.org_id);
        setWorkspaceId(data.workspace_id);
      }
    });
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add venue
      </Button>
      {open && workspaceId && orgId && (
        <VenueFormDialog
          open={open}
          onOpenChange={setOpen}
          workspaceId={workspaceId}
          orgId={orgId}
        />
      )}
    </>
  );
}
