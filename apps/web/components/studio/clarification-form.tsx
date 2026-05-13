"use client";

// Studio — shared clarification form.
//
// Renders an array of ClarificationQuestion rows with chip-style option
// selectors + a free-text "Other" fallback when allow_other is true.
// The active option is pre-selected (bg-stone-900 text-white); other
// options border-stone-300 hover:border-stone-900.
//
// Used by mood-board today; future tools (cake, florals, venue mockup)
// will reuse this component.

import { useEffect, useState } from "react";
import type { ClarificationQuestion } from "@/lib/studio/types";

interface Props {
  questions: ClarificationQuestion[];
  answers: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

const OTHER_SENTINEL = "__other__";

export function ClarificationForm({ questions, answers, onChange }: Props) {
  // Track per-question "other text" separately so the chip toggle
  // doesn't lose what the user typed.
  const [otherText, setOtherText] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const q of questions) {
      const cur = answers[q.id];
      const isPreset = q.options.some((o) => o.value === cur);
      if (cur && !isPreset) seed[q.id] = cur;
    }
    return seed;
  });

  // Reset otherText when questions change (new clarify response).
  useEffect(() => {
    setOtherText({});
  }, [questions]);

  function pickPreset(qId: string, value: string) {
    const next = { ...answers, [qId]: value };
    onChange(next);
  }

  function pickOther(qId: string) {
    const cur = otherText[qId] ?? "";
    const next = { ...answers, [qId]: cur };
    onChange(next);
  }

  function updateOtherText(qId: string, text: string) {
    const nextOther = { ...otherText, [qId]: text };
    setOtherText(nextOther);
    // If "Other" is currently selected for this question, propagate
    // immediately so the parent's answers map stays in sync.
    const cur = answers[qId];
    const isPreset = questions
      .find((q) => q.id === qId)
      ?.options.some((o) => o.value === cur);
    if (!isPreset) {
      onChange({ ...answers, [qId]: text });
    }
  }

  return (
    <div className="space-y-5">
      {questions.map((q) => {
        const cur = answers[q.id];
        const isPreset = q.options.some((o) => o.value === cur);
        const otherActive = q.allow_other && cur !== undefined && !isPreset;

        return (
          <div
            key={q.id}
            className="space-y-2 rounded-3xl border border-stone-200 bg-white/70 p-5"
          >
            <div>
              <h3 className="font-serif text-base font-medium text-stone-900">
                {q.label}
              </h3>
              {q.hint && (
                <p className="mt-0.5 text-xs text-stone-500">{q.hint}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const active = !otherActive && cur === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => pickPreset(q.id, opt.value)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-300 bg-white text-stone-700 hover:border-stone-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}

              {q.allow_other && (
                <button
                  type="button"
                  onClick={() => pickOther(q.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    otherActive
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:border-stone-900"
                  }`}
                  data-other-toggle={q.id}
                >
                  {otherActive ? "Other ✓" : "Other"}
                </button>
              )}
            </div>

            {q.allow_other && otherActive && (
              <input
                type="text"
                value={otherText[q.id] ?? ""}
                onChange={(e) => updateOtherText(q.id, e.target.value)}
                placeholder="Type your own…"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Used by the parent to detect "other" mode purely from the answer
// string vs the canonical options. Exported for tests + future tools.
export function isOtherAnswer(
  question: ClarificationQuestion,
  answer: string | undefined,
): boolean {
  if (!answer) return false;
  return !question.options.some((o) => o.value === answer);
}

export { OTHER_SENTINEL };
