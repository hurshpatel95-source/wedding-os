"use client";

// Client-side React context for WorkspaceMode. Server components in
// /(app)/ pages can resolve mode directly from their own workspace
// fetch + lib/workspace-mode.ts, but client components need a context
// to read mode without prop-drilling through every nav, button, and
// widget.
//
// Wired in apps/web/app/(app)/layout.tsx — layout resolves mode once
// per request and wraps children in this provider.

import { createContext, useContext } from "react";
import type { WorkspaceMode } from "@/lib/workspace-mode";
import { isB2B, isB2C, isPlannerServed } from "@/lib/workspace-mode";

const WorkspaceModeContext = createContext<WorkspaceMode>("b2c");

export function WorkspaceModeProvider({
  mode,
  children,
}: {
  mode: WorkspaceMode;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceModeContext.Provider value={mode}>
      {children}
    </WorkspaceModeContext.Provider>
  );
}

/** Returns the current workspace's mode. Defaults to "b2c" if no
 *  provider is mounted (e.g. /(admin)/ routes that don't wrap this). */
export function useWorkspaceMode(): WorkspaceMode {
  return useContext(WorkspaceModeContext);
}

/** Convenience: returns true if the current workspace is B2C self-serve. */
export function useIsB2C(): boolean {
  return isB2C(useWorkspaceMode());
}

/** Convenience: returns true if the current workspace is B2B planner-served. */
export function useIsB2B(): boolean {
  return isB2B(useWorkspaceMode());
}

/** Convenience: alias for useIsB2B — clearer at call sites that ask
 *  "is this couple planner-served?" rather than "is this B2B?". */
export function useIsPlannerServed(): boolean {
  return isPlannerServed(useWorkspaceMode());
}
