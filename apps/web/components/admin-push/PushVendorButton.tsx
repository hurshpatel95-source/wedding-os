"use client";

import { useState } from "react";
import { Loader2, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspacePicker } from "./WorkspacePicker";
import type {
  PushLibraryVendorRequest,
  PushLibraryVendorResponse,
  WorkspaceOption,
} from "@/lib/admin-onboarding-types";

interface Props {
  libraryVendorId: string;
  workspaces: WorkspaceOption[];
  onPushed?: (res: PushLibraryVendorResponse) => void;
}

export function PushVendorButton({
  libraryVendorId,
  workspaces,
  onPushed,
}: Props) {
  const [target, setTarget] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState<PushLibraryVendorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const push = async () => {
    if (!target) return;
    setError(null);
    setDone(null);
    setPushing(true);
    const body: PushLibraryVendorRequest = {
      library_vendor_id: libraryVendorId,
      workspace_id: target,
    };
    try {
      const res = await fetch("/api/admin/push/library-vendor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Push failed");
        return;
      }
      setDone(data as PushLibraryVendorResponse);
      onPushed?.(data as PushLibraryVendorResponse);
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
          Push vendor
        </Button>
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </div>
      )}
      {done && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          Pushed.
        </div>
      )}
    </div>
  );
}
