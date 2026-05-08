"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@wedding-os/db";

type Question = Database["public"]["Tables"]["venue_questions"]["Row"] & {
  asked_by_user?: { email: string } | null;
  answered_by_user?: { email: string } | null;
};

export function QATab({
  venueId,
  userId,
  role,
  initialQuestions,
}: {
  venueId: string;
  userId: string;
  role: "admin" | "couple" | null;
  initialQuestions: Question[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({});

  const handleAsk = async () => {
    const text = body.trim();
    if (!text) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from("venue_questions").insert({
      venue_id: venueId,
      asked_by: userId,
      body: text,
    });
    setBody("");
    setSubmitting(false);
    router.refresh();
  };

  const submitAnswer = async (q: Question) => {
    const text = (answerDraft[q.id] ?? q.answer ?? "").trim();
    if (!text) return;
    const supabase = createClient();
    await supabase
      .from("venue_questions")
      .update({
        answer: text,
        answered_by: userId,
        answered_at: new Date().toISOString(),
        status: "answered",
      })
      .eq("id", q.id);
    setAnswerDraft((d) => {
      const next = { ...d };
      delete next[q.id];
      return next;
    });
    router.refresh();
  };

  const reopen = async (q: Question) => {
    const supabase = createClient();
    await supabase.from("venue_questions").update({ status: "open" }).eq("id", q.id);
    router.refresh();
  };

  const remove = async (q: Question) => {
    if (!confirm("Delete this question?")) return;
    const supabase = createClient();
    await supabase.from("venue_questions").delete().eq("id", q.id);
    router.refresh();
  };

  const open = initialQuestions.filter((q) => q.status === "open");
  const answered = initialQuestions.filter((q) => q.status === "answered");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {initialQuestions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No questions yet. Drop one in the composer →
            </CardContent>
          </Card>
        ) : (
          <>
            {open.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg">Open · {open.length}</h3>
                </div>
                {open.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    userId={userId}
                    role={role}
                    answerDraft={answerDraft[q.id] ?? ""}
                    onAnswerChange={(v) =>
                      setAnswerDraft((d) => ({ ...d, [q.id]: v }))
                    }
                    onAnswer={() => submitAnswer(q)}
                    onReopen={() => reopen(q)}
                    onRemove={() => remove(q)}
                  />
                ))}
              </section>
            )}

            {answered.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg">Answered · {answered.length}</h3>
                </div>
                {answered.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    userId={userId}
                    role={role}
                    answerDraft={answerDraft[q.id] ?? ""}
                    onAnswerChange={(v) =>
                      setAnswerDraft((d) => ({ ...d, [q.id]: v }))
                    }
                    onAnswer={() => submitAnswer(q)}
                    onReopen={() => reopen(q)}
                    onRemove={() => remove(q)}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardContent className="space-y-3 py-4">
          <div>
            <h3 className="font-serif text-lg">Ask a question</h3>
            <p className="text-xs text-muted-foreground">
              Anyone can ask; planner answers. Tracked here so nothing slips through your planner's
              WhatsApp threads.
            </p>
          </div>
          <Textarea
            placeholder="Mandap setup — included or extra? · Service charge on top? · DJ from outside Spain ok?"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button onClick={handleAsk} disabled={submitting || !body.trim()} className="w-full">
            {submitting ? "Posting…" : "Post question"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionCard({
  q,
  userId,
  role,
  answerDraft,
  onAnswerChange,
  onAnswer,
  onReopen,
  onRemove,
}: {
  q: Question;
  userId: string;
  role: "admin" | "couple" | null;
  answerDraft: string;
  onAnswerChange: (v: string) => void;
  onAnswer: () => void;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const isAnswered = q.status === "answered";
  const canEdit = q.asked_by === userId || role === "admin";

  return (
    <Card className={cn(isAnswered && "opacity-90")}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "mt-1 h-2 w-2 shrink-0 rounded-full",
                isAnswered ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            <div className="flex-1">
              <p className="whitespace-pre-wrap text-sm font-medium">{q.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {q.asked_by_user?.email ?? "Unknown"} ·{" "}
                {format(parseISO(q.created_at), "PP")}
              </p>
            </div>
          </div>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete question"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {q.answer && !editing ? (
          <div className="rounded-md border bg-secondary/40 p-3 text-sm">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-stone-500">
              <Badge variant="success" className="text-[10px]">
                <Check className="h-3 w-3" />
              </Badge>
              <span>
                Answered by {q.answered_by_user?.email ?? "Unknown"}
                {q.answered_at && <> · {format(parseISO(q.answered_at), "PP")}</>}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{q.answer}</p>
          </div>
        ) : null}

        {editing || (!isAnswered && !q.answer) ? (
          <div className="space-y-2">
            <Textarea
              rows={3}
              placeholder={
                q.answer ? "Edit the answer…" : "Answer this question…"
              }
              value={answerDraft || q.answer || ""}
              onChange={(e) => onAnswerChange(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onAnswer();
                  setEditing(false);
                }}
                disabled={!(answerDraft || "").trim()}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {q.answer ? "Update answer" : "Post answer"}
              </Button>
              {editing && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : (
          isAnswered && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onAnswerChange(q.answer ?? "");
                  setEditing(true);
                }}
              >
                Edit answer
              </Button>
              <Button size="sm" variant="ghost" onClick={onReopen}>
                Re-open question
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
