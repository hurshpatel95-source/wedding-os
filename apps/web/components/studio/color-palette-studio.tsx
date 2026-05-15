"use client";

// Color palette explorer — image+text. Returns ONE composite (16:9).
// Single-image output, not a grid.

import { StudioToolUI } from "./studio-tool-ui";

interface Props {
  initialBalance: number;
  costCredits: number;
  isB2B: boolean;
}

export function ColorPaletteStudio({
  initialBalance,
  costCredits,
  isB2B,
}: Props) {
  return (
    <StudioToolUI
      toolSlug="color-palette"
      inputKind="image+text"
      costCredits={costCredits}
      initialBalance={initialBalance}
      isB2B={isB2B}
      defaultVariantCount={1}
      resultAspectClass="aspect-video"
      idlePlaceholder="e.g. dusty rose and antique brass, cocktail vibe, fall garden party"
      idleHint="Drop an inspo photo OR describe the vibe — at least one. We'll output a single palette composite."
      generatingHeadline="Extracting your palette"
      singleImage
    />
  );
}
