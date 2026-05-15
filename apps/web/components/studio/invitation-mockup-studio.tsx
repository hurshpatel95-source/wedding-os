"use client";

// Save-the-date / invitation mockup — image+text. Couple photo + theme.
// 4 variants. Portrait aspect (cards are taller than they are wide).

import { StudioToolUI } from "./studio-tool-ui";

interface Props {
  initialBalance: number;
  costCredits: number;
  isB2B: boolean;
}

export function InvitationMockupStudio({
  initialBalance,
  costCredits,
  isB2B,
}: Props) {
  return (
    <StudioToolUI
      toolSlug="invitation-mockup"
      inputKind="image+text"
      costCredits={costCredits}
      initialBalance={initialBalance}
      isB2B={isB2B}
      defaultVariantCount={4}
      resultAspectClass="aspect-[5/7]"
      idlePlaceholder="e.g. classic engraved invitation, cream and antique brass, October 5 Philadelphia, cinematic"
      idleHint="Upload your couple photo + describe the theme. We'll generate 4 layout options."
      generatingHeadline="Designing your stationery"
    />
  );
}
