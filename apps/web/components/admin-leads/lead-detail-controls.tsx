"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LEAD_STATUS_LABEL,
  type LeadStatus,
} from "@/lib/lead-types";

const STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "booked_call",
  "qualified",
  "converted",
  "lost",
];

interface AssignableUser {
  id: string;
  email: string;
}

export function LeadDetailControls({
  leadId,
  currentStatus,
  isConverted,
  email,
  phone,
  coupleNames,
  assignedToUserId,
  teamMembers,
}: {
  leadId: string;
  currentStatus: LeadStatus;
  isConverted: boolean;
  email: string | null;
  phone: string | null;
  coupleNames: string;
  assignedToUserId?: string | null;
  teamMembers?: AssignableUser[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<LeadStatus>(currentStatus);
  const [busy, setBusy] = useState(false);
  const [assignee, setAssignee] = useState<string>(
    assignedToUserId ?? "",
  );
  const [savingAssignee, setSavingAssignee] = useState(false);

  const updateStatus = async (next: LeadStatus) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Could not update");
      setStatus(next);
      toast.success(`Marked ${LEAD_STATUS_LABEL[next].toLowerCase()}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!confirm(`Create a workspace for ${coupleNames}?\n\nThis will provision a couple workspace and send them a magic-link invite if you provide their email.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not convert");
      toast.success("Converted! Workspace created.");
      router.push(`/admin/clients/${j.workspace_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert");
    } finally {
      setBusy(false);
    }
  };

  const updateAssignee = async (next: string) => {
    setSavingAssignee(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assigned_to_user_id: next === "" ? null : next,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not assign");
      setAssignee(next);
      const target = teamMembers?.find((m) => m.id === next);
      const label = target ? target.email.split("@")[0] : "no one";
      toast.success(`Assigned to ${label}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign");
    } finally {
      setSavingAssignee(false);
    }
  };

  return (
    <>
      {teamMembers && teamMembers.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Assigned to
          </div>
          <select
            value={assignee}
            disabled={busy || savingAssignee}
            onChange={(e) => updateAssignee(e.target.value)}
            className="mt-3 w-full rounded-md border border-stone-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.email.split("@")[0]} ({m.email})
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-stone-500">
            The teammate who&rsquo;s the point of contact for this lead.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Status
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || s === status}
              onClick={() => updateStatus(s)}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition disabled:opacity-60 ${
                s === status
                  ? "bg-stone-900 text-white"
                  : "bg-stone-50 text-stone-700 hover:bg-stone-100"
              }`}
            >
              <span>{LEAD_STATUS_LABEL[s]}</span>
              {s === status && <span className="text-xs">·</span>}
            </button>
          ))}
        </div>
      </div>

      {!isConverted && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-900">
            Convert
          </div>
          <p className="mt-2 text-xs text-emerald-900/80">
            Spin up a couple workspace and invite them. The lead row stays
            tied to the new workspace via converted_workspace_id.
          </p>
          <button
            type="button"
            onClick={convert}
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            Convert to client →
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Quick actions
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {email && (
            <a
              href={`mailto:${email}?subject=Re: your wedding`}
              className="rounded-md bg-stone-100 px-3 py-2 text-stone-700 transition hover:bg-stone-200"
            >
              Email {email}
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="rounded-md bg-stone-100 px-3 py-2 text-stone-700 transition hover:bg-stone-200"
            >
              Call {phone}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
