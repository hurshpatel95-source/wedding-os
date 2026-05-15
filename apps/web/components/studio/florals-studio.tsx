"use client";

// Florals at venue — text-only studio tool. 4 variants. Square aspect.

import { StudioToolUI } from "./studio-tool-ui";

interface Props {
  initialBalance: number;
  costCredits: number;
  isB2B: boolean;
}

export function FloralsStudio({ initialBalance, costCredits, isB2B }: Props) {
  return (
    <StudioToolUI
      toolSlug="florals"
      inputKind="text"
      costCredits={costCredits}
      initialBalance={initialBalance}
      isB2B={isB2B}
      defaultVariantCount={4}
      resultAspectClass="aspect-square"
      idlePlaceholder="e.g. lush cascading arch for an outdoor ceremony, cafe au lait dahlias and trailing eucalyptus"
      generatingHeadline="Rendering your florals"
    />
  );
}
