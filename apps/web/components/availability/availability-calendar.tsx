"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STATUS_OPTIONS,
  STATUS_LABEL,
  STATUS_CELL_CLASS,
  STATUS_SWATCH_CLASS,
  type VenueDateStatus,
  type VenueLite,
  type VenueDateMark,
} from "@/lib/availability-types";

const DOW_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

interface CellPos {
  venueId: string;
  date: string; // yyyy-mm-dd
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseMonth(month: string): { y: number; m: number } {
  const [ys, ms] = month.split("-");
  return { y: Number(ys), m: Number(ms) };
}

function formatMonth(y: number, m: number): string {
  return `${y}-${pad2(m)}`;
}

function monthLabel(y: number, m: number): string {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shiftMonth(month: string, delta: number): string {
  const { y, m } = parseMonth(month);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return formatMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dowFor(y: number, m: number, d: number): number {
  // 0=Sun … 6=Sat
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function AvailabilityCalendar({
  venues,
  marks,
  role,
  initialMonth,
}: {
  venues: VenueLite[];
  marks: VenueDateMark[];
  role: "admin" | "couple" | null;
  initialMonth: string;
}) {
  const router = useRouter();
  const [month, setMonth] = useState<string>(initialMonth);
  const [open, setOpen] = useState<boolean>(false);
  const [selected, setSelected] = useState<CellPos | null>(null);
  const [draftStatus, setDraftStatus] = useState<VenueDateStatus>("unknown");
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const isAdmin = true; // Couples + admins both edit (RLS handles workspace scope)

  // Index marks by `${venue_id}|${date}` for O(1) lookup.
  const markIndex = useMemo(() => {
    const map = new Map<string, VenueDateMark>();
    for (const m of marks) map.set(`${m.venue_id}|${m.date}`, m);
    return map;
  }, [marks]);

  const { y, m } = parseMonth(month);
  const numDays = daysInMonth(y, m);
  const days = Array.from({ length: numDays }, (_, i) => i + 1);

  const openCell = (venueId: string, date: string) => {
    const existing = markIndex.get(`${venueId}|${date}`);
    setSelected({ venueId, date });
    setDraftStatus(existing?.status ?? "unknown");
    setDraftNotes(existing?.notes ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const supabase = createClient();
    // Need workspace_id for the upsert — fetch the venue's workspace via a tiny query.
    // (We don't pass workspace_id from the server to keep the prop surface small.)
    const { data: venueRow } = await supabase
      .from("venues")
      .select("workspace_id")
      .eq("id", selected.venueId)
      .maybeSingle();
    const workspaceId = venueRow?.workspace_id;
    if (!workspaceId) {
      setSaving(false);
      return;
    }
    await supabase.from("venue_date_marks").upsert(
      {
        workspace_id: workspaceId,
        venue_id: selected.venueId,
        date: selected.date,
        status: draftStatus,
        notes: draftNotes.trim() === "" ? null : draftNotes,
        source: "manual",
      },
      { onConflict: "venue_id,date" },
    );
    setSaving(false);
    setOpen(false);
    router.refresh();
  };

  const handleClear = async () => {
    if (!selected) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("venue_date_marks")
      .delete()
      .eq("venue_id", selected.venueId)
      .eq("date", selected.date);
    setSaving(false);
    setOpen(false);
    router.refresh();
  };

  const selectedVenue = venues.find((v) => v.id === selected?.venueId);

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          title="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="font-serif text-2xl">{monthLabel(y, m)}</div>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          title="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/60">
              <th className="sticky left-0 z-10 bg-stone-50/60 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500">
                Venue
              </th>
              {days.map((d) => {
                const dow = dowFor(y, m, d);
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <th
                    key={d}
                    className={cn(
                      "px-1 py-1 text-center font-normal",
                      isWeekend ? "text-rose-700" : "text-stone-500",
                    )}
                  >
                    <div className="text-[11px] font-medium leading-tight">{d}</div>
                    <div className="text-[9px] uppercase tracking-wider opacity-70">
                      {DOW_INITIALS[dow]}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id} className="border-b border-stone-100 last:border-b-0">
                <td
                  className={cn(
                    "sticky left-0 z-10 min-w-[180px] max-w-[220px] border-r border-stone-200 px-3 py-2 align-middle",
                    v.is_lead_pick ? "bg-rose-50" : "bg-white",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {v.is_lead_pick && (
                      <Heart className="h-3 w-3 shrink-0 fill-rose-500 text-rose-500" />
                    )}
                    <span className="truncate text-sm font-medium text-stone-900">
                      {v.name}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {v.status}
                    </Badge>
                  </div>
                </td>
                {days.map((d) => {
                  const date = `${month}-${pad2(d)}`;
                  const key = `${v.id}|${date}`;
                  const mark = markIndex.get(key);
                  const status: VenueDateStatus = mark?.status ?? "unknown";
                  const cellClass = STATUS_CELL_CLASS[status];
                  const tooltip = mark
                    ? `${STATUS_LABEL[status]}${mark.notes ? ` · ${mark.notes}` : ""}`
                    : STATUS_LABEL.unknown;
                  return (
                    <td key={d} className="p-0.5">
                      <button
                        type="button"
                        title={tooltip}
                        disabled={!isAdmin}
                        onClick={() => isAdmin && openCell(v.id, date)}
                        className={cn(
                          "block h-7 w-full rounded-sm text-[10px] transition-colors",
                          cellClass,
                          !isAdmin && "cursor-default",
                          isAdmin && "cursor-pointer",
                        )}
                      >
                        <span className="sr-only">
                          {v.name} · {date} · {STATUS_LABEL[status]}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 text-xs">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Legend
        </span>
        {STATUS_OPTIONS.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn("inline-block h-3 w-3 rounded-sm", STATUS_SWATCH_CLASS[s])} />
            <span className="text-stone-700">{STATUS_LABEL[s]}</span>
          </div>
        ))}
        {!isAdmin && (
          <span className="ml-auto text-[11px] italic text-muted-foreground">
            Read-only — admin can edit cells
          </span>
        )}
      </div>

      {/* Edit dialog (admin) */}
      {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedVenue?.name ?? "Venue"} · {selected?.date ?? ""}
              </DialogTitle>
              <DialogDescription>
                Set how this venue is positioned on this date.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={draftStatus}
                  onValueChange={(v) => setDraftStatus(v as VenueDateStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="e.g. Sant Esteve area only, 250pax cap"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={saving}
                className="text-stone-500 hover:text-rose-700"
              >
                Clear
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
