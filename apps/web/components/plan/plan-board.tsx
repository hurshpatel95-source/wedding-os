"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Sparkles, Check, Circle, Clock, AlertCircle, X, Plus, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PHASE_LABEL,
  PHASE_ORDER,
  PHASE_SUBTITLE,
  STATUS_LABEL,
  STATUS_VARIANT,
  CATEGORY_LABEL,
  OWNER_LABEL,
  type TaskStatus,
  type TaskPhase,
  type TaskCategory,
  type TaskOwner,
} from "@/lib/plan-types";
import type { LiveTask } from "@/lib/plan-auto-derive";

const STATUS_OPTIONS: TaskStatus[] = ["not_started", "in_progress", "blocked", "done", "na"];

const STATUS_ICON: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  not_started: Circle,
  in_progress: Clock,
  blocked: AlertCircle,
  done: Check,
  na: X,
};

export function PlanBoard({
  tasks,
  workspaceId,
  orgId,
}: {
  tasks: LiveTask[];
  workspaceId: string | null;
  orgId: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | TaskCategory>("all");
  const [owner, setOwner] = useState<"all" | TaskOwner>("all");
  const [hideDone, setHideDone] = useState<boolean>(false);
  const [addTaskPhase, setAddTaskPhase] = useState<TaskPhase | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (owner !== "all" && t.owner !== owner) return false;
      if (hideDone && t.status === "done") return false;
      if (needle) {
        const blob = `${t.title} ${t.description ?? ""}`.toLowerCase();
        if (!blob.includes(needle)) return false;
      }
      return true;
    });
  }, [tasks, q, category, owner, hideDone]);

  const grouped = useMemo(() => {
    const map = new Map<TaskPhase, LiveTask[]>();
    for (const phase of PHASE_ORDER) map.set(phase, []);
    for (const t of filtered) {
      const arr = map.get(t.phase as TaskPhase);
      if (arr) arr.push(t);
    }
    return map;
  }, [filtered]);

  const updateTask = async (
    taskId: string,
    patch: { status?: TaskStatus; notes?: string | null; done_at?: string | null },
  ) => {
    const supabase = createClient();
    if (patch.status === "done" && !patch.done_at) {
      patch.done_at = new Date().toISOString();
    }
    if (patch.status && patch.status !== "done") {
      patch.done_at = null;
    }
    await supabase.from("planning_tasks").update(patch).eq("id", taskId);
    router.refresh();
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task? This can't be undone.")) return;
    const supabase = createClient();
    await supabase.from("planning_tasks").delete().eq("id", taskId);
    router.refresh();
  };

  const canAddTasks = Boolean(workspaceId && orgId);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 md:grid-cols-5">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            placeholder="outfit, deposit, marriage, mehndi…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Owner</Label>
          <Select value={owner} onValueChange={(v) => setOwner(v as typeof owner)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {(Object.keys(OWNER_LABEL) as TaskOwner[]).map((o) => (
                <SelectItem key={o} value={o}>
                  {OWNER_LABEL[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
          />
          Hide completed
        </label>
      </div>

      {/* Phase sections */}
      <div className="space-y-6">
        {PHASE_ORDER.map((phase) => {
          const phaseTasks = grouped.get(phase) ?? [];
          if (phaseTasks.length === 0 && !canAddTasks) return null;
          const phaseDone = phaseTasks.filter((t) => t.status === "done").length;
          return (
            <section key={phase} className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-light">{PHASE_LABEL[phase]}</h2>
                  <p className="text-xs text-muted-foreground">{PHASE_SUBTITLE[phase]}</p>
                </div>
                <div className="text-xs text-stone-500">
                  {phaseDone} of {phaseTasks.length} done
                </div>
              </div>
              <Card>
                <CardContent className="divide-y divide-stone-100 p-0">
                  {phaseTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onUpdate={(p) => updateTask(t.id, p)}
                      onDelete={t.is_user_added ? () => deleteTask(t.id) : undefined}
                    />
                  ))}
                  {phaseTasks.length === 0 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground">
                      No tasks in this phase yet.
                    </div>
                  )}
                </CardContent>
              </Card>
              {canAddTasks && (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddTaskPhase(phase)}
                    className="text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add custom task
                  </Button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {addTaskPhase && workspaceId && orgId && (
        <AddCustomTaskDialog
          phase={addTaskPhase}
          workspaceId={workspaceId}
          orgId={orgId}
          onClose={() => setAddTaskPhase(null)}
          onSaved={() => {
            setAddTaskPhase(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  onUpdate,
  onDelete,
}: {
  task: LiveTask;
  onUpdate: (patch: { status?: TaskStatus; notes?: string | null; done_at?: string | null }) => void;
  onDelete?: () => void;
}) {
  const StatusIcon = STATUS_ICON[task.status];
  const isAuto = Boolean(task.auto_derive_kind);
  const isDerivedDone = isAuto && task.derived_done;

  return (
    <div className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto]">
      <button
        type="button"
        onClick={() =>
          onUpdate({ status: task.status === "done" ? "not_started" : "done" })
        }
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors",
          task.status === "done"
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-stone-300 bg-white hover:border-stone-500",
        )}
        aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
      >
        {task.status === "done" ? <Check className="h-4 w-4" /> : <StatusIcon className="h-4 w-4 text-stone-400" />}
      </button>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium",
              task.status === "done" && "text-stone-500 line-through",
            )}
          >
            {task.title}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {CATEGORY_LABEL[task.category as TaskCategory]}
          </Badge>
          {task.is_user_added && (
            <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
              <UserPlus className="h-3 w-3" />
              custom
            </Badge>
          )}
          {isDerivedDone && (
            <Badge variant="success" className="flex items-center gap-1 text-[10px]">
              <Sparkles className="h-3 w-3" />
              auto
            </Badge>
          )}
          {task.related_kind && task.related_id && (
            <a
              href={`/${task.related_kind}s/${task.related_id}`}
              className="text-xs text-rose-700 underline"
            >
              open →
            </a>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground">{task.description}</p>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {OWNER_LABEL[task.owner as TaskOwner]}
      </div>

      <div className="text-xs text-muted-foreground">
        {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : "—"}
      </div>

      <Select
        value={task.status}
        onValueChange={(v) => onUpdate({ status: v as TaskStatus })}
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue>
            <div className="flex items-center gap-1.5">
              <Badge variant={STATUS_VARIANT[task.status]} className="text-[10px]">
                {STATUS_LABEL[task.status]}
              </Badge>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          title="Delete custom task"
          className="h-8 w-8"
        >
          <Trash2 className="h-3.5 w-3.5 text-stone-400" />
        </Button>
      ) : (
        <div className="hidden sm:block sm:w-8" aria-hidden />
      )}
    </div>
  );
}

function AddCustomTaskDialog({
  phase,
  workspaceId,
  orgId,
  onClose,
  onSaved,
}: {
  phase: TaskPhase;
  workspaceId: string;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategory>("other");
  const [owner, setOwner] = useState<TaskOwner>("couple");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: insertErr } = await supabase.from("planning_tasks").insert({
      workspace_id: workspaceId,
      org_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      phase,
      category,
      owner,
      due_date: dueDate || null,
      is_user_added: true,
      sort_order: 9999,
    });
    if (insertErr) {
      setError(insertErr.message);
      setSaving(false);
      return;
    }
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-light">
            Add custom task
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Adding to <span className="font-medium">{PHASE_LABEL[phase]}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-title">Title</Label>
            <Input
              id="ct-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Marriage license appointment"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-desc">Description</Label>
            <Textarea
              id="ct-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional notes."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={owner} onValueChange={(v) => setOwner(v as TaskOwner)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OWNER_LABEL) as TaskOwner[]).map((o) => (
                    <SelectItem key={o} value={o}>
                      {OWNER_LABEL[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-due">Due date (optional)</Label>
            <Input
              id="ct-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Add task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
