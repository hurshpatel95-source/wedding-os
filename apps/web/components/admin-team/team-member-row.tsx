"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TEAM_ROLE_LABEL, type TeamRole } from "@/lib/wave2-types";

interface TeamMemberRowProps {
  userId: string;
  email: string;
  teamRole: TeamRole | null;
  joinedAt: string;
  isSelf: boolean;
  /** True when there's only one owner left in the org. Locks the owner row. */
  isOnlyOwner: boolean;
  /** True if the current viewer is the studio owner (read-only otherwise). */
  viewerIsOwner: boolean;
}

export function TeamMemberRow({
  userId,
  email,
  teamRole,
  joinedAt,
  isSelf,
  isOnlyOwner,
  viewerIsOwner,
}: TeamMemberRowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"role" | "remove" | null>(null);
  const [role, setRole] = useState<TeamRole>(teamRole ?? "planner");

  const isOwner = teamRole === "owner";
  // Owner can't be reassigned away to planner/assistant via this UI for now
  // (would also need a hand-off step). The select is locked when target=owner.
  const lockRole = !viewerIsOwner || isSelf || isOwner;
  const lockRemove = !viewerIsOwner || isSelf || (isOwner && isOnlyOwner);

  const displayName = email.split("@")[0] || email;

  const onChangeRole = async (next: TeamRole) => {
    if (next === role) return;
    setBusy("role");
    try {
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ team_role: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not update role");
      setRole(next);
      toast.success(`Role updated to ${TEAM_ROLE_LABEL[next].toLowerCase()}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update role");
      // Reset to previous
      setRole(teamRole ?? "planner");
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async () => {
    if (
      !confirm(
        `Remove ${displayName} from the planner team?\n\nThey will lose access to the studio dashboard, but their auth account stays so you can re-invite them later.`,
      )
    ) {
      return;
    }
    setBusy("remove");
    try {
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not remove");
      toast.success(`${displayName} removed from the team`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setBusy(null);
    }
  };

  return (
    <tr className="hover:bg-stone-50/60">
      <td className="px-4 py-3">
        <div className="font-medium capitalize text-stone-900">
          {displayName}
          {isSelf && (
            <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stone-500">
              You
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-stone-600">{email}</td>
      <td className="px-4 py-3">
        {lockRole ? (
          <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700">
            {teamRole ? TEAM_ROLE_LABEL[teamRole] : "—"}
          </span>
        ) : (
          <select
            value={role}
            disabled={busy !== null}
            onChange={(e) => onChangeRole(e.target.value as TeamRole)}
            className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="planner">Planner</option>
            <option value="assistant">Assistant</option>
          </select>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-stone-500">
        {formatJoined(joinedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        {lockRemove ? (
          <span className="text-[10px] uppercase tracking-wider text-stone-400">
            {isOwner ? "Owner" : isSelf ? "—" : ""}
          </span>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
          >
            {busy === "remove" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

function formatJoined(iso: string): string {
  try {
    const dt = new Date(iso);
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
