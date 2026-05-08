"use client";

import { useState } from "react";
import { X, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencySymbol } from "@/lib/utils";

// Monday.com-style per-task drawer. Edit any field on the task — phase,
// due date, status, owner, category, title, notes — and save. Also tie
// the task to a budget line: type an estimated cost, optionally link to
// an existing line, and the API auto-creates a leaf line if needed.

const PHASE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "pre_12_months", label: "12+ months out" },
  { value: "months_9_12", label: "9–12 months out" },
  { value: "months_6_9", label: "6–9 months out" },
  { value: "months_3_6", label: "3–6 months out" },
  { value: "months_1_3", label: "1–3 months out" },
  { value: "final_month", label: "Final month" },
  { value: "final_week", label: "Final week" },
  { value: "day_of", label: "Day of" },
  { value: "post_wedding", label: "After the wedding" },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "na", label: "N/A" },
];

const OWNER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "couple", label: "Both of us" },
  { value: "bride", label: "Partner A / Bride" },
  { value: "groom", label: "Partner B / Groom" },
  { value: "planner", label: "Planner" },
  { value: "family", label: "Family" },
  { value: "vendor", label: "Vendor" },
];

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "venue", label: "Venue" },
  { value: "vendor", label: "Vendor" },
  { value: "attire", label: "Attire" },
  { value: "paperwork", label: "Paperwork" },
  { value: "guest", label: "Guest list" },
  { value: "logistics", label: "Logistics" },
  { value: "design", label: "Design" },
  { value: "ritual", label: "Ritual" },
  { value: "finance", label: "Finance" },
  { value: "honeymoon", label: "Honeymoon" },
  { value: "other", label: "Other" },
];

export interface TaskEditDrawerTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  phase: string;
  category: string;
  owner: string;
  due_date: string | null;
  notes?: string | null;
  estimated_cost?: number | null;
  budget_line_id?: string | null;
}

export interface BudgetLineOption {
  id: string;
  category: string;
  label: string;
  parent_label: string | null;
  /** Helps the dropdown sort: parents first, then leaves under each. */
  is_parent: boolean;
}

export function TaskEditDrawer({
  task,
  open,
  onClose,
  onSave,
  onDelete,
  budgetLineOptions = [],
  baseCurrency = "USD",
}: {
  task: TaskEditDrawerTask;
  open: boolean;
  onClose: () => void;
  onSave: (patch: {
    title?: string;
    description?: string | null;
    status?: string;
    phase?: string;
    category?: string;
    owner?: string;
    due_date?: string | null;
    notes?: string | null;
    estimated_cost?: number | null;
    budget_line_id?: string | null;
  }) => Promise<void>;
  onDelete?: () => void;
  budgetLineOptions?: BudgetLineOption[];
  baseCurrency?: string;
}) {
  const [title, setTitle] = useState(task.title);
  const [phase, setPhase] = useState(task.phase);
  const [status, setStatus] = useState(task.status);
  const [owner, setOwner] = useState(task.owner);
  const [category, setCategory] = useState(task.category);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [description, setDescription] = useState(task.description ?? "");
  const [estimatedCost, setEstimatedCost] = useState<string>(
    task.estimated_cost != null ? String(task.estimated_cost) : "",
  );
  const [budgetLineId, setBudgetLineId] = useState<string>(
    task.budget_line_id ?? "none",
  );
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const sym = currencySymbol(baseCurrency);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanedCost = estimatedCost.replace(/[^0-9.]/g, "");
      const costN = cleanedCost ? Number(cleanedCost) : null;
      await onSave({
        title: title.trim() || task.title,
        phase,
        status: status as TaskEditDrawerTask["status"],
        owner,
        category,
        due_date: dueDate || null,
        description: description || null,
        notes: notes || null,
        estimated_cost:
          Number.isFinite(costN as number) && (costN as number) >= 0
            ? (costN as number)
            : null,
        budget_line_id: budgetLineId === "none" ? null : budgetLineId,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Edit task
            </div>
            <h2 className="mt-1 font-serif text-xl font-light tracking-tight">
              {task.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 px-6 py-5">
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phase">
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                {PHASE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Owner">
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                {OWNER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of what this task involves…"
              className="w-full resize-y rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </Field>

          {/* Cost link — ties this task to a budget line. Type a number
              and we either auto-create a leaf budget line under the
              matching category, OR push the value onto whichever line
              you pick from the dropdown. /budget + /estimator stay in sync. */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-amber-900">
              <Coins className="h-3 w-3" />
              Cost link
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Estimated cost"
                hint="Optional — leaves blank if you don't know yet"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-500">
                    {sym}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </Field>
              <Field
                label="Linked budget line"
                hint="Or auto-create one"
              >
                <Select
                  value={budgetLineId}
                  onValueChange={setBudgetLineId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto / no link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Auto-create on save
                    </SelectItem>
                    {budgetLineOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.is_parent
                          ? `${o.label} (category)`
                          : `${o.parent_label ?? o.category}  ›  ${o.label}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <p className="mt-2 text-[11px] text-amber-900/70">
              Set a cost — we&apos;ll add a line on /budget and reflect
              it on /estimator. Pick a specific line above to attach this
              task to an existing one instead.
            </p>
          </div>

          <Field
            label="Notes / updates"
            hint="Track progress, blockers, who said what, decisions made"
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="May 8 — sent RFP to caterer.&#10;May 10 — got quote $9k including bar."
              className="w-full resize-y rounded-md border border-stone-300 px-3 py-2 text-sm leading-relaxed"
            />
          </Field>
        </div>

        <footer className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            >
              Delete task
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {label}
        </span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
