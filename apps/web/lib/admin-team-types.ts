// Shared types for the planner-team management surface.
//
// `team_role` is the planner-team hierarchy axis ('owner' | 'planner' |
// 'assistant'). It only matters when `org_role = 'org_admin'`. The owner
// can invite + remove team members and change roles; planner/assistant are
// informational for now (gates can be tightened later).

import type { TeamRole } from "@/lib/wave2-types";

export interface TeamMemberRow {
  id: string;
  email: string;
  org_id: string;
  org_role: "org_admin" | "member";
  team_role: TeamRole | null;
  workspace_id: string | null;
  created_at: string;
}

export interface InviteTeammateRequest {
  email: string;
  name?: string | null;
  team_role: Exclude<TeamRole, "owner">;
}

export interface InviteTeammateResponse {
  user_id: string | null;
  magic_link: string | null;
  warnings: string[];
}

export interface UpdateTeamMemberRequest {
  team_role: TeamRole;
}
