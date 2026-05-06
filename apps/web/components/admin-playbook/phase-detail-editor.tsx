"use client";

// Detail editor for a single phase. Re-uses the same Phase + Task dialogs
// from the playbook editor by importing them, so the schema-coupling lives
// in one place. The list page is the primary editor; this drill-in page is
// for power-users who want a focused view of one phase.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ANCHOR_LABEL,
  type AnchorKind,
  type PlaybookPhase,
  type PlaybookTask,
} from "@/lib/playbook-types";
import { PlaybookEditor } from "./playbook-editor";

export function PhaseDetailEditor({
  phase,
  tasks,
}: {
  phase: PlaybookPhase;
  tasks: PlaybookTask[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const deleteTask = (task: PlaybookTask) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    startTransition(async () => {
      await fetch(`/api/admin/playbook/tasks/${task.id}`, { method: "DELETE" });
      router.refresh();
    });
  };

  // The PlaybookEditor component handles all dialogs and state-mgmt; we just
  // pass it a single-phase view so adding/editing here works the same way.
  // For the simple summary section we render a lightweight inline list.
  const [showFullEditor, setShowFullEditor] = useState(false);

  if (showFullEditor) {
    return (
      <PlaybookEditor
        orgId={phase.org_id}
        phases={[phase]}
        tasks={tasks}
        workspaces={[]}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-stone-500">
                Anchor
              </div>
              {phase.anchor_kind && phase.anchor_value_int != null ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{phase.anchor_value_int}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {ANCHOR_LABEL[phase.anchor_kind as AnchorKind] ??
                      phase.anchor_kind}
                  </Badge>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No anchor set</div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFullEditor(true)}>
              <Pencil className="h-4 w-4" /> Open editor
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No tasks in this phase yet.{" "}
              <button
                type="button"
                className="text-rose-700 underline"
                onClick={() => setShowFullEditor(true)}
              >
                Add one
              </button>
              .
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete task"
                    onClick={() => deleteTask(t)}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Button onClick={() => setShowFullEditor(true)}>
        <Plus className="h-4 w-4" /> Add task
      </Button>
    </div>
  );
}
