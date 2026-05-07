"use client";

import type { WelcomeState } from "@/lib/welcome-types";

// Common shape passed from the wizard host into every step component.
export interface WelcomeStepProps {
  state: WelcomeState;
  onChange: (patch: Partial<WelcomeState>) => void;
  onNext: () => void;
  onSkip: () => void;
  // null when there's no previous step (i.e. step 1)
  onBack: (() => void) | null;
}

// The row of [Back] [Skip] [Next] action buttons rendered at the bottom of
// each step. Steps can disable Next while a fetch is in flight via `busy` and
// override the Next label (e.g. "Save and continue" / "Finish").
export function WelcomeStepFooter({
  onBack,
  onSkip,
  onNext,
  busy = false,
  nextLabel = "Next",
  skipLabel = "Skip",
  hideSkip = false,
}: {
  onBack: (() => void) | null;
  onSkip: () => void;
  onNext: () => void;
  busy?: boolean;
  nextLabel?: string;
  skipLabel?: string;
  hideSkip?: boolean;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-5">
      <div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-500 disabled:opacity-50"
          >
            ← Back
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!hideSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-medium text-stone-600 transition hover:text-stone-900 disabled:opacity-50"
          >
            {skipLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
        >
          {busy ? "Saving…" : nextLabel}
        </button>
      </div>
    </div>
  );
}

export function WelcomeStepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
        {eyebrow}
      </div>
      <h2 className="mt-1.5 font-serif text-2xl font-light tracking-tight md:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        {description}
      </p>
    </header>
  );
}
