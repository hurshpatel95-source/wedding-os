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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
  type PlannerExpenseRow,
} from "@/lib/wave2-types";

const CATEGORY_OPTIONS: ExpenseCategory[] = [
  "vendor_payment",
  "software",
  "travel",
  "marketing",
  "office",
  "taxes",
  "misc",
];

const CATEGORY_TONE: Record<ExpenseCategory, string> = {
  vendor_payment: "bg-rose-50 text-rose-800 ring-rose-200",
  software: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  travel: "bg-amber-50 text-amber-800 ring-amber-200",
  marketing: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  office: "bg-stone-100 text-stone-700 ring-stone-200",
  taxes: "bg-slate-100 text-slate-700 ring-slate-300",
  misc: "bg-stone-50 text-stone-600 ring-stone-200",
};

export function ExpensesTable({
  expenses,
  workspaceById,
  emptyHint,
}: {
  expenses: PlannerExpenseRow[];
  workspaceById: Map<string, string>;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<ExpenseCategory>("misc");
  const [editPaidAt, setEditPaidAt] = useState("");

  const startEdit = (e: PlannerExpenseRow) => {
    setEditId(e.id);
    setEditLabel(e.label);
    setEditAmount(String(e.amount_eur));
    setEditCategory(e.category);
    setEditPaidAt(e.paid_at ? e.paid_at.slice(0, 10) : "");
  };
  const cancelEdit = () => setEditId(null);

  const save = async (id: string) => {
    if (!editLabel.trim() || !editAmount) {
      toast.error("Label and amount are required.");
      return;
    }
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim(),
          amount_eur: Number(editAmount),
          category: editCategory,
          paid_at: editPaidAt ? new Date(editPaidAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Update failed");
        return;
      }
      toast.success("Expense updated");
      setEditId(null);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't delete");
        return;
      }
      toast.success("Expense deleted");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {emptyHint ?? "No expenses logged yet."}
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
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Paid</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => {
              const editing = editId === e.id;
              const pending = pendingId === e.id;
              return (
                <tr key={e.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-medium">
                    {editing ? (
                      <Input
                        value={editLabel}
                        onChange={(ev) => setEditLabel(ev.target.value)}
                        disabled={pending}
                      />
                    ) : (
                      e.label
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <Select
                        value={editCategory}
                        onValueChange={(v) =>
                          setEditCategory(v as ExpenseCategory)
                        }
                        disabled={pending}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {EXPENSE_CATEGORY_LABEL[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                          CATEGORY_TONE[e.category]
                        }`}
                      >
                        {EXPENSE_CATEGORY_LABEL[e.category]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {e.workspace_id
                      ? (workspaceById.get(e.workspace_id) ?? "—")
                      : (
                        <span className="text-stone-400">Studio overhead</span>
                      )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {editing ? (
                      <Input
                        inputMode="decimal"
                        value={editAmount}
                        onChange={(ev) =>
                          setEditAmount(
                            ev.target.value.replace(/[^\d.]/g, ""),
                          )
                        }
                        className="text-right"
                        disabled={pending}
                      />
                    ) : (
                      `€${Number(e.amount_eur).toLocaleString()}`
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {editing ? (
                      <Input
                        type="date"
                        value={editPaidAt}
                        onChange={(ev) => setEditPaidAt(ev.target.value)}
                        disabled={pending}
                      />
                    ) : e.paid_at ? (
                      format(parseISO(e.paid_at), "MMM d, yyyy")
                    ) : (
                      <Badge variant="warning" className="text-[10px]">
                        Unpaid
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
                            onClick={() => save(e.id)}
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
