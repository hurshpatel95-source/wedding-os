"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, Check, PartyPopper, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, currencySymbol } from "@/lib/utils";
import {
  BUDGET_CATEGORY_LABEL,
  type BudgetCategory,
  type IntakeChatMessage,
  type IntakeExtractedData,
} from "@/lib/autopilot-types";

// First-message copy. Centralised so we can swap it in one place + use a
// friendlier greeting when we already know one of the partner names (e.g.
// returning to /onboarding mid-session). Keep this short and warm — it's
// the first words a new B2C couple sees post-signup.
function buildGreeting(partnerAName?: string | null): string {
  const name = partnerAName?.trim();
  if (name) {
    return `Hi ${name}! Welcome back — let's pick up where we left off. Tell me a bit more about your wedding: date, place, vibe, anything you've already locked in. The more you share, the more I can pre-populate for you.`;
  }
  return "Hi! Congrats on the engagement — I'm so excited to help you plan. Tell me a bit about your wedding: your names, a date if you have one, where you're thinking, and any vibe or vendors you've already locked in. Share as much or as little as feels right and I'll take it from there.";
}

interface FieldChip {
  key: keyof IntakeExtractedData;
  label: string;
}

// Order matters — this drives the "What we know so far" sidebar, top→bottom.
const FIELD_CHIPS: FieldChip[] = [
  { key: "partner_a_name", label: "Partner A" },
  { key: "partner_b_name", label: "Partner B" },
  { key: "wedding_date", label: "Date" },
  { key: "wedding_region", label: "Region" },
  { key: "venue_name", label: "Venue" },
  { key: "guest_count_estimate", label: "Guest count" },
  { key: "budget_target_eur", label: "Budget" },
  { key: "style_tags", label: "Style" },
  { key: "top_concerns", label: "Concerns" },
  { key: "first_priority_category", label: "First priority" },
];

function valuePresent(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return true;
  return Boolean(v);
}

function chipDisplayValue(
  key: keyof IntakeExtractedData,
  v: IntakeExtractedData[keyof IntakeExtractedData],
  budgetSymbol: string,
): string {
  if (!valuePresent(v)) return "";
  if (Array.isArray(v)) return v.slice(0, 2).join(", ");
  if (key === "budget_target_eur" && typeof v === "number")
    return `${budgetSymbol}${v.toLocaleString()}`;
  if (key === "guest_count_estimate" && typeof v === "number")
    return String(v);
  if (key === "first_priority_category" && typeof v === "string") {
    // Show the human-readable label instead of the snake_case key. Falls
    // back to the raw value if the category isn't in our label map yet.
    const label = BUDGET_CATEGORY_LABEL[v as BudgetCategory];
    return label ?? String(v);
  }
  return String(v);
}

