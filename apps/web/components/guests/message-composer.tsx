"use client";

// Three-pane guest messaging composer.
//   LEFT   — segment picker (RSVP / side / has-email filters + live count)
//   CENTER — subject + body, AI draft, template dropdown, preview
//   RIGHT  — last 10 guest_messages campaigns
//
// Stacks on mobile.

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  AlertTriangle,
  Eye,
  Mail,
  RefreshCcw,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RSVP_LABEL,
  RSVP_STATUSES,
  SIDE_LABEL,
  type GuestSide,
  type RsvpStatus,
} from "@/lib/guest-types";
import type { EmailKind } from "@/lib/email-templates";
import type { GuestMessageRow } from "@/lib/tier1-types";
import { MessageHistory } from "@/components/guests/message-history";
import { cn } from "@/lib/utils";

type RsvpFilter = "all" | RsvpStatus;
type SideFilter = "all" | GuestSide;
type HasEmailFilter = "all" | "yes" | "no";

interface GuestRowLite {
  id: string;
  full_name: string;
  email: string | null;
  side: GuestSide | null;
  overall_rsvp: RsvpStatus;
}

// Built-in templates the dropdown offers as quick-fills. AI drafting still
// uses /api/email/draft for richer context-aware copy.
type TemplateKey =
  | "custom"
  | "save_the_date"
  | "rsvp_nudge"
  | "hotel_block"
  | "general_update";

const TEMPLATES: Record<
  TemplateKey,
  { label: string; kind: EmailKind; subject: string; body: string }
> = {
  custom: {
    label: "Custom (blank)",
    kind: "guest_update",
    subject: "",
    body: "",
  },
  save_the_date: {
    label: "Save the date",
    kind: "guest_save_the_date",
    subject: "Save the date — {couple_name}",
    body:
      "Hi {first_name},\n\nWe're getting married! Save the date — formal invitations and travel details are on the way.\n\nWith love,\n{couple_name}",
  },
  rsvp_nudge: {
    label: "RSVP nudge",
    kind: "guest_rsvp_nudge",
    subject: "Quick nudge — RSVP for {couple_name}'s wedding",
    body:
      "Hi {first_name},\n\nWe're finalising the catering count this week and noticed we haven't heard back from you yet. Could you let us know if you'll be joining us? Reply to this email or use the RSVP link we sent earlier.\n\nLet us know if you have any questions about travel or accommodation — happy to help.\n\nWith love,\n{couple_name}",
  },
  hotel_block: {
    label: "Hotel block reminder",
    kind: "guest_update",
    subject: "Hotel block details — {couple_name}'s wedding",
    body:
      "Hi {first_name},\n\nA quick reminder that we have a room block for our wedding weekend. To get the negotiated rate, please book through the link in our wedding website before the cut-off date.\n\nLet us know if you need help — we're happy to coordinate.\n\nWith love,\n{couple_name}",
  },
  general_update: {
    label: "General update",
    kind: "guest_update",
    subject: "An update from {couple_name}",
    body:
      "Hi {first_name},\n\nA quick update on the wedding — \n\n- \n- \n- \n\nLet us know if you have any questions.\n\nWith love,\n{couple_name}",
  },
};

