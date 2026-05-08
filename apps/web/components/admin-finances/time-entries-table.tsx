"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TimeEntryRow } from "@/lib/wave2-types";

export function formatHoursMinutes(min: number | null): string {
  if (min == null || !Number.isFinite(min) || min < 0) return "—";
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function ExtendedTimeEntriesTable({
  entries,
  workspaceById,
  userById,
  showClient = true,
  emptyHint,
}: {
  entries: TimeEntryRow[];
  workspaceById: Map<string, string>;
  userById: Map<string, string>;
  showClient?: boolean;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editBillable, setEditBillable] = useState(true);
  const [editRate, setEditRate] = useState("");

  const startEdit = (e: TimeEntryRow) => {
    setEditId(e.id);
    setEditLabel(e.label ?? "");
    setEditDuration(e.duration_minutes != null ? String(e.duration_minutes) : "");
    setEditBillable(e.billable);
    setEditRate(e.hourly_rate_eur != null ? String(e.hourly_rate_eur) : "");
  };
  const cancelEdit = () => setEditId(null);

  const save = async (id: string, started_at: string) => {
    setPendingId(id);
    try {
      const dur = editDuration ? Number(editDuration) : null;
      const body: Record<string, unknown> = {
        label: editLabel || null,
        billable: editBillable,
        hourly_rate_eur: editRate ? Number(editRate) : null,
      };
      if (dur != null) {
        body.started_at = started_at;
        body.duration_minutes = dur;
      }
      const res = await fetch(`/api/admin/time-entries/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Update failed");
        return;
      }
      toast.success("Time entry updated");
      setEditId(null);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this time entry?")) return;
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/time-entries/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't delete");
        return;
      }
      toast.success("Time entry deleted");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {emptyHint ?? "No time logged yet."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto py-4">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
            <tr>
              {showClient && <th className="px-3 py-2 text-left">Client</th>}
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Started</th>
              <th className="px-3 py-2 text-right">Duration</th>
              <th className="px-3 py-2 text-left">Billable</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const editing = editId === e.id;
              const pending = pendingId === e.id;
              return (
                <tr key={e.id} className="border-t border-stone-100">
                  {showClient && (
                    <td className="px-3 py-2 font-medium">
                      {workspaceById.get(e.workspace_id) ?? "—"}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    {editing ? (
                      <Input
                        value={editLabel}
                        onChange={(ev) => setEditLabel(ev.target.value)}
                        disabled={pending}
                      />
                    ) : (
                      e.label ?? (
                        <span className="text-stone-400">No label</span>
                      )
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {e.user_id
                      ? (userById.get(e.user_id) ?? "—")
                      : (
                        <span className="text-stone-400">—</span>
                      )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {format(parseISO(e.started_at), "MMM d, yyyy · HH:mm")}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {editing ? (
                      <Input
                        inputMode="numeric"
                        value={editDuration}
                        onChange={(ev) =>
                          setEditDuration(
                            ev.target.value.replace(/[^\d]/g, ""),
                          )
                        }
                        className="text-right"
                        disabled={pending}
                        placeholder="minutes"
                      />
                    ) : (
                      formatHoursMinutes(e.duration_minutes)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        type="checkbox"
                        checked={editBillable}
                        onChange={(ev) => setEditBillable(ev.target.checked)}
                        disabled={pending}
                        className="h-4 w-4"
                      />
                    ) : e.billable ? (
                      <Badge variant="success" className="text-[10px]">
                        Billable
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="text-[10px]">
                        Internal
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      {editing ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => save(e.id, e.started_at)}
                            disabled={pending}
                          >
                            {pending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            disabled={pending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(e)}
                            disabled={pending}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(e.id)}
                            disabled={pending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// Backwards-compatible default export name expected by /admin/finances.
export const TimeEntriesTable = ExtendedTimeEntriesTable;
