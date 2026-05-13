"use client";

// Mood board — the two-stage studio UX.
//
// States: idle → clarifying → answering → generating → result | error.
//
// "Refine my prompt" submits the user_input to /api/studio/mood-board/
// clarify which returns the wedding-domain questions + a preview prompt.
// The user tweaks the answers (chip-style), then "Generate" hits
// /api/studio/mood-board/generate which finalizes the prompt + returns
// 6/12/24 placeholder images (or real Higgsfield once the env var lands).
//
// Credits are shown live; pre-Generate the user sees a clear "Costs N
// credits" preview. After-Generate they see balance_after returned by
// the server.

import { useMemo, useState } from "react";
import { Sparkles, RefreshCw, Loader2, AlertCircle, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClarificationForm } from "./clarification-form";
import type {
  ClarificationQuestion,
  StudioGenerationResult,
} from "@/lib/studio/types";

type Stage =
  | "idle"
  | "clarifying"
  | "answering"
  | "generating"
  | "result"
  | "error";

interface MoodBoardStudioProps {
  initialBalance: number;
  costCredits: number;
  isB2B: boolean;
}

interface ClarifyResponse {
  tool: string;
  questions: ClarificationQuestion[];
  preview_prompt: string;
}

interface GenerateResponse extends StudioGenerationResult {
  balance_after: number;
  was_stub?: boolean;
  error?: string;
  needed?: number;
  balance?: number;
}

const DENSITY_TO_VARIANT_COUNT: Record<string, number> = {
  curated_6: 6,
  inspiration_12: 12,
  decision_grid_24: 24,
};

