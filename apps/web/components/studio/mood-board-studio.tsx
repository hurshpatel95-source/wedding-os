"use client";

// Mood board — thin wrapper around the generic <StudioToolUI>.
//
// Day 2 shipped this as a standalone component (~360 lines). Tool-batch-1
// refactored the body into <StudioToolUI> shared with florals, cake,
// color-palette, invitation, day-of-viz. Mood-board's only quirk —
// density-driven variant count (6/12/24) — lives in
// variantCountFromAnswers.
//
// External callers (mood-board/page.tsx) keep importing this component;
// the smoke-test 32 contract is preserved.

import { StudioToolUI } from "./studio-tool-ui";

const DENSITY_TO_VARIANT_COUNT: Record<string, number> = {
  curated_6: 6,
  inspiration_12: 12,
  decision_grid_24: 24,
};

interface MoodBoardStudioProps {
  initialBalance: number;
  costCredits: number;
  isB2B: boolean;
}

export function MoodBoardStudio({
  initialBalance,
  costCredits,
  isB2B,
}: MoodBoardStudioProps) {
  return (
    <StudioToolUI
      toolSlug="mood-board"
      inputKind="text"
      costCredits={costCredits}
      initialBalance={initialBalance}
      isB2B={isB2B}
      defaultVariantCount={12}
      variantCountFromAnswers={(answers) => {
        const density = answers["density"] ?? "inspiration_12";
        return DENSITY_TO_VARIANT_COUNT[density] ?? 12;
      }}
      resultAspectClass="aspect-video"
      idlePlaceholder="e.g. moody fall garden wedding with deep burgundy florals and candlelit tablescapes"
      generatingHeadline="Generating your mood board"
    />
  );
}
