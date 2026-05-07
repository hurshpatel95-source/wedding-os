"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Pencil, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ProposalStatus } from "@/lib/tier1-types";

export function ProposalActionBar({
  proposalId,
  status,
  publicToken,
}: {
  proposalId: string;
  status: ProposalStatus;
  publicToken: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const send = async () => {
    if (
      !confirm(
        "Send this proposal? The couple will receive an email with a private link.",
      )
    )
      return;
    setBusy("send");
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/send`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        email?: { ok: boolean; error: string | null };
      };
      if (!res.ok) throw new Error(j.error || "Could not send");
      if (j.email?.ok === false) {
        toast.warning(`Marked sent — email delivery: ${j.email.error ?? "queued"}`);
      } else {
        toast.success("Sent");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(null);
    }
  };

  const expire = async () => {
    if (!confirm("Mark this proposal as expired? The couple will no longer be able to view or accept it."))
      return;
    setBusy("expire");
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/expire`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not expire");
      toast.success("Marked expired");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not expire");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <>
          <Link
            href={`/admin/proposals/${proposalId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Link>
          <button
            type="button"
            onClick={send}
            disabled={busy != null}
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
          >
            <Send className="h-3 w-3" />
            {busy === "send" ? "Sending…" : "Send to recipient"}
          </button>
        </>
      )}

      <Link
        href={`/proposal/${publicToken}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
      >
        <ExternalLink className="h-3 w-3" />
        View as client
      </Link>

      {status !== "expired" && status !== "accepted" && (
        <button
          type="button"
          onClick={expire}
          disabled={busy != null}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-60"
        >
          <XCircle className="h-3 w-3" />
          {busy === "expire" ? "…" : "Mark expired"}
        </button>
      )}
    </div>
  );
}
