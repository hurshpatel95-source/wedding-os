"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Check, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InvoiceRow {
  id: string;
  workspace_id: string;
  label: string;
  amount_eur: number;
  due_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  paid_via: string | null;
  notes: string | null;
  external_url: string | null;
  created_at: string;
}

export function InvoiceTable({
  invoices,
  workspaceById,
}: {
  invoices: InvoiceRow[];
  workspaceById: Map<string, string>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const patch = async (
    id: string,
    body: Record<string, unknown>,
  ): Promise<void> => {
    setErr(null);
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Update failed.");
        toast.error(data.error ?? "Update failed.");
        return;
      }
      if (body.mark_paid) toast.success("Marked paid");
      else if (body.mark_sent) toast.success("Marked sent");
      else if (body.mark_unpaid) toast.success("Marked unpaid");
      else toast.success("Invoice updated");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this invoice?")) return;
    setPendingId(id);
    const res = await fetch(`/api/admin/invoices/${id}`, { method: "DELETE" });
    setPendingId(null);
    if (res.ok) toast.success("Invoice deleted");
    else toast.error("Couldn't delete invoice");
    router.refresh();
  };

  return (
    <Card>
      <CardContent className="overflow-x-auto py-4">
        {err && (
          <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.15em] text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const overdue =
                !inv.paid_at &&
                inv.due_at &&
                new Date(inv.due_at).getTime() < Date.now();
              return (
                <tr
                  key={inv.id}
                  className={cn(
                    "border-t border-stone-100",
                    overdue && "bg-rose-50/40",
                  )}
                >
                  <td className="px-3 py-2 font-medium">
                    {workspaceById.get(inv.workspace_id) ?? "—"}
                  </td>
                  <td className="px-3 py-2">{inv.label}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    €{Number(inv.amount_eur).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {inv.due_at
                      ? format(parseISO(inv.due_at), "MMM d, yyyy")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {inv.paid_at ? (
                      <Badge variant="success" className="text-[10px]">
                        Paid
                      </Badge>
                    ) : overdue ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Overdue
                      </Badge>
                    ) : inv.sent_at ? (
                      <Badge variant="warning" className="text-[10px]">
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="text-[10px]">
                        Draft
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      {!inv.sent_at && !inv.paid_at && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => patch(inv.id, { mark_sent: true })}
                          disabled={pendingId === inv.id}
                        >
                          {pendingId === inv.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Mark sent
                        </Button>
                      )}
                      {inv.paid_at ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => patch(inv.id, { mark_unpaid: true })}
                          disabled={pendingId === inv.id}
                        >
                          Mark unpaid
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => patch(inv.id, { mark_paid: true })}
                          disabled={pendingId === inv.id}
                        >
                          <Check className="h-3 w-3" />
                          Mark paid
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(inv.id)}
                        disabled={pendingId === inv.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
