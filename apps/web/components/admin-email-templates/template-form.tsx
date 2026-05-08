"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Save } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  EMAIL_TEMPLATE_KIND_LABEL,
  EMAIL_TEMPLATE_LIBRARY_KINDS,
  EMAIL_TEMPLATE_TOKENS,
  substituteTemplateTokens,
  type EmailTemplateLibraryKind,
} from "@/lib/email-template-kinds";

export interface EmailTemplateFormProps {
  mode: "create" | "edit";
  template?: {
    id: string;
    name: string;
    kind: string | null;
    subject: string;
    body: string;
  };
}

// Placeholder values used in the preview pane. These are illustrative
// only — actual substitution happens at send time when we have the real
// guest / workspace / planner context.
const PREVIEW_VARS = {
  first_name: "Aanya",
  couple_names: "Hursh & Nisha",
  planner_name: "Astha",
  studio_name: "Astia Events",
  wedding_date: "Sept 18, 2027",
};

export function EmailTemplateForm({ mode, template }: EmailTemplateFormProps) {
  const router = useRouter();

  const initialKind: EmailTemplateLibraryKind =
    template?.kind &&
    (EMAIL_TEMPLATE_LIBRARY_KINDS as readonly string[]).includes(template.kind)
      ? (template.kind as EmailTemplateLibraryKind)
      : "custom";

  const [name, setName] = useState(template?.name ?? "");
  const [kind, setKind] = useState<EmailTemplateLibraryKind>(initialKind);
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSubject = useMemo(
    () => substituteTemplateTokens(subject, PREVIEW_VARS, "placeholder"),
    [subject],
  );
  const previewBody = useMemo(
    () => substituteTemplateTokens(body, PREVIEW_VARS, "placeholder"),
    [body],
  );

  const insertToken = (token: string) => {
    setBody((cur) => (cur.endsWith(" ") || cur === "" ? cur + token : cur + " " + token));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!body.trim()) {
      setError("Body is required");
      return;
    }

    setSubmitting(true);
    const url =
      mode === "create"
        ? "/api/admin/email-templates"
        : `/api/admin/email-templates/${template!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          kind,
          subject: subject.trim(),
          body,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok || j.ok === false) {
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }
      router.push("/admin/settings/email-templates");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-1.5">
          <Label htmlFor="et-name">Template name *</Label>
          <Input
            id="et-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vendor RFP - photographers"
            required
          />
          <p className="text-xs text-stone-500">
            Just for you — pick a name you&apos;ll recognise in the dropdown.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label>Kind</Label>
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as EmailTemplateLibraryKind)}
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
          <p className="text-xs text-stone-500">
            Used to filter the dropdown when composing this kind of email.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="et-subject">Subject *</Label>
          <Input
            id="et-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Quote request — {couple_names} wedding, {wedding_date}"
            required
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="et-body">Body *</Label>
          <Textarea
            id="et-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            placeholder={"Hi {first_name},\n\nWe're getting married on {wedding_date}…"}
            className="font-mono text-sm leading-relaxed"
            required
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Insert token:
            </span>
            {EMAIL_TEMPLATE_TOKENS.map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => insertToken(tok)}
                className="rounded-full border border-stone-200 bg-white px-2 py-0.5 font-mono text-[11px] text-stone-700 hover:border-stone-400 hover:bg-stone-50"
              >
                {tok}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-5">
          <Button type="submit" disabled={submitting} className="gap-2">
            <Save className="h-4 w-4" />
            {submitting
              ? "Saving…"
              : mode === "create"
                ? "Save template"
                : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => router.push("/admin/settings/email-templates")}
          >
            Cancel
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
          <Eye className="h-3.5 w-3.5" />
          Preview
        </div>
        <Card className="overflow-hidden">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-400">
                Subject
              </div>
              <div className="mt-1 font-medium text-stone-900">
                {previewSubject || (
                  <span className="text-stone-400">No subject yet</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-400">
                Body
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                {previewBody || (
                  <span className="text-stone-400">
                    Tokens will be filled in like this:
                    <br />
                    Hi Aanya,
                    <br />
                    From {PREVIEW_VARS.planner_name} at {PREVIEW_VARS.studio_name}
                    <br />
                    on behalf of {PREVIEW_VARS.couple_names}.
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-stone-500">
          Preview uses placeholder data. The real values for{" "}
          <code className="text-stone-700">{"{first_name}"}</code>,{" "}
          <code className="text-stone-700">{"{couple_names}"}</code> etc. are
          filled in per-recipient when you send.
        </p>
      </div>
    </div>
  );
}
