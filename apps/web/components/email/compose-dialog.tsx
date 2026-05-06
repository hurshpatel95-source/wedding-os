"use client";

import { useEffect, useState } from "react";
import { Copy, Download, Mail, RefreshCcw, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EMAIL_KIND_GROUPS, EMAIL_TEMPLATES, type EmailKind } from "@/lib/email-templates";
import { cn } from "@/lib/utils";

export interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // One of these — drives Claude's context fetch
  vendorId?: string;
  guestId?: string;
  guestFilter?: { side?: "groom" | "bride" | "both"; rsvp?: "pending" | "yes" | "no" | "maybe" };
  // Optional initial defaults
  defaultKind?: EmailKind;
  toEmail?: string | null;
  // Header strip — show the entity name
  contextLabel?: string;
}

export function ComposeDialog({
  open,
  onOpenChange,
  vendorId,
  guestId,
  guestFilter,
  defaultKind,
  toEmail,
  contextLabel,
}: ComposeDialogProps) {
  // Pick a sensible default kind based on which context was passed in
  const inferredDefault: EmailKind =
    defaultKind ??
    (vendorId ? "vendor_rfp" : guestId ? "guest_update" : guestFilter ? "guest_save_the_date" : "custom");

  const [kind, setKind] = useState<EmailKind>(inferredDefault);
  const [brief, setBrief] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [bodyText, setBodyText] = useState<string>("");
  const [toSuggestion, setToSuggestion] = useState<string>(toEmail ?? "");
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState<"" | "subject" | "body" | "all">("");

  // Auto-generate the first draft when the dialog opens
  useEffect(() => {
    if (open && !subject && !bodyText && !generating) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          vendor_id: vendorId,
          guest_id: guestId,
          guest_filter: guestFilter,
          user_brief: brief.trim() || undefined,
        }),
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
      setBodyText(data.body);
      if (data.to_suggestion && !toSuggestion) setToSuggestion(data.to_suggestion);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (what: "subject" | "body" | "all") => {
    const text =
      what === "subject"
        ? subject
        : what === "body"
        ? bodyText
        : `Subject: ${subject}\n\n${bodyText}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyOk(what);
      setTimeout(() => setCopyOk(""), 1500);
    } catch {
      // fallback: select all on a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyOk(what);
      setTimeout(() => setCopyOk(""), 1500);
    }
  };

  // Build a simple .eml file the user can drop into a mail client
  const downloadEml = () => {
    const eml = [
      `From: Astia Events <noreply@astiaevents.com>`,
      toSuggestion ? `To: ${toSuggestion}` : "To: ",
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      bodyText,
    ].join("\r\n");
    const blob = new Blob([eml], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${subject.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60)}.eml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openInGmail = () => {
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: toSuggestion,
      su: subject,
      body: bodyText,
    });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-700" />
            Compose with AI
          </DialogTitle>
          <DialogDescription>
            {contextLabel
              ? `Drafting in context of ${contextLabel}.`
              : "Pick a kind. Claude reads the workspace + entity and drafts the email."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as EmailKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_KIND_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.kinds.map((k) => (
                        <SelectItem key={k} value={k}>
                          {EMAIL_TEMPLATES[k].label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {EMAIL_TEMPLATES[kind].description}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>Optional brief (steers Claude)</Label>
              <Input
                placeholder="e.g. 'mention we need 2-camera coverage' or 'we want sit-down dinner not buffet'"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={generate} disabled={generating}>
              <RefreshCcw className={cn("h-4 w-4", generating && "animate-spin")} />
              {generating ? "Generating…" : subject ? "Regenerate" : "Generate draft"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>To (suggested)</Label>
              </div>
              <Input value={toSuggestion} onChange={(e) => setToSuggestion(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Subject</Label>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"
                  onClick={() => copy("subject")}
                >
                  <Copy className="h-3 w-3" />
                  {copyOk === "subject" ? "Copied" : "Copy"}
                </button>
              </div>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Body</Label>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"
                  onClick={() => copy("body")}
                >
                  <Copy className="h-3 w-3" />
                  {copyOk === "body" ? "Copied" : "Copy"}
                </button>
              </div>
              <Textarea
                rows={14}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="font-mono text-sm leading-relaxed"
              />
            </div>
          </div>

          {/* Future-vision callout — Gmail integration */}
          <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <Zap className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-sm font-medium">
                    Gmail integration · coming soon
                  </span>
                  <Badge variant="muted" className="text-[10px]">
                    Phase 2
                  </Badge>
                </div>
                <p className="text-xs text-stone-600">
                  Connect Astia's Gmail and we'll send drafts straight from her inbox, monitor
                  vendor replies, auto-update vendor statuses, and log every thread to the right
                  client. For now: copy/download below.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={downloadEml} disabled={!subject || !bodyText}>
            <Download className="h-4 w-4" /> Download .eml
          </Button>
          <Button
            variant="outline"
            onClick={() => copy("all")}
            disabled={!subject || !bodyText}
          >
            <Copy className="h-4 w-4" />
            {copyOk === "all" ? "Copied!" : "Copy all"}
          </Button>
          <Button onClick={openInGmail} disabled={!subject || !bodyText}>
            <Mail className="h-4 w-4" /> Open in Gmail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
