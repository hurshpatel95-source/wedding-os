"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, AlertTriangle, Trash2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  content: string;
}

const QUICK_ACTIONS = [
  "What's our biggest open task right now?",
  "What should we tackle this month?",
  "How are we tracking vs our budget?",
  "Which vendors do we still need to book?",
  "Who hasn't RSVP'd yet?",
  "What's the next deposit due?",
];

const DAILY_CAP = 30;

interface ConversationListItem {
  id: string;
  preview: string;
  updated_at: string;
}

export function AssistantChat({
  initialConversationId,
  initialMessages,
  initialDailyUsed,
  conversations,
}: {
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
  initialDailyUsed: number;
  conversations: ConversationListItem[];
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyUsed, setDailyUsed] = useState<number>(initialDailyUsed);
  const [costToday, setCostToday] = useState<number>(0);
  // Audit #35: confirm dialog replaces native confirm() for "Delete this thread".
  const [clearOpen, setClearOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    if (dailyUsed >= DAILY_CAP) {
      setError(`Daily cap reached (${DAILY_CAP}). Resets at midnight UTC.`);
      return;
    }

    setSending(true);
    setError(null);
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_message: message,
        }),
      });
      if (res.status === 429) {
        const j = await res.json();
        setError(j.error ?? "Daily cap reached");
        setSending(false);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Chat failed (${res.status})`);
      }
      const data = (await res.json()) as {
        conversation_id: string;
        reply: string;
        daily: { used: number; cost_usd_today: number };
      };
      if (!conversationId) setConversationId(data.conversation_id);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setDailyUsed(data.daily.used);
      setCostToday(data.daily.cost_usd_today);
    } catch (e) {
      setError((e as Error).message);
      // Roll back the optimistic user message so they can retry without dup
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const newConversation = async () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  };

  const clearAll = async () => {
    if (!conversationId) return;
    const supabase = createClient();
    await supabase.from("ai_conversations").delete().eq("id", conversationId);
    setConversationId(null);
    setMessages([]);
    router.refresh();
  };

  const remainingPct = Math.round(
    Math.min(100, ((DAILY_CAP - dailyUsed) / DAILY_CAP) * 100),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="flex h-[640px] flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col gap-3 p-0">
          {/* Quick actions strip — only show on empty thread */}
          {messages.length === 0 && (
            <div className="border-b border-stone-200 bg-stone-50/50 p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
                Try one of these
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    disabled={sending}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <div className="text-center">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-rose-500" />
                  Ask anything about your wedding.
                </div>
              </div>
            )}
            <div className="space-y-3">
              {messages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content} />
              ))}
              {sending && (
                <MessageBubble role="assistant" content="…" pulsing />
              )}
              <div ref={scrollRef} />
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}

          {/* Composer */}
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
                placeholder="Ask the co-pilot — Enter to send · Shift+Enter for newline"
                className="resize-none"
                disabled={sending || dailyUsed >= DAILY_CAP}
              />
              <div className="flex flex-col items-end gap-1 self-end">
                <Button
                  type="button"
                  onClick={() => send(draft)}
                  disabled={sending || !draft.trim() || dailyUsed >= DAILY_CAP}
                  // Audit #33: match the onboarding-chat pattern for a11y.
                  aria-label={sending ? "Sending message" : "Send message"}
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
                {/*
                  Audit #34: inline usage chip so couples on mobile (lg sidebar
                  collapsed) still see their daily quota next to the composer.
                */}
                {Number.isFinite(dailyUsed) && (
                  <span className="text-[10px] uppercase tracking-wide text-stone-500">
                    {dailyUsed}/{DAILY_CAP} today
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sidebar — usage, controls */}
      <div className="space-y-3">
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
              Today's usage
            </div>
            <div>
              <div className="font-serif text-3xl font-light leading-none">
                {dailyUsed} / {DAILY_CAP}
              </div>
              <div className="mt-1 text-xs text-stone-500">
                messages · resets at midnight UTC
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className={cn(
                  "h-full transition-all",
                  remainingPct < 20
                    ? "bg-rose-500"
                    : remainingPct < 50
                    ? "bg-amber-500"
                    : "bg-emerald-500",
                )}
                style={{ width: `${100 - remainingPct}%` }}
              />
            </div>
            {costToday > 0 && (
              <div className="text-[11px] text-stone-500">
                Cost today: <span className="font-medium">${costToday.toFixed(4)}</span>
              </div>
            )}
            <div className="rounded-md border border-stone-200 bg-stone-50 p-2 text-[10px] text-stone-600">
              <strong>Cost guardrails:</strong> workspace context is cached so most messages are
              pennies. Daily cap protects against runaway use.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={newConversation}
              disabled={sending}
              className="w-full"
            >
              <Plus className="h-4 w-4" /> New conversation
            </Button>
            {conversationId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearOpen(true)}
                disabled={sending}
                className="w-full text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Delete this thread
              </Button>
            )}
          </CardContent>
        </Card>

        {conversations.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-stone-500">
                Recent threads
              </div>
              <ul className="space-y-1">
                {conversations.map((c) => {
                  const active = c.id === conversationId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (active) return;
                          // Server reads ?conversation= and renders the
                          // requested thread. router.push triggers refresh.
                          router.push(`/assistant?conversation=${c.id}`);
                        }}
                        className={cn(
                          "block w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                          active
                            ? "border-rose-300 bg-rose-50/60 text-stone-900"
                            : "border-stone-100 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50",
                        )}
                      >
                        <div className="line-clamp-2 leading-snug">
                          {c.preview}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-stone-400">
                          {relativeTime(c.updated_at)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
              What it knows
            </div>
            <ul className="mt-2 space-y-1 text-xs text-stone-600">
              <li>· Every venue + status + hire fees</li>
              <li>· Every vendor + quote + deposit status</li>
              <li>· All saved scenarios + grand totals</li>
              <li>· Guest list + RSVP counts</li>
              <li>· Plan progress (% done across your tasks)</li>
              <li>· Wedding date countdown</li>
            </ul>
            <Badge variant="muted" className="mt-3 text-[10px]">
              Context refreshes every turn
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Clear-conversation confirm dialog (audit #35) */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this conversation?</DialogTitle>
            <DialogDescription>
              All messages will be deleted. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setClearOpen(false);
                void clearAll();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function relativeTime(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    const min = Math.round(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.round(hr / 24);
    if (d < 7) return `${d}d ago`;
    const w = Math.round(d / 7);
    if (w < 5) return `${w}w ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

function MessageBubble({
  role,
  content,
  pulsing,
}: {
  role: ChatRole;
  content: string;
  pulsing?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "whitespace-pre-wrap bg-stone-900 text-stone-50"
            : "border border-stone-200 bg-white text-stone-900",
          pulsing && "animate-pulse",
        )}
      >
        {isUser ? content : <Markdown content={content} />}
      </div>
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body space-y-2 [&_a]:text-rose-700 [&_a]:underline [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_h3]:mt-2 [&_h3]:font-serif [&_h3]:text-base [&_h3]:font-medium [&_h4]:mt-2 [&_h4]:text-sm [&_h4]:font-semibold [&_li]:my-0.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-stone-100 [&_pre]:p-2 [&_pre]:text-[12px] [&_strong]:font-semibold [&_table]:my-2 [&_table]:text-xs [&_td]:border [&_td]:border-stone-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-stone-200 [&_th]:bg-stone-50 [&_th]:px-2 [&_th]:py-1 [&_ul]:ml-5 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Clamp h1/h2 down to h3-equivalent so the chat doesn't blow out
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
