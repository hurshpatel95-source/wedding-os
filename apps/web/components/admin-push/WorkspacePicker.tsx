"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceOption } from "@/lib/admin-onboarding-types";

interface Props {
  workspaces: WorkspaceOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Tiny dropdown — same visual style as the AdminNav's "View as workspace"
// picker. Built without an external dropdown library so it stays self-contained
// inside the admin-push folder.
export function WorkspacePicker({
  workspaces,
  selectedId,
  onSelect,
  placeholder = "Pick workspace…",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = workspaces.find((w) => w.id === selectedId) ?? null;

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        disabled={disabled || workspaces.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="max-w-[14rem] truncate">
          {selected?.name ??
            (workspaces.length === 0 ? "No workspaces" : placeholder)}
        </span>
        <ChevronDown className="h-3 w-3 text-stone-400" />
      </button>
      {open && workspaces.length > 0 && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(w.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full px-4 py-2 text-left text-sm transition hover:bg-stone-50",
                    w.id === selectedId
                      ? "bg-stone-50 font-medium text-stone-900"
                      : "text-stone-700",
                  )}
                >
                  {w.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
