"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface WorkspaceOpt {
  id: string;
  name: string;
}

type Mode = "range" | "manual";

function todayLocalDateTime(): string {
  // datetime-local needs YYYY-MM-DDTHH:mm in the user's local zone.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function NewTimeEntryDialog({
  workspaces,
  defaultWorkspaceId,
  triggerLabel = "Log time",
  triggerVariant = "default",
}: {
  workspaces: WorkspaceOpt[];
  defaultWorkspaceId?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string>(
    defaultWorkspaceId ?? workspaces[0]?.id ?? "",
  );
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<Mode>("range");
  const [startedAt, setStartedAt] = useState<string>(todayLocalDateTime());
  const [endedAt, setEndedAt] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [billable, setBillable] = useState<boolean>(true);
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setMode("range");
    setStartedAt(todayLocalDateTime());
    setEndedAt("");
    setDurationMinutes("");
    setBillable(true);
    setHourlyRate("");
    setNotes("");
    setErr(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!workspaceId) {
      setErr("Pick a client.");
      return;
    }
    if (!startedAt) {
      setErr("Started-at is required.");
      return;
    }
    if (mode === "range" && !endedAt) {
      setErr("Ended-at is required (or switch to manual entry).");
      return;
    }
    if (mode === "manual" && !durationMinutes) {
      setErr("Duration in minutes is required.");
      return;
    }
    setSubmitting(true);
    try {
      const startedIso = new Date(startedAt).toISOString();
      const body: Record<string, unknown> = {
        workspace_id: workspaceId,
        started_at: startedIso,
        label: label.trim() || null,
        billable,
        hourly_rate_eur: hourlyRate ? Number(hourlyRate) : null,
        notes: notes.trim() || null,
      };
      if (mode === "range") {
        body.ended_at = new Date(endedAt).toISOString();
      } else {
        body.duration_minutes = Number(durationMinutes);
      }
      const res = await fetch("/api/admin/time-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't save time entry.");
        toast.error(data.error ?? "Couldn't save time entry.");
        return;
      }
      toast.success("Time entry logged");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant}>
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
          <DialogDescription>
            Track hours per client. Mark as billable to roll into per-client
            billable totals.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select
              value={workspaceId}
              onValueChange={setWorkspaceId}
              disabled={submitting || workspaces.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a client" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-label">Label</Label>
            <Input
              id="te-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Vendor research, design call, site visit…"
              disabled={submitting}
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode("range")}
              className={`rounded-full border px-3 py-1 transition ${
                mode === "range"
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-600"
              }`}
              disabled={submitting}
            >
              Start + end
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`rounded-full border px-3 py-1 transition ${
                mode === "manual"
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-600"
              }`}
              disabled={submitting}
            >
              Manual entry (duration)
            </button>
          </div>

          {mode === "range" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="te-start">Started at</Label>
                <Input
                  id="te-start"
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="te-end">Ended at</Label>
                <Input
                  id="te-end"
                  type="datetime-local"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="te-start-m">Started at</Label>
                <Input
                  id="te-start-m"
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="te-dur">Duration (minutes)</Label>
                <Input
                  id="te-dur"
                  inputMode="numeric"
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(e.target.value.replace(/[^\d]/g, ""))
                  }
                  placeholder="60"
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
              <div>
                <div className="text-sm font-medium">Billable</div>
                <div className="text-[11px] text-stone-500">
                  Counts toward per-client billable hours.
                </div>
              </div>
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-rate">Hourly rate € (optional)</Label>
              <Input
                id="te-rate"
                inputMode="decimal"
                value={hourlyRate}
                onChange={(e) =>
                  setHourlyRate(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="120"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-notes">Notes</Label>
            <Textarea
              id="te-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context."
              disabled={submitting}
            />
          </div>

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save time
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
