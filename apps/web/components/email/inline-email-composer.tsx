"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookmarkPlus,
  Check,
  FileText,
  Mail,
  RefreshCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import type { EmailKind } from "@/lib/email-templates";
import {
  EMAIL_TEMPLATE_KIND_LABEL,
  EMAIL_TEMPLATE_LIBRARY_KINDS,
  isEmailTemplateLibraryKind,
  type EmailTemplateLibraryKind,
} from "@/lib/email-template-kinds";
import type { EmailTemplateRow } from "@/lib/wave2-types";
import { cn } from "@/lib/utils";

export interface InlineEmailComposerProps {
  contextKind: "lead" | "vendor" | "guest";
  contextId: string;
  defaultTo?: string | null;
  defaultSubject?: string;
  defaultBody?: string;
  draftHelperKind?: EmailKind;
}

// Map the AI-prompt EmailKind to the saved-template library kind so we
// can pre-filter the dropdown to relevant options. Only kinds that have
// a clean 1:1 mapping are listed here — anything else falls through and
// shows the full library.
const AI_KIND_TO_LIBRARY_KIND: Partial<Record<EmailKind, EmailTemplateLibraryKind>> = {
  vendor_rfp: "vendor_rfp",
  vendor_followup: "vendor_followup",
  vendor_contract_reminder: "contract_followup",
  guest_save_the_date: "guest_save_the_date",
  guest_rsvp_nudge: "guest_rsvp_nudge",
  guest_update: "guest_update",
  custom: "custom",
};

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

  // Saved-template library state
  const [templates, setTemplates] = useState<EmailTemplateRow[] | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [pickedTemplateId, setPickedTemplateId] = useState<string>("");

  // Save-as-template inline form state
  const [savePanelOpen, setSavePanelOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveKind, setSaveKind] = useState<EmailTemplateLibraryKind>(() => {
    if (draftHelperKind && AI_KIND_TO_LIBRARY_KIND[draftHelperKind]) {
      return AI_KIND_TO_LIBRARY_KIND[draftHelperKind]!;
    }
    return "custom";
  });
  const [saving, setSaving] = useState(false);

  // Load the template library when the composer first expands. Pre-filter
  // by the matching library kind if `draftHelperKind` was supplied.
  useEffect(() => {
    if (!open || templates !== null || templatesLoading) return;
    setTemplatesLoading(true);
    const libraryKind = draftHelperKind
      ? AI_KIND_TO_LIBRARY_KIND[draftHelperKind]
      : undefined;
    const url = libraryKind
      ? `/api/admin/email-templates?kind=${encodeURIComponent(libraryKind)}`
      : "/api/admin/email-templates";
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        return (await res.json()) as { templates?: EmailTemplateRow[] };
      })
      .then((j) => setTemplates(j.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [open, templates, templatesLoading, draftHelperKind]);

  const reset = () => {
    setTo(defaultTo ?? "");
    setSubject(defaultSubject ?? "");
    setBody(defaultBody ?? "");
    setDraftError(null);
    setPickedTemplateId("");
    setSavePanelOpen(false);
    setSaveName("");
  };

  const close = () => {
    setOpen(false);
    setDraftError(null);
    setSavePanelOpen(false);
  };

  const applyTemplate = async (templateId: string) => {
    if (!templates) return;
    const t = templates.find((row) => row.id === templateId);
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body);
    setPickedTemplateId(templateId);
    // Fire-and-forget: bump use_count + last_used_at. Failure is silent —
    // we never want the bump to block the planner's flow.
    fetch(`/api/admin/email-templates/${templateId}/use`, { method: "POST" }).catch(
      () => undefined,
    );
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

  const saveAsTemplate = async () => {
    if (!saveName.trim()) {
      toast.error("Give the template a name first.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Fill in subject and body before saving as a template.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          kind: saveKind,
          subject: subject.trim(),
          body,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string | null;
        error?: string;
      };
      if (!res.ok || j.ok === false) {
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }
      toast.success(`Saved "${saveName.trim()}" to your templates`);
      // Refresh the in-composer dropdown so the new template appears
      // immediately. Cheaper than re-fetching the list.
      if (j.id) {
        const newRow: EmailTemplateRow = {
          id: j.id,
          org_id: "",
          name: saveName.trim(),
          kind: saveKind,
          subject: subject.trim(),
          body,
          is_shared: true,
          use_count: 0,
          last_used_at: null,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setTemplates((prev) => (prev ? [...prev, newRow] : [newRow]));
      }
      setSavePanelOpen(false);
      setSaveName("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
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

  const sortedTemplates = templates
    ? [...templates].sort((a, b) => {
        // Most-recently used first, then alphabetical.
        const aTs = a.last_used_at ? Date.parse(a.last_used_at) : 0;
        const bTs = b.last_used_at ? Date.parse(b.last_used_at) : 0;
        if (aTs !== bTs) return bTs - aTs;
        if (a.use_count !== b.use_count) return b.use_count - a.use_count;
        return a.name.localeCompare(b.name);
      })
    : [];

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

        {/* Use-template dropdown — always above subject */}
        <div className="grid gap-1.5">
          <Label htmlFor="compose-template">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Use template
            </span>
          </Label>
          <Select
            value={pickedTemplateId}
            onValueChange={(v) => applyTemplate(v)}
            disabled={templatesLoading || (templates !== null && templates.length === 0)}
          >
            <SelectTrigger id="compose-template">
              <SelectValue
                placeholder={
                  templatesLoading
                    ? "Loading templates…"
                    : templates && templates.length === 0
                      ? "No saved templates yet"
                      : "Pick a saved template"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {sortedTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="font-medium">{t.name}</span>
                  {t.kind && (
                    <span className="ml-2 text-xs text-stone-500">
                      · {kindLabel(t.kind)}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {/* Save-as-template inline panel */}
        {savePanelOpen ? (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600">
                Save as template
              </div>
              <button
                type="button"
                onClick={() => setSavePanelOpen(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-white hover:text-stone-700"
                aria-label="Cancel save as template"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="sat-name">Name</Label>
                <Input
                  id="sat-name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Vendor RFP - photographers"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kind</Label>
                <Select
                  value={saveKind}
                  onValueChange={(v) =>
                    setSaveKind(v as EmailTemplateLibraryKind)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATE_LIBRARY_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {EMAIL_TEMPLATE_KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSavePanelOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveAsTemplate}
                disabled={saving || !saveName.trim()}
                className="gap-2"
              >
                {saving ? (
                  <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save template"}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSavePanelOpen(true)}
              disabled={!subject.trim() || !body.trim()}
              className="gap-1.5 text-stone-600 hover:text-stone-900"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save as template
            </Button>
          </div>
        )}

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

function kindLabel(kind: string): string {
  if (isEmailTemplateLibraryKind(kind)) {
    return EMAIL_TEMPLATE_KIND_LABEL[kind];
  }
  return kind;
}
