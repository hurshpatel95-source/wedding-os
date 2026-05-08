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
import {
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
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

export interface WorkspaceOpt {
  id: string;
  name: string;
}

export interface VendorOpt {
  id: string;
  name: string;
  workspace_id: string;
}

export function NewExpenseDialog({
  workspaces,
  vendors,
  triggerLabel = "New expense",
  triggerVariant = "default",
}: {
  workspaces: WorkspaceOpt[];
  vendors: VendorOpt[];
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("misc");
  const [paidAt, setPaidAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string>("__none__");
  const [vendorId, setVendorId] = useState<string>("__none__");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setAmount("");
    setCategory("misc");
    setPaidAt("");
    setDueAt("");
    setWorkspaceId("__none__");
    setVendorId("__none__");
    setNotes("");
    setErr(null);
  };

  const eligibleVendors = vendors.filter(
    (v) => workspaceId === "__none__" || v.workspace_id === workspaceId,
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!label.trim() || !amount) {
      setErr("Label and amount are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          amount_eur: Number(amount),
          category,
          paid_at: paidAt ? new Date(paidAt).toISOString() : null,
          due_at: dueAt || null,
          workspace_id: workspaceId === "__none__" ? null : workspaceId,
          vendor_id: vendorId === "__none__" ? null : vendorId,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't save expense.");
        toast.error(data.error ?? "Couldn't save expense.");
        return;
      }
      toast.success(`Expense "${label.trim()}" added`);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New expense</DialogTitle>
          <DialogDescription>
            Vendor payment, software, travel — anything you spend on the studio.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exp-label">Label</Label>
              <Input
                id="exp-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Florist deposit · Eden Studio"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-amt">Amount (EUR)</Label>
              <Input
                id="exp-amt"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="450"
                disabled={submitting}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
                disabled={submitting}
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-paid">Paid at</Label>
              <Input
                id="exp-paid"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-due">Due at</Label>
              <Input
                id="exp-due"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Link to client (optional)</Label>
              <Select
                value={workspaceId}
                onValueChange={(v) => {
                  setWorkspaceId(v);
                  // Reset vendor if it's no longer in the same workspace
                  if (v !== "__none__") {
                    const stillValid = vendors.some(
                      (x) => x.id === vendorId && x.workspace_id === v,
                    );
                    if (!stillValid) setVendorId("__none__");
                  }
                }}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No client</SelectItem>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Link to vendor (optional)</Label>
              <Select
                value={vendorId}
                onValueChange={setVendorId}
                disabled={submitting || eligibleVendors.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No vendor</SelectItem>
                  {eligibleVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-notes">Notes</Label>
            <Textarea
              id="exp-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional internal note."
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
              Save expense
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
