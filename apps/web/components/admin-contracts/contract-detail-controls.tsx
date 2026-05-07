"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import type { ContractStatus } from "@/lib/tier1-types";

export function ContractDetailControls({
  contractId,
  status,
  publicLink,
  hasSignerEmail,
}: {
  contractId: string;
  status: ContractStatus;
  publicLink: string;
  hasSignerEmail: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "send" | "void" | "copy">(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isDraft = status === "draft";
  const isFinal =
    status === "signed" || status === "voided" || status === "declined";

  const handleSend = async () => {
    if (busy) return;
    if (!hasSignerEmail) {
      setError("Add a signer email first — the sign link goes there.");
      return;
    }
    if (
      !window.confirm(
        "Send this contract to the signer? You won't be able to edit the body after sending.",
      )
    ) {
      return;
    }
    setBusy("send");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/contracts/${contractId}/send`, {
        method: "POST",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Couldn't send the contract.");
      } else {
        setInfo("Sent — refreshing…");
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleVoid = async () => {
    if (busy) return;
    if (
      !window.confirm(
        "Void this contract? The sign link will stop working. This can't be undone.",
      )
    ) {
      return;
    }
    setBusy("void");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/contracts/${contractId}/void`, {
        method: "POST",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Couldn't void the contract.");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    setBusy("copy");
    setError(null);
    try {
      await navigator.clipboard.writeText(publicLink);
      setInfo("Link copied!");
      setTimeout(() => setInfo(null), 2000);
    } catch {
      setError("Couldn't copy — select the link below manually.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
        Actions
      </div>

      <div className="mt-4 space-y-2">
        {isDraft && (
          <button
            type="button"
            onClick={handleSend}
            disabled={busy !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "send" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send to signer
          </button>
        )}

        <a
          href={`/sign/${publicLink.split("/sign/")[1] ?? ""}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View as client
        </a>

        <button
          type="button"
          onClick={handleCopy}
          disabled={busy !== null}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy public link
        </button>

        {isDraft && (
          <a
            href={`/admin/contracts/${contractId}/edit`}
            onClick={(e) => {
              e.preventDefault();
              setError("Edit page coming soon — for now, void & re-create.");
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit draft
          </a>
        )}

        {!isFinal && (
          <button
            type="button"
            onClick={handleVoid}
            disabled={busy !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "void" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Void contract
          </button>
        )}
      </div>

      <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
        <div className="text-[10px] uppercase tracking-wider text-stone-400">
          Public link
        </div>
        <div className="mt-1 break-all font-mono">{publicLink}</div>
      </div>

      {info && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {info}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}
    </section>
  );
}
