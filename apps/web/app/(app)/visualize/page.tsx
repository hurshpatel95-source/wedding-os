// /visualize → /studio/pricing-analyzer redirect.
//
// Day 3 (AI Studio batch 1) migrated photo→pricing into the Studio
// framework at /studio/pricing-analyzer. This file keeps the legacy
// /visualize route alive as a permanent redirect so any cached links
// (email screenshots, in-product nav holdovers, external) still
// resolve.
//
// The actual UI + endpoint live at:
//   - app/(app)/studio/pricing-analyzer/page.tsx (server shell)
//   - components/studio/pricing-analyzer-studio.tsx (client UX)
//   - app/api/visualize/photo-to-pricing/route.ts (unchanged endpoint)
//
// Smoke test 30 was updated alongside this to point at the new route.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function VisualizeRedirectPage(): never {
  redirect("/studio/pricing-analyzer");
}
