// Workspace mode — the architectural fork point between B2C self-serve
// couples and B2B planner-served couples sharing the same /(app)/ shell.
//
// Three user types use the platform today:
//   1. B2B planner admin  → renders in /(admin)/ shell, unaffected by this
//   2. B2B planner-served couple (e.g. Hursh & Nisha managed by Astia)
//      → renders in /(app)/, needs the planner-served variant of dashboards
//   3. B2C self-serve couple (Kyle, John, Rachel, etc.)
//      → renders in /(app)/, needs the consumer-facing variant
//
// Until T1.5 (this work) there was NO fork point — types 2 and 3 saw the
// same components. That produced 4 of 12 regressions on May 8 when worker
// agents shipped B2C dashboard features that nuked the planner-served
// portal. WorkspaceMode is the abstraction that prevents that class of
// regression.
//
// Pages that need to fork import this and switch on the mode value. The
// resolution rule is straightforward: it's a 1:1 mapping from workspace
// skin to mode, since skin already carries the brand-identity signal.

import type { WorkspaceSkin } from "@/lib/workspace-skin";

export type WorkspaceMode =
  | "b2c"
  | "b2c_acquired_style_collab"
  | "b2b_co_branded"
  | "b2b_white_label";

/**
 * Map a workspace's `skin` column value to its rendering mode.
 *
 * Exhaustive switch — every WorkspaceSkin maps to exactly one
 * WorkspaceMode. TypeScript exhaustiveness check will fail compilation
 * if a new skin variant is added without updating this resolver.
 */
export function resolveWorkspaceMode(skin: WorkspaceSkin): WorkspaceMode {
  switch (skin) {
    case "acquired_planner":
      return "b2c";
    case "acquired_style_collab":
      return "b2c_acquired_style_collab";
    case "co_branded":
      return "b2b_co_branded";
    case "white_label":
      return "b2b_white_label";
  }
}

/**
 * Predicate: this workspace is a self-serve B2C couple (or B2C with
 * Acquired Style co-brand). Returns true for both `b2c` variants.
 *
 * Use when you want consumer-facing features: AI vendor sourcing prompts,
 * autopilot, AI-budget-baseline, task-cost-link, image gen, etc.
 */
export function isB2C(mode: WorkspaceMode): boolean {
  return mode === "b2c" || mode === "b2c_acquired_style_collab";
}

/**
 * Predicate: this workspace is a planner-served couple. Returns true for
 * both `b2b_co_branded` and `b2b_white_label`.
 *
 * Use when you want planner-served features: hide autopilot (planner
 * handles outreach), hide AI baseline (planner builds budget), defer to
 * planner for vendor management, etc.
 */
export function isB2B(mode: WorkspaceMode): boolean {
  return mode === "b2b_co_branded" || mode === "b2b_white_label";
}

/**
 * Alias for isB2B for readability — the planner-served use case is the
 * more common reason to fork than the B2B-vs-B2C distinction alone.
 */
export function isPlannerServed(mode: WorkspaceMode): boolean {
  return isB2B(mode);
}

/**
 * Human-readable label for the mode. Useful for admin views, audit logs,
 * debug breadcrumbs. NOT user-facing — the user sees brand labels via
 * the skin system, not mode labels.
 */
export const WORKSPACE_MODE_LABEL: Record<WorkspaceMode, string> = {
  b2c: "Self-serve couple",
  b2c_acquired_style_collab: "Self-serve couple (Acquired Style)",
  b2b_co_branded: "Planner-served couple (co-branded)",
  b2b_white_label: "Planner-served couple (white-label)",
};
