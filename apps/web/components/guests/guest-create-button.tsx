"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GuestFormDialog } from "@/components/guests/guest-form-dialog";

export function GuestCreateButton() {
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
        <Plus className="h-4 w-4" /> Add guest
      </Button>
      {open && workspaceId && orgId && (
        <GuestFormDialog open onOpenChange={setOpen} workspaceId={workspaceId} orgId={orgId} />
      )}
    </>
  );
}
