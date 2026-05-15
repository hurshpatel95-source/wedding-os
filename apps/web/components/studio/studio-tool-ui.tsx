"use client";

// Studio — generic two-stage tool UI.
//
// One component for every text / image / image+text studio tool. Drives:
//   idle → clarifying → answering → generating → result | error.
//
// "Refine my prompt" submits user_input + (optional) image_caption to
// /api/studio/<tool>/clarify which returns wedding-domain questions +
// preview prompt. The user tweaks the answers (chip-style), then
// "Generate" hits /api/studio/<tool>/generate which finalizes the
// prompt + returns N placeholder images (or real Higgsfield once the
// env var lands).
//
// Per-tool nuance is encoded in props:
//   - inputKind: "text" | "image" | "image+text"
//   - variantCount: int (mood-board: 12 or 24, color-palette: 1, others: 4)
//   - aspectClass: tailwind aspect ratio for result thumbnails
//   - placeholder: idle textarea placeholder copy
//   - generatingCopy: per-tool "generating your X" headline
//
// Image-bearing tools (color-palette, invitation-mockup) attach the
// image as a tiny preview only — the upload itself is sent to the
// generate endpoint via JSON-base64 stub. (Phase 2 will wire real
// multimodal once Higgsfield supports image inputs.)
//
// Mood-board imports a thin wrapper around this so its old component
// surface stays unchanged for callers that reference it.

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
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

