"use client";

// Cake design — text-only studio tool. 4 variants. Square aspect.

import { StudioToolUI } from "./studio-tool-ui";

interface Props {
  initialBalance: number;
  costCredits: number;
  isB2B: boolean;
}

export function CakeStudio({ initialBalance, costCredits, isB2B }: Props) {
  return (
    <StudioToolUI
      toolSlug="cake"
      inputKind="text"
      costCredits={costCredits}
      initialBalance={initialBalance}
      isB2B={isB2B}
      defaultVariantCount={4}
      resultAspectClass="aspect-square"
      idlePlaceholder="e.g. 3-tier classic buttercream cake with cascading garden roses and gold leaf accent"
      generatingHeadline="Designing your cake"
    />
  );
}
