"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EVENT_ROLES, EVENT_ROLE_LABEL } from "@/lib/event-roles";
import { useIsPlannerServed } from "@/components/workspace/workspace-mode-provider";
import type { Database } from "@wedding-os/db";

type TimelineItem = Database["public"]["Tables"]["timeline_items"]["Row"];
type EventRole = Database["public"]["Enums"]["event_role"];

const fmtTime = (iso: string | null) => {
  if (!iso) return "TBD";
  try {
    return format(parseISO(iso), "p"); // 5:30 PM
  } catch {
    return "TBD";
  }
};

// HTML datetime-local takes "YYYY-MM-DDTHH:mm" — convert from/to ISO
const isoToLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
};
const localInputToIso = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
};

export function TimelineEditor({
  items,
  role,
  workspaceId,
  orgId,
}: {
  items: TimelineItem[];
  role: "admin" | "couple" | null;
  workspaceId: string | null;
  orgId: string | null;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  // T1.5 — Timeline edit is a B2C feature. Self-serve couples build their
  // own day-of run-of-show. Planner-served couples have their planner
  // building the day-of for them, so the editor is read-only with a calm
  // banner pointing them at their planner. Admins (planners viewing a
  // client workspace) always retain full edit regardless of workspace
  // mode.
  const isPlannerServed = useIsPlannerServed();
  const canEdit = isAdmin || !isPlannerServed;
  const showPlannerServedBanner = !isAdmin && isPlannerServed;

  // Composer state
  const [eventRole, setEventRole] = useState<EventRole>("ceremony");
  const [when, setWhen] = useState<string>("");
  const [duration, setDuration] = useState<string>("30");
  const [what, setWhat] = useState<string>("");
  const [who, setWho] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<EventRole, TimelineItem[]>();
    for (const it of items) {
      const list = map.get(it.event_role) ?? [];
      list.push(it);
      map.set(it.event_role, list);
    }
    // Preserve EVENT_ROLES iteration order
    const ordered: { role: EventRole; items: TimelineItem[] }[] = [];
    for (const r of EVENT_ROLES) {
      const list = map.get(r);
      if (list && list.length > 0) ordered.push({ role: r, items: list });
    }
    return ordered;
  }, [items]);

  const handleAdd = async () => {
    if (!what.trim()) {
      setError("Add a title (what) for the timeline item.");
      return;
    }
    if (!workspaceId || !orgId) {
      setError("Workspace not loaded yet.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: insErr } = await supabase.from("timeline_items").insert({
      workspace_id: workspaceId,
      org_id: orgId,
      event_role: eventRole,
      occurs_at: localInputToIso(when),
      duration_minutes: Math.max(0, Number(duration) || 30),
      what: what.trim(),
      who_responsible: who.trim() || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setWhat("");
    setWho("");
    setLocation("");
    setNotes("");
    setWhen("");
    setDuration("30");
    router.refresh();
  };

  const remove = async (item: TimelineItem) => {
    if (!confirm(`Delete "${item.what}"?`)) return;
    const supabase = createClient();
    await supabase.from("timeline_items").delete().eq("id", item.id);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {showPlannerServedBanner && (
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50/70 to-amber-50/40">
          <CardContent className="space-y-1 py-5">
            <p className="font-serif text-xl text-stone-800">
              Your planner is building your day-of timeline.
            </p>
            <p className="max-w-2xl text-sm text-stone-600">
              The run-of-show is shown here as a read-only preview. Reach out
              to your planner with changes — they'll keep this in sync.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {grouped.length === 0 ? (
          <Card className="border-dashed border-stone-300 bg-stone-50/40">
            <CardContent className="space-y-2 py-12 text-center">
              <h3 className="font-serif text-2xl font-light text-stone-900">
                Build your run of show
              </h3>
              <p className="mx-auto max-w-md text-sm text-stone-600">
                Use the composer on the right to add your first item — usually
                the ceremony start time. Each item belongs to an event
                (ceremony, cocktails, reception) so vendors can see just their
                slice.
              </p>
            </CardContent>
          </Card>
        ) : (
          grouped.map(({ role: r, items: list }) => (
            <section key={r} className="space-y-3">
              <h2 className="font-serif text-2xl">{EVENT_ROLE_LABEL[r]}</h2>
              <div className="space-y-2">
                {list.map((it) =>
                  editingId === it.id ? (
                    <EditRow
                      key={it.id}
                      item={it}
                      onCancel={() => setEditingId(null)}
                      onSaved={() => {
                        setEditingId(null);
                        router.refresh();
                      }}
                    />
                  ) : (
                    <Card key={it.id}>
                      <CardContent className="flex items-start gap-4 py-3">
                        <div className="w-24 shrink-0 text-right">
                          <div className="font-serif text-lg leading-tight">
                            {fmtTime(it.occurs_at)}
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                            {it.duration_minutes} min
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-medium">{it.what}</div>
                          <div className="text-sm text-muted-foreground">
                            {[it.who_responsible, it.location].filter(Boolean).join(" · ") ||
                              "—"}
                          </div>
                          {it.notes && (
                            <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                              {it.notes}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Edit item"
                              onClick={() => setEditingId(it.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Delete item"
                              onClick={() => remove(it)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            </section>
          ))
        )}
      </div>

      {canEdit && (
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="font-serif">Add timeline item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-event">Event</Label>
              <Select value={eventRole} onValueChange={(v) => setEventRole(v as EventRole)}>
                <SelectTrigger id="t-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {EVENT_ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-when">Time</Label>
              <Input
                id="t-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-dur">Duration (min)</Label>
              <Input
                id="t-dur"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-what">What</Label>
              <Input
                id="t-what"
                placeholder="Bridal entrance"
                value={what}
                onChange={(e) => setWhat(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-who">Who responsible</Label>
              <Input
                id="t-who"
                placeholder="DJ Krish"
                value={who}
                onChange={(e) => setWho(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-loc">Location</Label>
              <Input
                id="t-loc"
                placeholder="Mandap area"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-notes">Notes</Label>
              <Textarea
                id="t-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleAdd} disabled={submitting || !what.trim()} className="w-full">
              <Plus className="h-4 w-4" />
              {submitting ? "Saving…" : "Add"}
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}

function EditRow({
  item,
  onCancel,
  onSaved,
}: {
  item: TimelineItem;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [eventRole, setEventRole] = useState<EventRole>(item.event_role);
  const [when, setWhen] = useState<string>(isoToLocalInput(item.occurs_at));
  const [duration, setDuration] = useState<string>(String(item.duration_minutes));
  const [what, setWhat] = useState<string>(item.what);
  const [who, setWho] = useState<string>(item.who_responsible ?? "");
  const [location, setLocation] = useState<string>(item.location ?? "");
  const [notes, setNotes] = useState<string>(item.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!what.trim()) {
      setErr("Title required");
      return;
    }
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("timeline_items")
      .update({
        event_role: eventRole,
        occurs_at: localInputToIso(when),
        duration_minutes: Math.max(0, Number(duration) || 30),
        what: what.trim(),
        who_responsible: who.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      })
      .eq("id", item.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved();
  };

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`e-event-${item.id}`}>Event</Label>
            <Select value={eventRole} onValueChange={(v) => setEventRole(v as EventRole)}>
              <SelectTrigger id={`e-event-${item.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {EVENT_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`e-when-${item.id}`}>Time</Label>
            <Input
              id={`e-when-${item.id}`}
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`e-dur-${item.id}`}>Duration (min)</Label>
            <Input
              id={`e-dur-${item.id}`}
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`e-what-${item.id}`}>What</Label>
          <Input
            id={`e-what-${item.id}`}
            value={what}
            onChange={(e) => setWhat(e.target.value)}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`e-who-${item.id}`}>Who responsible</Label>
            <Input
              id={`e-who-${item.id}`}
              value={who}
              onChange={(e) => setWho(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`e-loc-${item.id}`}>Location</Label>
            <Input
              id={`e-loc-${item.id}`}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`e-notes-${item.id}`}>Notes</Label>
          <Textarea
            id={`e-notes-${item.id}`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving || !what.trim()}>
            <Check className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
