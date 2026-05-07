"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCcw, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EmailKind } from "@/lib/email-templates";
import { cn } from "@/lib/utils";

export interface InlineEmailComposerProps {
  contextKind: "lead" | "vendor" | "guest";
  contextId: string;
  defaultTo?: string | null;
  defaultSubject?: string;
  defaultBody?: string;
  draftHelperKind?: EmailKind;
}

export function InlineEmailComposer({
  contextKind,
  contextId,
  defaultTo,
  defaultSubject,
  defaultBody,
  draftHelperKind,
}: InlineEmailComposerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<string>(defaultTo ?? "");
  const [subject, setSubject] = useState<string>(defaultSubject ?? "");
  const [body, setBody] = useState<string>(defaultBody ?? "");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const reset = () => {
    setTo(defaultTo ?? "");
    setSubject(defaultSubject ?? "");
    setBody(defaultBody ?? "");
    setDraftError(null);
  };

  const close = () => {
    setOpen(false);
    setDraftError(null);
  };

  const draftWithAi = async () => {
    if (!draftHelperKind) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const payload: Record<string, unknown> = { kind: draftHelperKind };
      if (contextKind === "vendor") payload.vendor_id = contextId;
      if (contextKind === "guest") payload.guest_id = contextId;
      // Lead context isn't directly supported by /api/email/draft, but the
      // freeform 'custom' kind still works without an entity id.

      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Draft failed (${res.status})`);
      }
      const data = (await res.json()) as {
        subject: string;
        body: string;
        to_suggestion?: string;
      };
      setSubject(data.subject);
      setBody(data.body);
      if (data.to_suggestion && !to) setTo(data.to_suggestion);
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Fill in to, subject, and body before sending.");
      return;
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        to: to.trim(),
        subject: subject.trim(),
        body_text: body,
        kind: draftHelperKind,
      };
      if (contextKind === "lead") payload.related_lead_id = contextId;
      if (contextKind === "vendor") payload.related_vendor_id = contextId;
      if (contextKind === "guest") payload.related_guest_id = contextId;

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message_id?: string | null;
        provider_message_id?: string | null;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? `Send failed (${res.status})`);
      }
      if (j.provider_message_id) {
        toast.success("Sent");
      } else {
        toast.warning(
          "Saved as draft only — RESEND_API_KEY not configured on the server.",
        );
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <div>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          Compose email
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
          <Mail className="h-3.5 w-3.5" />
          New email
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Close composer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="compose-to">To</Label>
          <Input
            id="compose-to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="compose-subject">Subject</Label>
          <Input
            id="compose-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="compose-body">Body</Label>
          <Textarea
            id="compose-body"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="font-mono text-sm leading-relaxed"
          />
        </div>

        {draftError && (
          <p className="text-sm text-destructive">{draftError}</p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {draftHelperKind && (
            <Button
              type="button"
              variant="outline"
              onClick={draftWithAi}
              disabled={drafting || sending}
              className="gap-2"
            >
              {drafting ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {drafting ? "Drafting…" : "Draft with AI"}
            </Button>
          )}
          <Button
            type="button"
            onClick={send}
            disabled={sending || drafting}
            className={cn("gap-2")}
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
