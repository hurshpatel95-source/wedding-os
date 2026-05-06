"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ANCHOR_KINDS,
  ANCHOR_LABEL,
  PLAYBOOK_CATEGORY_OPTIONS,
  PLAYBOOK_OWNER_OPTIONS,
  type AnchorKind,
  type PlaybookPhase,
  type PlaybookTask,
} from "@/lib/playbook-types";

interface WorkspaceOption {
  id: string;
  name: string;
}

export function PlaybookEditor({
  orgId,
  phases,
  tasks,
  workspaces,
}: {
  orgId: string | null;
  phases: PlaybookPhase[];
  tasks: PlaybookTask[];
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [phaseDialog, setPhaseDialog] = useState<{
    mode: "new" | "edit";
    phase?: PlaybookPhase;
  } | null>(null);
  const [taskDialog, setTaskDialog] = useState<{
    mode: "new" | "edit";
    phaseId: string;
    task?: PlaybookTask;
  } | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const tasksByPhase = new Map<string, PlaybookTask[]>();
  for (const t of tasks) {
    const arr = tasksByPhase.get(t.playbook_phase_id) ?? [];
    arr.push(t);
    tasksByPhase.set(t.playbook_phase_id, arr);
  }

  const movePhase = (phase: PlaybookPhase, direction: -1 | 1) => {
    const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((p) => p.id === phase.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx]!;
    const b = sorted[swapIdx]!;
    startTransition(async () => {
      await Promise.all([
        fetch(`/api/admin/playbook/phases/${a.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: b.sort_order }),
        }),
        fetch(`/api/admin/playbook/phases/${b.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: a.sort_order }),
        }),
      ]);
      router.refresh();
    });
  };

  const deletePhase = (phase: PlaybookPhase) => {
    if (!confirm(`Delete phase "${phase.label}" and all its tasks?`)) return;
    startTransition(async () => {
      await fetch(`/api/admin/playbook/phases/${phase.id}`, { method: "DELETE" });
      router.refresh();
    });
  };

  const deleteTask = (task: PlaybookTask) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    startTransition(async () => {
      await fetch(`/api/admin/playbook/tasks/${task.id}`, { method: "DELETE" });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setPhaseDialog({ mode: "new" })}
          >
            <Plus className="h-4 w-4" /> Add phase
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={busy || phases.length === 0 || workspaces.length === 0}
            onClick={() => setApplyOpen(true)}
          >
            <Send className="h-4 w-4" /> Apply to workspace
          </Button>
        </div>
      </div>

      {phases.map((phase) => {
        const phaseTasks = tasksByPhase.get(phase.id) ?? [];
        return (
          <Card key={phase.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-2xl font-light leading-tight">
                      {phase.label}
                    </h2>
                    {phase.anchor_kind && phase.anchor_value_int != null && (
                      <Badge variant="secondary" className="text-[10px]">
                        {phase.anchor_value_int}{" "}
                        {ANCHOR_LABEL[phase.anchor_kind as AnchorKind] ?? phase.anchor_kind}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {phaseTasks.length} task{phaseTasks.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Move up"
                    disabled={busy}
                    onClick={() => movePhase(phase, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Move down"
                    disabled={busy}
                    onClick={() => movePhase(phase, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Edit phase"
                    disabled={busy}
                    onClick={() => setPhaseDialog({ mode: "edit", phase })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete phase"
                    disabled={busy}
                    onClick={() => deletePhase(phase)}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-100 bg-white">
                {phaseTasks.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-muted-foreground">
                    No tasks yet.
                  </div>
                ) : (
                  phaseTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium">{t.title}</span>
                          {t.category && (
                            <Badge variant="secondary" className="text-[10px]">
                              {t.category}
                            </Badge>
                          )}
                          {t.owner_default && (
                            <Badge variant="secondary" className="text-[10px]">
                              {t.owner_default}
                            </Badge>
                          )}
                          {t.auto_derive_kind && (
                            <Badge variant="secondary" className="text-[10px]">
                              auto: {t.auto_derive_kind}
                            </Badge>
                          )}
                        </div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground">
                            {t.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit task"
                          disabled={busy}
                          onClick={() =>
                            setTaskDialog({
                              mode: "edit",
                              phaseId: phase.id,
                              task: t,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete task"
                          disabled={busy}
                          onClick={() => deleteTask(t)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setTaskDialog({ mode: "new", phaseId: phase.id })}
                >
                  <Plus className="h-4 w-4" /> Add task
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {phaseDialog && (
        <PhaseDialog
          orgId={orgId}
          mode={phaseDialog.mode}
          phase={phaseDialog.phase}
          onClose={() => setPhaseDialog(null)}
          onSaved={() => {
            setPhaseDialog(null);
            router.refresh();
          }}
        />
      )}

      {taskDialog && (
        <TaskDialog
          mode={taskDialog.mode}
          phaseId={taskDialog.phaseId}
          task={taskDialog.task}
          onClose={() => setTaskDialog(null)}
          onSaved={() => {
            setTaskDialog(null);
            router.refresh();
          }}
        />
      )}

      {applyOpen && (
        <ApplyDialog
          workspaces={workspaces}
          onClose={() => setApplyOpen(false)}
          onApplied={() => {
            setApplyOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PhaseDialog({
  orgId,
  mode,
  phase,
  onClose,
  onSaved,
}: {
  orgId: string | null;
  mode: "new" | "edit";
  phase?: PlaybookPhase;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(phase?.label ?? "");
  const [anchorKind, setAnchorKind] = useState<string>(
    phase?.anchor_kind ?? "months_before_wedding",
  );
  const [anchorValue, setAnchorValue] = useState<string>(
    phase?.anchor_value_int != null ? String(phase.anchor_value_int) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        label: label.trim(),
        anchor_kind: anchorKind || null,
        anchor_value_int: anchorValue === "" ? null : Number(anchorValue),
        ...(mode === "new" && orgId ? { org_id: orgId } : {}),
      };
      if (!body.label) {
        setError("Label is required");
        setSaving(false);
        return;
      }
      const res = await fetch(
        mode === "new"
          ? "/api/admin/playbook/phases"
          : `/api/admin/playbook/phases/${phase!.id}`,
        {
          method: mode === "new" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-light">
            {mode === "new" ? "Add phase" : "Edit phase"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 9–12 months out"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Anchor</Label>
              <Select value={anchorKind} onValueChange={setAnchorKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANCHOR_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ANCHOR_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="anchor_value">Value</Label>
              <Input
                id="anchor_value"
                type="number"
                value={anchorValue}
                onChange={(e) => setAnchorValue(e.target.value)}
                placeholder="e.g. 9"
              />
            </div>
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({
  mode,
  phaseId,
  task,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  phaseId: string;
  task?: PlaybookTask;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [ownerDefault, setOwnerDefault] = useState(task?.owner_default ?? "couple");
  const [category, setCategory] = useState(task?.category ?? "other");
  const [autoDeriveKind, setAutoDeriveKind] = useState(task?.auto_derive_kind ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        owner_default: ownerDefault || null,
        category: category || null,
        auto_derive_kind: autoDeriveKind.trim() || null,
        ...(mode === "new" ? { playbook_phase_id: phaseId } : {}),
      };
      if (!body.title) {
        setError("Title is required");
        setSaving(false);
        return;
      }
      const res = await fetch(
        mode === "new"
          ? "/api/admin/playbook/tasks"
          : `/api/admin/playbook/tasks/${task!.id}`,
        {
          method: mode === "new" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-light">
            {mode === "new" ? "Add task" : "Edit task"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Book photographer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional. Why this matters, what to look for, etc."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={ownerDefault} onValueChange={setOwnerDefault}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYBOOK_OWNER_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYBOOK_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto">Auto-derive kind</Label>
            <Input
              id="auto"
              value={autoDeriveKind}
              onChange={(e) => setAutoDeriveKind(e.target.value)}
              placeholder="e.g. vendor_booked:photographer (optional)"
            />
            <p className="text-[11px] text-muted-foreground">
              When set, the task auto-completes from live workspace data. See
              lib/plan-auto-derive.ts for supported kinds.
            </p>
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyDialog({
  workspaces,
  onClose,
  onApplied,
}: {
  workspaces: WorkspaceOption[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [replace, setReplace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleApply = async () => {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/playbook/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, replace }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        inserted?: number;
        skipped?: number;
      };
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      setResult(
        `Applied — ${j.inserted ?? 0} task${j.inserted === 1 ? "" : "s"} added${
          j.skipped ? `, ${j.skipped} skipped (duplicates)` : ""
        }.`,
      );
      setSaving(false);
      onApplied();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-light">
            Apply playbook to workspace
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Workspace</Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a workspace…" />
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
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>
              Replace existing playbook tasks{" "}
              <span className="text-muted-foreground">
                (deletes rows where phase_id is set + is_user_added=false; keeps
                user-added + legacy tasks)
              </span>
            </span>
          </label>
          {error && <div className="text-xs text-rose-600">{error}</div>}
          {result && <div className="text-xs text-emerald-700">{result}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={saving || !workspaceId}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
