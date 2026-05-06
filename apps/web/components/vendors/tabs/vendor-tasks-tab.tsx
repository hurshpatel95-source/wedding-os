"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VendorTaskRow } from "@/lib/vendor-types";

type VendorClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
    delete: () => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export function VendorTasksTab({
  vendorId,
  userId,
  role,
  initialTasks,
}: {
  vendorId: string;
  userId: string;
  role: "admin" | "couple" | null;
  initialTasks: VendorTaskRow[];
}) {
  const router = useRouter();
  const canEdit = role === "admin" || role === "couple";

  const [label, setLabel] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => sortTasks(initialTasks), [initialTasks]);

  const handleAdd = async () => {
    const text = label.trim();
    if (!text) {
      setError("Add a label first");
      return;
    }
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const sb = supabase as unknown as VendorClient;
    const { error: insErr } = await sb.from("vendor_tasks").insert({
      vendor_id: vendorId,
      label: text,
      due_at: dueAt.trim() || null,
      notes: notes.trim() || null,
      created_by: userId,
      done: false,
    });
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setLabel("");
    setDueAt("");
    setNotes("");
    router.refresh();
  };

  const toggleDone = async (task: VendorTaskRow) => {
    const supabase = createClient();
    const sb = supabase as unknown as VendorClient;
    const next = !task.done;
    await sb
      .from("vendor_tasks")
      .update({
        done: next,
        done_at: next ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    router.refresh();
  };

  const remove = async (task: VendorTaskRow) => {
    if (!confirm("Delete this task?")) return;
    const supabase = createClient();
    const sb = supabase as unknown as VendorClient;
    await sb.from("vendor_tasks").delete().eq("id", task.id);
    router.refresh();
  };

  const today = startOfDay(new Date());

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {sorted.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No tasks yet.
            </CardContent>
          </Card>
        ) : (
          sorted.map((t) => {
            const overdue =
              !t.done && t.due_at && isBefore(parseISO(t.due_at), today);
            return (
              <Card key={t.id} className={cn(t.done && "opacity-60")}>
                <CardContent className="flex items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => canEdit && toggleDone(t)}
                    disabled={!canEdit}
                    className="mt-1 h-4 w-4 cursor-pointer"
                    aria-label={t.done ? "Mark incomplete" : "Mark done"}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium", t.done && "line-through")}>
                        {t.label}
                      </span>
                      {t.due_at && (
                        <Badge variant={overdue ? "destructive" : "muted"}>
                          {overdue ? "Overdue · " : "Due "}
                          {format(parseISO(t.due_at), "PP")}
                        </Badge>
                      )}
                    </div>
                    {t.notes && (
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {t.notes}
                      </p>
                    )}
                    {t.done && t.done_at && (
                      <p className="text-xs text-muted-foreground">
                        Completed {format(parseISO(t.done_at), "PP")}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      onClick={() => remove(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {canEdit && (
        <Card className="h-fit lg:sticky lg:top-6">
          <CardContent className="space-y-3 py-4">
            <h3 className="font-serif text-lg">Add a task</h3>
            <div className="space-y-1.5">
              <Label htmlFor="task-label">Label</Label>
              <Input
                id="task-label"
                placeholder="e.g. Send moodboard"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date (optional)</Label>
              <Input
                id="task-due"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-notes">Notes (optional)</Label>
              <Textarea
                id="task-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="button"
              onClick={handleAdd}
              disabled={submitting || !label.trim()}
              className="w-full"
            >
              {submitting ? "Adding…" : "Add task"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function sortTasks(tasks: VendorTaskRow[]): VendorTaskRow[] {
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const byDueAsc = (a: VendorTaskRow, b: VendorTaskRow): number => {
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at && !b.due_at) return -1;
    if (!a.due_at && b.due_at) return 1;
    return a.created_at.localeCompare(b.created_at);
  };
  return [...open.sort(byDueAsc), ...done.sort(byDueAsc)];
}
