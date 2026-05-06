"use client";

import { useState } from "react";
import { Loader2, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspacePicker } from "./WorkspacePicker";
import type {
  PushLibraryVenueRequest,
  PushLibraryVenueResponse,
  WorkspaceOption,
} from "@/lib/admin-onboarding-types";

interface Props {
  libraryVenueId: string;
  workspaces: WorkspaceOption[];
  onPushed?: (res: PushLibraryVenueResponse) => void;
}

export function PushVenueButton({
  libraryVenueId,
  workspaces,
  onPushed,
}: Props) {
  const [target, setTarget] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState<PushLibraryVenueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const push = async () => {
    if (!target) return;
    setError(null);
    setDone(null);
    setPushing(true);
    const body: PushLibraryVenueRequest = {
      library_venue_id: libraryVenueId,
      workspace_id: target,
    };
    try {
      const res = await fetch("/api/admin/push/library-venue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Push failed");
        return;
      }
      setDone(data as PushLibraryVenueResponse);
      onPushed?.(data as PushLibraryVenueResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <WorkspacePicker
          workspaces={workspaces}
          selectedId={target}
          onSelect={setTarget}
          placeholder="Push to workspace…"
          disabled={pushing}
        />
        <Button
          type="button"
          size="sm"
          onClick={push}
          disabled={!target || pushing}
        >
          {pushing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoveRight className="h-4 w-4" />
          )}
          Push venue
        </Button>
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </div>
      )}
      {done && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          Pushed — {done.photo_count} photo
          {done.photo_count === 1 ? "" : "s"} copied.
        </div>
      )}
    </div>
  );
}
