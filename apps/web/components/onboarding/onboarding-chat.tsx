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
import type {
  IntakeChatMessage,
  IntakeExtractedData,
} from "@/lib/autopilot-types";

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
            content:
              "Congrats on the engagement! I'm your wedding-os planning host. To start — what are your two names?",
            ts: new Date().toISOString(),
          },
        ],
  );
  const [extracted, setExtracted] =
    useState<IntakeExtractedData>(initialExtracted);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending, complete]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || complete) return;
    setSending(true);
    setDraft("");
    const ts = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, ts },
    ]);

    try {
      const res = await fetch("/api/onboarding/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          user_message: trimmed,
        }),
      });
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
      toast.error((e as Error).message);
      // Roll back the optimistic user message so they can retry without dup
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
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
      <Card className="flex h-[640px] flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col gap-3 p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-6">
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
              {sending && <Bubble role="assistant" content="…" pulsing />}
              {complete && (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-rose-50 p-5 text-center shadow-sm">
                  <PartyPopper className="mx-auto mb-2 h-8 w-8 text-rose-600" />
                  <div className="font-serif text-2xl text-stone-900">
                    Got everything we need
                  </div>
                  <p className="mt-1 text-sm text-stone-600">
                    I'll pre-populate your dashboard, your first-month
                    checklist, and a starter budget. Takes one click.
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

          {/* Composer — hidden once complete */}
          {!complete && (
            <div className="border-t border-stone-200 bg-white p-3">
              <div className="flex gap-2">
                <Textarea
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
                  className="resize-none text-base"
                  disabled={sending}
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={() => send(draft)}
                  disabled={sending || !draft.trim()}
                  className="self-end"
                  size="lg"
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
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
              matters. Visit{" "}
              <a
                href="/?skip-onboarding=1"
                className="text-rose-700 underline-offset-2 hover:underline"
              >
                /?skip-onboarding=1
              </a>{" "}
              to bypass entirely.
            </p>
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
