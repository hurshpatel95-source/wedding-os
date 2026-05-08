"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { TestimonialStatus } from "@/lib/wave2-types";

export function TestimonialDetailControls({
  testimonialId,
  status,
  publicLink,
  hasQuote,
}: {
  testimonialId: string;
  status: TestimonialStatus;
  publicLink: string;
  hasQuote: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<
    null | "publish" | "decline" | "delete" | "copy"
  >(null);

  const isSubmitted = status === "submitted";
  const isPublished = status === "published";

  const handlePublish = async () => {
    if (busy) return;
    if (!hasQuote) {
      toast.error("There's no quote yet — wait for the couple's submission.");
      return;
    }
    if (
      !window.confirm(
        "Publish this testimonial? It will appear on your public booking page.",
      )
    )
      return;
    setBusy("publish");
    try {
      const res = await fetch(
        `/api/admin/testimonials/${testimonialId}/publish`,
        { method: "POST" },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        toast.error(json.error ?? "Couldn't publish.");
      } else {
        toast.success("Testimonial published.");
        router.refresh();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    if (busy) return;
    if (!window.confirm("Decline this submission? It won't be displayed publicly."))
      return;
    setBusy("decline");
    try {
      const res = await fetch(
        `/api/admin/testimonials/${testimonialId}/decline`,
        { method: "POST" },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        toast.error(json.error ?? "Couldn't decline.");
      } else {
        toast.success("Testimonial declined.");
        router.refresh();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    if (
      !window.confirm(
        "Delete this testimonial entirely? This can't be undone — including any uploaded photo.",
      )
    )
      return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/testimonials/${testimonialId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        toast.error(json.error ?? "Couldn't delete.");
      } else {
        toast.success("Testimonial deleted.");
        router.push("/admin/testimonials");
        router.refresh();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    setBusy("copy");
    try {
      await navigator.clipboard.writeText(publicLink);
      toast.success("Link copied!");
    } catch {
      toast.error("Couldn't copy — select the link below manually.");
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
        {isSubmitted && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={busy !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "publish" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Publish
          </button>
        )}

        {isSubmitted && (
          <button
            type="button"
            onClick={handleDecline}
            disabled={busy !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "decline" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            Decline
          </button>
        )}

        <a
          href={publicLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View as couple
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

        {!isPublished && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "delete" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </button>
        )}
      </div>

      <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
        <div className="text-[10px] uppercase tracking-wider text-stone-400">
          Public link
        </div>
        <div className="mt-1 break-all font-mono">{publicLink}</div>
      </div>
    </section>
  );
}
