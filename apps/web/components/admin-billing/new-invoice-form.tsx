"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface WorkspaceOpt {
  id: string;
  name: string;
}

export function NewInvoiceForm({
  workspaces,
  defaultWorkspaceId,
}: {
  workspaces: WorkspaceOpt[];
  defaultWorkspaceId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(
    defaultWorkspaceId ?? workspaces[0]?.id ?? "",
  );
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!workspaceId || !label.trim() || !amount) {
      setErr("Client, label, and amount are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          label: label.trim(),
          amount_eur: Number(amount),
          due_at: due || null,
          external_url: externalUrl.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't create invoice.");
        return;
      }
      // Reset + close
      setLabel("");
      setAmount("");
      setDue("");
      setExternalUrl("");
      setNotes("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New invoice
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="py-5">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select
                value={workspaceId}
                onValueChange={setWorkspaceId}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a client" />
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
            <div className="space-y-1.5">
              <Label htmlFor="lbl">Label</Label>
              <Input
                id="lbl"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Retainer · 50%"
                disabled={submitting}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="amt">Amount (EUR)</Label>
              <Input
                id="amt"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="4000"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Due date</Label>
              <Input
                id="due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">External URL (Stripe link)</Label>
              <Input
                id="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://invoice.stripe.com/..."
                disabled={submitting}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nts">Notes</Label>
            <Textarea
              id="nts"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes — not shown to the couple."
              disabled={submitting}
            />
          </div>
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add invoice
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