export function OnboardingChat({
  sessionId,
  initialMessages,
  initialExtracted,
  workspaceName,
  baseCurrency = "USD",
}: {
  sessionId: string;
  initialMessages: IntakeChatMessage[];
  initialExtracted: IntakeExtractedData;
  workspaceName: string;
  baseCurrency?: string;
}) {
  const budgetSymbol = currencySymbol(baseCurrency);
  const router = useRouter();
  const [messages, setMessages] = useState<IntakeChatMessage[]>(
    initialMessages.length > 0
      ? initialMessages
      : [
          {
            role: "assistant",
            content: buildGreeting(initialExtracted.partner_a_name),
            ts: new Date().toISOString(),
          },
        ],
  );
  const [extracted, setExtracted] =
    useState<IntakeExtractedData>(initialExtracted);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Soft "reconnecting" indicator — kicks in if a turn takes longer than
  // ~3s. The first onboarding request often hits a cold Anthropic / DB
  // path and we'd rather show a calm "reconnecting…" hint than let the
  // user stare at the spinner wondering if anything's happening.
  const [reconnecting, setReconnecting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  // Cached last user message so a failed turn can be retried in-place
  // without the user re-typing.
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending, complete]);

  // After a turn finishes (success or fail), put focus back on the
  // composer so the couple can keep going without reaching for the mouse.
  useEffect(() => {
    if (!sending && !complete) {
      textareaRef.current?.focus();
    }
  }, [sending, complete]);

  // Onboarding turns can take 10-30s on cold start (Anthropic + DB writes).
  // We retry once on a generic network blip ("Failed to fetch") before
  // surfacing a toast — that hides the most common false-alarm UX.
  const callTurn = async (msg: string): Promise<Response> => {
    return fetch("/api/onboarding/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, user_message: msg }),
    });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || complete) return;
    setSending(true);
    setLastFailedMessage(null);
    setDraft("");
    const ts = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, ts },
    ]);

    // If the turn is still pending after a few seconds, flip on the
    // soft "reconnecting…" indicator. Most cold-start blips resolve in
    // 5-15s, so we want this visible but unalarming.
    const slowTimer = window.setTimeout(() => setReconnecting(true), 3000);

    try {
      let res: Response;
      try {
        res = await callTurn(trimmed);
      } catch (netErr) {
        // Browser threw before getting a response — almost always a cold-
        // start hiccup. One silent retry, then surface if it still fails.
        const m = (netErr as Error).message;
        if (/failed to fetch|networkerror|load failed/i.test(m)) {
          setReconnecting(true);
          await new Promise((r) => setTimeout(r, 800));
          res = await callTurn(trimmed);
        } else {
          throw netErr;
        }
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Onboarding failed (${res.status})`);
      }
      const data = (await res.json()) as {
        message: string;
        extracted_patch: Record<string, unknown>;
        complete: boolean;
      };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          ts: new Date().toISOString(),
        },
      ]);
      setExtracted((prev) => ({
        ...prev,
        ...(data.extracted_patch as IntakeExtractedData),
      }));
      if (data.complete) setComplete(true);
    } catch (e) {
      const m = (e as Error).message ?? "";
      // Map raw error strings to friendlier copy. We keep server-supplied
      // messages (quota, validation, etc.) but rewrite the generic
      // network/connection ones.
      const friendly = /failed to fetch|networkerror|load failed/i.test(m)
        ? "Connection hiccup — your message wasn't sent. Tap retry to try again."
        : /claude error|503|502|504/i.test(m)
        ? "Our planning AI is briefly unreachable. Tap retry in a moment."
        : m || "Something went wrong. Tap retry to try again.";
      toast.error(friendly);
      // Roll back the optimistic user message AND restore the draft so
      // the user can either tweak + send, or use the inline Retry button.
      setMessages((prev) => prev.slice(0, -1));
      setDraft(trimmed);
      setLastFailedMessage(trimmed);
    } finally {
      window.clearTimeout(slowTimer);
      setReconnecting(false);
      setSending(false);
    }
  };

  const retryLast = () => {
    if (!lastFailedMessage || sending) return;
    send(lastFailedMessage);
  };

  const finish = async () => {
    if (finalizing) return;
    setFinalizing(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Couldn't finalize (${res.status})`);
      }
      // Redirect home — dashboard will now skip the onboarding redirect.
      router.replace("/?just-onboarded=1");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setFinalizing(false);
    }
  };

  const filledCount = FIELD_CHIPS.filter((f) =>
    valuePresent(extracted[f.key]),
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
      <Card className="flex h-[calc(100dvh-220px)] min-h-[520px] flex-col overflow-hidden md:h-[640px]">
        <CardContent className="flex flex-1 flex-col gap-3 p-0">
          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-6 md:px-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Onboarding conversation"
          >
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <div className="text-center">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-rose-500" />
                  Say hi to get started.
                </div>
              </div>
            )}
            <div className="space-y-4">
              {messages.map((m, i) => (
                <Bubble
                  key={`${m.ts}-${i}`}
                  role={m.role}
                  content={m.content}
                />
              ))}
              {sending && <TypingBubble reconnecting={reconnecting} />}
              {lastFailedMessage && !sending && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                >
                  <span>
                    Your last message didn't go through. Your draft is still in
                    the box below.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={retryLast}
                    className="h-7 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                  >
                    Retry
                  </Button>
                </div>
              )}
              {complete && (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-rose-50 p-5 text-center shadow-sm">
                  <PartyPopper className="mx-auto mb-2 h-8 w-8 text-rose-600" />
                  <div className="font-serif text-2xl text-stone-900">
                    Got everything we need
                  </div>
                  <p className="mt-1 text-sm text-stone-600">
                    I'll pre-populate your dashboard, your first-month
                    checklist, and a starter budget. From there, your budget
                    page is the natural next stop.
                  </p>
                  <Button
                    onClick={finish}
                    disabled={finalizing}
                    className="mt-4"
                    size="lg"
                  >
                    {finalizing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Setting up your workspace…
                      </>
                    ) : (
                      <>Take me to my dashboard</>
                    )}
                  </Button>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </div>

          {/* Mobile-only progress bar — keeps the signal visible above the composer */}
          {!complete && (
            <div
              className="border-t border-stone-200 bg-white px-3 pt-2 md:hidden"
              aria-label={`Onboarding progress: ${filledCount} of ${FIELD_CHIPS.length}`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-stone-500">
                <span>
                  Onboarding progress · {filledCount} of {FIELD_CHIPS.length}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full bg-gradient-to-r from-rose-400 to-amber-500 transition-all"
                  style={{
                    width: `${Math.round(
                      (filledCount / FIELD_CHIPS.length) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Composer — hidden once complete */}
          {!complete && (
            <div className="border-t border-stone-200 bg-white p-3 max-md:border-t-0">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                  placeholder="Type your answer… Enter to send · Shift+Enter for newline"
                  className="resize-none text-base md:text-sm"
                  disabled={sending}
                  autoFocus
                  aria-label="Your answer"
                />
                <Button
                  type="button"
                  onClick={() => send(draft)}
                  disabled={sending || !draft.trim()}
                  className="self-end"
                  size="lg"
                  aria-label={sending ? "Sending message" : "Send message"}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {sending ? "Sending" : "Send"}
                  </span>
                </Button>
              </div>
              <div className="mt-1.5 flex h-4 items-center text-[11px] text-stone-500">
                {reconnecting && (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Reconnecting… first replies sometimes take a few extra
                    seconds.
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sidebar — what we know so far */}
      <div className="space-y-3">
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
              What we know so far
            </div>
            <div className="font-serif text-2xl font-light leading-none">
              {filledCount} / {FIELD_CHIPS.length}
            </div>
            <div className="text-xs text-stone-500">
              {workspaceName} · live as we chat
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-amber-500 transition-all"
                style={{
                  width: `${Math.round(
                    (filledCount / FIELD_CHIPS.length) * 100,
                  )}%`,
                }}
              />
            </div>
            <ul className="space-y-1.5 pt-1">
              {FIELD_CHIPS.map((f) => {
                const v = extracted[f.key];
                const filled = valuePresent(v);
                const display = chipDisplayValue(f.key, v, budgetSymbol);
                return (
                  <li
                    key={f.key}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition",
                      filled
                        ? "bg-emerald-50 text-stone-900"
                        : "text-stone-500",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
                        filled
                          ? "bg-emerald-600 text-white"
                          : "border border-stone-300",
                      )}
                    >
                      {filled && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{f.label}</div>
                      {filled && display && (
                        <div className="line-clamp-1 text-stone-600">
                          {display}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <Badge variant="muted" className="text-[10px]">
              Skip anytime
            </Badge>
            <p className="mt-2 text-xs text-stone-600">
              You can answer "skip" to anything. We'll ask later if it
              matters.
            </p>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-3 h-auto px-2 py-1 text-xs text-stone-700"
            >
              <a href="/?skip-onboarding=1">
                Skip for now (you can come back)
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  pulsing,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  pulsing?: boolean;
}) {
  const isUser = role === "user";
  if (role === "system") return null;
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-base leading-relaxed",
          isUser
            ? "bg-stone-900 text-stone-50"
            : "border border-stone-200 bg-white text-stone-900",
          pulsing && "animate-pulse",
        )}
      >
        {content}
      </div>
    </div>
  );
}

// Animated 3-dot typing indicator. Replaces the old pulsing "…" string —
// reads as more conversational and signals "I'm thinking" rather than
// "the UI is stuck".
function TypingBubble({ reconnecting }: { reconnecting: boolean }) {
  return (
    <div className="flex justify-start" aria-live="polite">
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-500">
        <span className="sr-only">
          {reconnecting ? "Reconnecting" : "Assistant is typing"}
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
        </span>
      </div>
    </div>
  );
}
