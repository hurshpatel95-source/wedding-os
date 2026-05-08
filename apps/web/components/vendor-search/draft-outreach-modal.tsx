"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Loader2,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Draft {
  vendor_id: string;
  vendor_name: string | null;
  to_email: string | null;
  subject: string;
  body_text: string;
}

interface DraftOutreachResponse {
  ok?: boolean;
  drafts?: Draft[];
  error?: string;
  cost_usd?: number;
}

export function DraftOutreachModal({
  vendorIds,
  vendorNames,
  open,
  onClose,
}: {
  vendorIds: string[];
  vendorNames: string[];
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [edited, setEdited] = useState<Record<string, { subject: string; body: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [gmailSavingId, setGmailSavingId] = useState<string | null>(null);

  // Kick off generation when modal opens
  useEffect(() => {
    if (!open) return;
    if (drafts !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/autopilot/draft-outreach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vendor_ids: vendorIds }),
    })
      .then(async (res) => {
        const j = (await res.json()) as DraftOutreachResponse;
        if (cancelled) return;
        if (!res.ok || !j.ok || !j.drafts) {
          setError(j.error ?? "Couldn't draft RFPs.");
          setLoading(false);
          return;
        }
        setDrafts(j.drafts);
        const initial: Record<string, { subject: string; body: string }> = {};
        for (const d of j.drafts) {
          initial[d.vendor_id] = { subject: d.subject, body: d.body_text };
        }
        setEdited(initial);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, vendorIds, drafts, loading]);

  // Check Gmail connection status (best-effort; if 404, treat as not connected)
  useEffect(() => {
    if (!open) return;
    fetch("/api/gmail/sync", { method: "GET" })
      .then((res) => {
        // GET on the sync endpoint will be 405; we just want to know if
        // /settings/gmail has a connection. Easier: try the test-send-style
        // probe by checking the connection list endpoint. But we don't have
        // one yet — so just leave gmailConnected null and the buttons fall
        // back to the disabled state.
        setGmailConnected(false);
        void res;
      })
      .catch(() => setGmailConnected(false));
  }, [open]);

  if (!open) return null;

  const handleCopy = async (vendorId: string) => {
    const e = edited[vendorId];
    if (!e) return;
    const text = `Subject: ${e.subject}\n\n${e.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied — paste into your email client");
    } catch {
      toast.error("Couldn't copy. Try selecting the text manually.");
    }
  };

  const handleMailto = (vendorId: string, toEmail: string | null) => {
    const e = edited[vendorId];
    if (!e) return;
    const recipient = toEmail ?? "";
    const params = new URLSearchParams({
      subject: e.subject,
      body: e.body,
    });
    const url = `mailto:${recipient}?${params.toString()}`;
    window.open(url, "_blank");
  };

  const handleSaveToGmail = async (vendorId: string, toEmail: string | null) => {
    const e = edited[vendorId];
    if (!e || !toEmail) return;
    setGmailSavingId(vendorId);
    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: toEmail,
          subject: e.subject,
          body_text: e.body,
          related_vendor_id: vendorId,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Couldn't save to Gmail Drafts.");
        return;
      }
      toast.success("Saved to your Gmail Drafts — open Gmail to review and send");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setGmailSavingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl border border-stone-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-stone-500">
              <Sparkles className="h-3 w-3 text-rose-600" />
              AI-drafted RFPs
            </div>
            <h2 className="mt-1 font-serif text-2xl font-light tracking-tight">
              {vendorIds.length} personalized email{vendorIds.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-xs text-stone-600">
              Each one is unique — opens with a specific reference to that
              vendor. Copy, send manually via mailto, or save to Gmail Drafts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
              <p className="text-sm text-stone-700">
                Claude is drafting {vendorIds.length} personalized RFPs…
              </p>
              <p className="text-[11px] text-stone-500">
                Reading each vendor's profile, writing one email per vendor that
                actually feels written by you.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
              {error}
            </div>
          )}

          {drafts && (
            <div className="space-y-5">
              {drafts.map((d, i) => {
                const e = edited[d.vendor_id] ?? { subject: d.subject, body: d.body_text };
                const recipient = d.to_email;
                return (
                  <article
                    key={d.vendor_id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/40 p-5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                        Draft {i + 1} of {drafts.length}
                      </div>
                      <div className="font-medium text-stone-900">
                        {d.vendor_name ?? vendorNames[i] ?? "Vendor"}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                        Subject
                      </span>
                      <input
                        type="text"
                        value={e.subject}
                        onChange={(ev) =>
                          setEdited((prev) => ({
                            ...prev,
                            [d.vendor_id]: { ...e, subject: ev.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="mt-3 block">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                        Body
                      </span>
                      <textarea
                        value={e.body}
                        rows={8}
                        onChange={(ev) =>
                          setEdited((prev) => ({
                            ...prev,
                            [d.vendor_id]: { ...e, body: ev.target.value },
                          }))
                        }
                        className="mt-1 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed"
                      />
                    </label>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(d.vendor_id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!recipient}
                        onClick={() => handleMailto(d.vendor_id, recipient)}
                        title={
                          recipient
                            ? `Open in mail client to ${recipient}`
                            : "No email on file for this vendor"
                        }
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Open in mail client
                      </Button>
                      {gmailConnected ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!recipient || gmailSavingId === d.vendor_id}
                          onClick={() => handleSaveToGmail(d.vendor_id, recipient)}
                        >
                          {gmailSavingId === d.vendor_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          Save to Gmail Drafts
                        </Button>
                      ) : (
                        <a
                          href="/settings/gmail"
                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-500 hover:border-rose-400 hover:text-rose-700"
                        >
                          <Sparkles className="h-3 w-3" />
                          Connect Gmail to auto-draft
                        </a>
                      )}
                      {!recipient && (
                        <span className="text-[10px] text-stone-500">
                          No email — try Copy, then paste into a fresh email
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          <p className="text-[11px] text-stone-500">
            These are saved as your latest outreach — vendor status is now &ldquo;Contacted&rdquo;.
          </p>
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