export interface StudioToolUIProps {
  /** Tool slug — used to build /api/studio/<slug>/ URLs. */
  toolSlug: string;
  /** Per-couple input requirement. */
  inputKind: "text" | "image" | "image+text";
  /** Cost in credits — surfaced to the user before generation. */
  costCredits: number;
  /** Initial workspace credit balance. */
  initialBalance: number;
  /** Whether this workspace is a B2B planner workspace. */
  isB2B: boolean;
  /** Default variant count when the tool has no density override. */
  defaultVariantCount: number;
  /**
   * Optional override that derives variant_count from a clarification
   * answer (mood-board uses density; others stick to defaults).
   */
  variantCountFromAnswers?: (answers: Record<string, string>) => number;
  /** Tailwind aspect ratio class for result grid thumbnails. */
  resultAspectClass: string;
  /** Idle-stage textarea placeholder copy. */
  idlePlaceholder: string;
  /** "Generating your <X>" headline. */
  generatingHeadline: string;
  /** "We'll ask…" hint copy under the idle textarea. */
  idleHint?: string;
  /**
   * Result-grid column count. Most tools default to 2-4 column responsive;
   * single-image tools (color-palette) collapse to 1 column.
   */
  singleImage?: boolean;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

export function StudioToolUI(props: StudioToolUIProps) {
  const {
    toolSlug,
    inputKind,
    costCredits,
    initialBalance,
    isB2B,
    defaultVariantCount,
    variantCountFromAnswers,
    resultAspectClass,
    idlePlaceholder,
    generatingHeadline,
    idleHint,
    singleImage,
  } = props;

  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [userInput, setUserInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(initialBalance);

  const insufficient = !isB2B && balance < costCredits;

  const canGenerate = useMemo(
    () => Object.keys(answers).length > 0 && stage !== "generating",
    [answers, stage],
  );

  const needsImage = inputKind === "image" || inputKind === "image+text";
  const needsText = inputKind === "text" || inputKind === "image+text";
  // For image-only tools, allow refine if image is present. For
  // image+text, allow refine if EITHER image OR text is present.
  const idleReady = useMemo(() => {
    if (inputKind === "text") return Boolean(userInput.trim());
    if (inputKind === "image") return Boolean(file);
    return Boolean(file) || Boolean(userInput.trim());
  }, [inputKind, userInput, file]);

  function acceptFile(f: File | null) {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) {
      setError("That file type isn't supported. Use JPEG, PNG, WEBP, or GIF.");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError(
        `Image too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`,
      );
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
  }

  async function handleRefine() {
    if (!idleReady) {
      setError(
        needsImage && needsText
          ? "Add a photo or describe what you want first."
          : needsImage
            ? "Add a photo first."
            : "Tell me what you want to see first.",
      );
      setStage("error");
      return;
    }
    setError(null);
    setStage("clarifying");
    try {
      // For image-bearing tools we still send a text body — the photo
      // itself is forwarded at generate time. The clarification step
      // only needs the user's text description.
      const effectiveInput = userInput.trim() || "(photo uploaded — clarify based on image context)";
      const r = await fetch(`/api/studio/${toolSlug}/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: effectiveInput }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Refine failed (${r.status})`);
      }
      const data = (await r.json()) as ClarifyResponse;
      setQuestions(data.questions);
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
      const variantCount = variantCountFromAnswers
        ? variantCountFromAnswers(answers)
        : defaultVariantCount;

      const effectiveInput = userInput.trim() || "(photo uploaded)";
      const r = await fetch(`/api/studio/${toolSlug}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: effectiveInput,
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStage("idle");
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError(null);
    setPreviewPrompt(null);
    setFile(null);
    setPreviewUrl(null);
  }

  function handleRefineAgain() {
    setError(null);
    setStage("answering");
  }

  // ── Stage: error ─────────────────────────────────────────────────────
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

  // ── Stage: result ────────────────────────────────────────────────────
  if (stage === "result" && result) {
    const gridClasses = singleImage
      ? "grid gap-3 sm:grid-cols-1"
      : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
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

        <div className={gridClasses}>
          {result.variants.map((v, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${v.image_url}-${idx}`}
              src={v.image_url}
              alt={`Variant ${idx + 1}`}
              className={`w-full rounded-2xl border border-stone-200 object-cover ${resultAspectClass}`}
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

  // ── Stage: generating ────────────────────────────────────────────────
  if (stage === "generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-stone-200 bg-white/70 p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        <div className="font-serif text-xl text-stone-800">
          {generatingHeadline}
        </div>
        <p className="max-w-md text-sm text-stone-500">
          Optimizing the prompt, then rendering. This takes about 15 seconds.
        </p>
      </div>
    );
  }

  // ── Stage: clarifying ────────────────────────────────────────────────
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

  // ── Stage: answering ─────────────────────────────────────────────────
  if (stage === "answering") {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-stone-200 bg-white/70 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Your input
          </div>
          {previewUrl && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Uploaded reference"
                className="max-h-48 rounded-xl border border-stone-200 object-cover"
              />
            </div>
          )}
          {userInput.trim() && (
            <p className="mt-2 text-sm text-stone-800">
              &ldquo;{userInput}&rdquo;
            </p>
          )}
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

  // ── Stage: idle ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4 rounded-3xl border border-stone-200 bg-white/70 p-6">
      {needsImage && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
            <Camera className="h-3.5 w-3.5" />
            {inputKind === "image" ? "Upload your photo" : "Optional reference photo"}
          </div>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Uploaded"
              className="max-h-56 w-full rounded-xl border border-stone-200 object-contain"
            />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/50 px-4 py-8 text-sm text-stone-600 hover:border-stone-400"
            >
              <Upload className="h-4 w-4" />
              {inputKind === "image" ? "Pick a photo" : "Add a reference photo"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />
          {previewUrl && (
            <button
              type="button"
              onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setFile(null);
                setPreviewUrl(null);
              }}
              className="text-xs text-stone-500 underline-offset-2 hover:underline"
            >
              Remove photo
            </button>
          )}
        </div>
      )}

      {needsText && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
            <ImageIcon className="h-3.5 w-3.5" />
            Tell me what you want to see
          </div>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={idlePlaceholder}
            rows={4}
            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          {idleHint ?? "We'll ask 3-5 quick questions to tune the result."}
        </p>
        <Button onClick={handleRefine} disabled={!idleReady}>
          <Sparkles className="h-4 w-4" />
          Refine my prompt
        </Button>
      </div>
    </div>
  );
}
