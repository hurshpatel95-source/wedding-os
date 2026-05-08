"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function RuleRowActions({
  ruleId,
  enabled,
  name,
}: {
  ruleId: string;
  enabled: boolean;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [optimisticEnabled, setOptimisticEnabled] = useState(enabled);

  const toggle = async () => {
    setBusy(true);
    setOptimisticEnabled((v) => !v);
    try {
      const res = await fetch(
        `/api/admin/lead-routing-rules/${ruleId}/toggle`,
        { method: "POST", headers: { "content-type": "application/json" } },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not toggle");
      }
      const j = (await res.json()) as { enabled?: boolean };
      if (typeof j.enabled === "boolean") setOptimisticEnabled(j.enabled);
      router.refresh();
    } catch (err) {
      setOptimisticEnabled((v) => !v); // revert
      toast.error(err instanceof Error ? err.message : "Could not toggle");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete the routing rule "${name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/lead-routing-rules/${ruleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not delete");
      }
      toast.success("Rule deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition disabled:opacity-50 ${
          optimisticEnabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            optimisticEnabled ? "bg-emerald-500" : "bg-stone-400"
          }`}
        />
        {optimisticEnabled ? "Enabled" : "Disabled"}
      </button>
      <Link
        href={`/admin/settings/lead-routing/${ruleId}/edit`}
        className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-700 transition hover:border-stone-400"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    </div>
  );
}
