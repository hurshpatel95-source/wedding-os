"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Sparkles, Check, Circle, Clock, AlertCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function PlanBoard({ tasks }: { tasks: LiveTask[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | TaskCategory>("all");
  const [owner, setOwner] = useState<"all" | TaskOwner>("all");
  const [hideDone, setHideDone] = useState<boolean>(false);

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
          if (phaseTasks.length === 0) return null;
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
                    <TaskRow key={t.id} task={t} onUpdate={(p) => updateTask(t.id, p)} />
                  ))}
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onUpdate,
}: {
  task: LiveTask;
  onUpdate: (patch: { status?: TaskStatus; notes?: string | null; done_at?: string | null }) => void;
}) {
  const StatusIcon = STATUS_ICON[task.status];
  const isAuto = Boolean(task.auto_derive_kind);
  const isDerivedDone = isAuto && task.derived_done;

  return (
    <div className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]">
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
    </div>
  );
}
