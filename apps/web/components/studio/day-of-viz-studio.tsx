"use client";

// Day-of timeline visualizer — text-only.
// 4 variants. Portrait aspect (5×7 cards).

import { StudioToolUI } from "./studio-tool-ui";

interface Props {
  initialBalance: number;
  costCredits: number;
  isB2B: boolean;
}

export function DayOfVizStudio({
  initialBalance,
  costCredits,
  isB2B,
}: Props) {
  return (
    <StudioToolUI
      toolSlug="day-of-viz"
      inputKind="text"
      costCredits={costCredits}
      initialBalance={initialBalance}
      isB2B={isB2B}
      defaultVariantCount={4}
      resultAspectClass="aspect-[5/7]"
      idlePlaceholder="ceremony 4pm at Switch House, cocktails 5pm in the courtyard, dinner 6pm in the ballroom, dancing 8pm-midnight"
      idleHint="Type your run sheet freeform — we'll parse it and render a visual timeline."
      generatingHeadline="Drafting your timeline"
    />
  );
}