export function MoodBoardStudio({
  initialBalance,
  costCredits,
  isB2B,
}: MoodBoardStudioProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [userInput, setUserInput] = useState("");
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(initialBalance);

  const canGenerate = useMemo(
    () => Object.keys(answers).length > 0 && stage !== "generating",
    [answers, stage],
  );
  const insufficient = !isB2B && balance < costCredits;

  async function handleRefine() {
    if (!userInput.trim()) {
      setError("Tell me what you want to see first.");
      setStage("error");
      return;
    }
    setError(null);
    setStage("clarifying");
    try {
      const r = await fetch("/api/studio/mood-board/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: userInput }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Refine failed (${r.status})`);
      }
      const data = (await r.json()) as ClarifyResponse;
      setQuestions(data.questions);
      // Seed answers with the default for each question — so the user
      // can "Generate" immediately without touching anything if they
      // like the inferred picks.
      const seeded: Record<string, string> = {};
      for (const q of data.questions) {
        if (q.default) seeded[q.id] = q.default;
      }
      setAnswers(seeded);
      setPreviewPrompt(data.preview_prompt);
      setStage("answering");
    } catch (err) {
      setError((err as Error).message);
      setStage("error");
    }
  }

  async function handleGenerate() {
    if (insufficient) {
      setError("Not enough credits.");
      setStage("error");
      return;
    }
    setError(null);
    setStage("generating");
    try {
      const densityChoice = answers["density"] ?? "inspiration_12";
      const variantCount = DENSITY_TO_VARIANT_COUNT[densityChoice] ?? 12;

      const r = await fetch("/api/studio/mood-board/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: userInput,
          answers,
          variant_count: variantCount,
        }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        if (r.status === 402) {
          throw new Error("Insufficient credits — top up to continue.");
        }
        throw new Error(body.error || `Generate failed (${r.status})`);
      }
      const data = (await r.json()) as GenerateResponse;
      setResult(data);
      if (typeof data.balance_after === "number") {
        setBalance(data.balance_after);
      }
      setStage("result");
    } catch (err) {
      setError((err as Error).message);
      setStage("error");
    }
  }

  function handleReset() {
    setStage("idle");
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError(null);
    setPreviewPrompt(null);
  }

  function handleRefineAgain() {
    // Keep userInput + answers, go back to answering stage.
    setError(null);
    setStage("answering");
  }

  // ── Stage: error ───────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50/60 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600" />
          <div className="space-y-1">
            <div className="font-medium text-rose-900">
              Something went wrong
            </div>
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleReset} variant="outline">
            Start over
          </Button>
          {questions.length > 0 && (
            <Button onClick={handleRefineAgain}>Back to questions</Button>
          )}
        </div>
      </div>
    );
  }

  // ── Stage: result ──────────────────────────────────────────────────
  if (stage === "result" && result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
            {result.was_stub
              ? "Preview renders · real generation activates with Higgsfield key"
              : "Generated"}
          </div>
          {!isB2B && (
            <div className="text-xs text-stone-500">
              {balance} credits remaining
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.variants.map((v, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${v.image_url}-${idx}`}
              src={v.image_url}
              alt={`Mood board variant ${idx + 1}`}
              className="aspect-video w-full rounded-2xl border border-stone-200 object-cover"
            />
          ))}
        </div>

        <details className="rounded-2xl border border-stone-200 bg-white/60 p-4">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-stone-500">
            Show optimized prompt
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">
            {result.optimized_prompt}
          </p>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleRefineAgain} variant="outline">
            <RefreshCw className="h-4 w-4" /> Refine
          </Button>
          <Button onClick={handleGenerate} disabled={insufficient}>
            <Sparkles className="h-4 w-4" /> Regenerate all
            {!isB2B && ` · ${costCredits} credits`}
          </Button>
          <Button onClick={handleReset} variant="ghost">
            Start over
          </Button>
        </div>
      </div>
    );
  }

  // ── Stage: generating ──────────────────────────────────────────────
  if (stage === "generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-stone-200 bg-white/70 p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        <div className="font-serif text-xl text-stone-800">
          Generating your mood board
        </div>
        <p className="max-w-md text-sm text-stone-500">
          Optimizing the prompt, then rendering variants. This takes about
          15 seconds.
        </p>
      </div>
    );
  }

  // ── Stage: clarifying (waiting for the API) ────────────────────────
  if (stage === "clarifying") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-stone-200 bg-white/70 p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        <div className="font-serif text-xl text-stone-800">
          Reading your wedding
        </div>
        <p className="max-w-md text-sm text-stone-500">
          Figuring out the right questions to ask based on your venue,
          season, and palette.
        </p>
      </div>
    );
  }

  // ── Stage: answering ───────────────────────────────────────────────
  if (stage === "answering") {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-stone-200 bg-white/70 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Your input
          </div>
          <p className="mt-2 text-sm text-stone-800">
            &ldquo;{userInput}&rdquo;
          </p>
        </div>

        <ClarificationForm
          questions={questions}
          answers={answers}
          onChange={setAnswers}
        />

        {previewPrompt && (
          <details className="rounded-2xl border border-stone-200 bg-white/60 p-4">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-stone-500">
              Show preview prompt
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">
              {previewPrompt}
            </p>
          </details>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-stone-500">
            {isB2B
              ? "Planner tier — no credit cost shown"
              : insufficient
                ? `Costs ${costCredits} credits · you have ${balance}. Top up to continue.`
                : `Costs ${costCredits} credits · you have ${balance}`}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleReset} variant="ghost">
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || insufficient}
            >
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Stage: idle ────────────────────────────────────────────────────
  return (
    <div className="space-y-4 rounded-3xl border border-stone-200 bg-white/70 p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
        <ImageIcon className="h-3.5 w-3.5" />
        Tell me what you want to see
      </div>
      <textarea
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        placeholder="e.g. moody fall garden wedding with deep burgundy florals and candlelit tablescapes"
        rows={4}
        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          We&apos;ll ask 3-5 quick questions to tune the result.
        </p>
        <Button onClick={handleRefine} disabled={!userInput.trim()}>
          <Sparkles className="h-4 w-4" />
          Refine my prompt
        </Button>
      </div>
    </div>
  );
}