export function MessageComposer({
  guests,
  history,
  workspaceName,
}: {
  guests: GuestRowLite[];
  history: GuestMessageRow[];
  workspaceName: string | null;
}) {
  // Segment filters
  const [rsvp, setRsvp] = useState<RsvpFilter>("all");
  const [side, setSide] = useState<SideFilter>("all");
  const [hasEmail, setHasEmail] = useState<HasEmailFilter>("yes");

  // Compose state
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [kind, setKind] = useState<EmailKind>("guest_update");
  const [template, setTemplate] = useState<TemplateKey>("custom");

  // UX state
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Live count of eligible recipients
  const matched = useMemo(() => {
    return guests.filter((g) => {
      if (rsvp !== "all" && g.overall_rsvp !== rsvp) return false;
      if (side !== "all" && g.side !== side) return false;
      const has = !!(g.email && g.email.trim().length > 0);
      if (hasEmail === "yes" && !has) return false;
      if (hasEmail === "no" && has) return false;
      return true;
    });
  }, [guests, rsvp, side, hasEmail]);

  // Recipients we'd actually send to (must have email regardless of UI filter)
  const sendable = useMemo(
    () => matched.filter((g) => !!(g.email && g.email.trim().length > 0)),
    [matched],
  );

  // First sendable guest used for "preview as one guest"
  const previewGuest = sendable[0] ?? guests.find((g) => g.email) ?? null;

  const coupleName = deriveCoupleName(workspaceName);

  const handleTemplateChange = (key: TemplateKey) => {
    setTemplate(key);
    const t = TEMPLATES[key];
    setKind(t.kind);
    if (key !== "custom") {
      setSubject(t.subject);
      setBody(t.body);
    }
  };

  const handleAiDraft = async () => {
    setDrafting(true);
    try {
      const guestFilter: {
        side?: "groom" | "bride" | "both";
        rsvp?: "pending" | "yes" | "no" | "maybe";
      } = {};
      if (side !== "all") guestFilter.side = side;
      if (rsvp !== "all") guestFilter.rsvp = rsvp;

      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          guest_filter: Object.keys(guestFilter).length ? guestFilter : undefined,
          user_brief: subject || body
            ? `User has already started: subject="${subject}", current body="${body.slice(0, 200)}". Respect their direction; expand & polish.`
            : undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Draft failed (${res.status})`);
      }
      const data = (await res.json()) as { subject: string; body: string };
      setSubject(data.subject);
      setBody(data.body);
      toast.success("Claude wrote a draft. Review before sending.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/guests/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          kind,
          channel: "email",
          segment_filter: { rsvp, side, has_email: hasEmail },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered_count?: number;
        recipient_count?: number;
        bounced_count?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Send failed (${res.status})`);
      toast.success(
        `Sent to ${data.delivered_count ?? 0} of ${data.recipient_count ?? 0} guests${
          data.bounced_count ? ` · ${data.bounced_count} failed` : ""
        }`,
      );
      setConfirmOpen(false);
      // Force a reload so the history pane picks up the new row from the server.
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const canSend =
    subject.trim().length > 0 && body.trim().length > 0 && sendable.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      {/* LEFT — Segment picker */}
      <aside className="space-y-4">
        <SegmentCard
          label="RSVP status"
          value={rsvp}
          onChange={(v) => setRsvp(v as RsvpFilter)}
          options={[
            { value: "all", label: "All" },
            ...RSVP_STATUSES.map((r) => ({ value: r, label: RSVP_LABEL[r] })),
          ]}
        />
        <SegmentCard
          label="Side"
          value={side}
          onChange={(v) => setSide(v as SideFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "bride", label: SIDE_LABEL.bride },
            { value: "groom", label: SIDE_LABEL.groom },
            { value: "both", label: SIDE_LABEL.both },
          ]}
        />
        <SegmentCard
          label="Has email"
          value={hasEmail}
          onChange={(v) => setHasEmail(v as HasEmailFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
            <Users className="h-3 w-3" /> Recipients
          </div>
          <div className="mt-2 font-serif text-3xl font-light leading-none">
            {sendable.length}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Sending to {sendable.length} guest{sendable.length === 1 ? "" : "s"}
            {matched.length !== sendable.length
              ? ` (${matched.length - sendable.length} matched but no email)`
              : ""}
            .
          </p>
        </div>
      </aside>

      {/* CENTER — Compose */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
                Compose
              </div>
              <h2 className="font-serif text-2xl font-light">Your message</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  Template
                </Label>
                <Select
                  value={template}
                  onValueChange={(v) => handleTemplateChange(v as TemplateKey)}
                >
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {TEMPLATES[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAiDraft}
                disabled={drafting}
              >
                <Sparkles className={cn("h-4 w-4", drafting && "animate-pulse")} />
                {drafting ? "Drafting…" : "Draft with AI"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                disabled={!subject && !body}
              >
                <Eye className="h-4 w-4" /> Preview
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Save the date — {couple_name}"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Body</Label>
                <span className="text-[10px] text-stone-500">
                  Tokens: {"{first_name}"} · {"{full_name}"} · {"{couple_name}"}
                </span>
              </div>
              <Textarea
                id="body"
                rows={14}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-sm leading-relaxed"
                placeholder="Hi {first_name}, …"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
            <div className="text-xs text-stone-500">
              Each guest gets their own personalised copy. Tokens are filled in
              per recipient at send time.
            </div>
            <Button
              size="lg"
              onClick={() => setConfirmOpen(true)}
              disabled={!canSend || sending}
            >
              <Send className="h-4 w-4" />
              Send to {sendable.length} guest{sendable.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </section>

      {/* RIGHT — History */}
      <aside>
        <MessageHistory rows={history} />
      </aside>

      {/* Preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Preview
            </DialogTitle>
            <DialogDescription>
              {previewGuest
                ? `As one of your guests would see it — ${previewGuest.full_name} (${previewGuest.email ?? "no email"})`
                : "Pick a segment with at least one guest to preview."}
            </DialogDescription>
          </DialogHeader>
          {previewGuest ? (
            <div className="space-y-3">
              <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm">
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  Subject
                </div>
                <div className="mt-1 font-medium">
                  {applyTokens(subject, previewGuest, coupleName)}
                </div>
              </div>
              <div className="rounded-md border border-stone-200 bg-white p-4 text-sm leading-relaxed">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>
                    {applyTokens(body, previewGuest, coupleName)}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No matching guests in current segment.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm send modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Send to {sendable.length} guest{sendable.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              Each will receive their own copy. This can&apos;t be undone — make
              sure the subject and body look right.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Segment
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="muted">RSVP: {rsvpLabel(rsvp)}</Badge>
                <Badge variant="muted">Side: {sideLabel(side)}</Badge>
                <Badge variant="muted">
                  Has email: {hasEmail === "all" ? "Any" : hasEmail === "yes" ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Subject
              </div>
              <div className="mt-1 font-medium">{subject}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <>
                  <RefreshCcw className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Confirm send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SegmentCard({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── token + helper utils (kept here so the component is self-contained) ──

function applyTokens(
  text: string,
  guest: GuestRowLite,
  coupleName: string,
): string {
  const fullName = guest.full_name ?? "";
  const firstName = fullName.split(/\s+/)[0] ?? fullName;
  return text
    .split("{first_name}")
    .join(firstName)
    .split("{full_name}")
    .join(fullName)
    .split("{couple_name}")
    .join(coupleName);
}

function deriveCoupleName(workspaceName: string | null | undefined): string {
  if (!workspaceName) return "the couple";
  for (const sep of [" — ", " – ", " - "]) {
    const idx = workspaceName.indexOf(sep);
    if (idx > 0) return workspaceName.slice(0, idx).trim();
  }
  return workspaceName.trim();
}

function rsvpLabel(v: RsvpFilter): string {
  if (v === "all") return "All";
  return RSVP_LABEL[v];
}

function sideLabel(v: SideFilter): string {
  if (v === "all") return "All";
  return SIDE_LABEL[v];
}
