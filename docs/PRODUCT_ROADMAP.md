# Product Roadmap — Acquired Planner

**Last updated:** May 8, 2026
**Status:** Pre-launch, post-architectural-debt reckoning
**Master spec:** `docs/acquired_planner_spec.md`
**Foundation:** `docs/STABILIZATION_SPRINT.md` must complete first

---

## ⚠️ ROADMAP STARTS AFTER STABILIZATION

No items below ship until `docs/STABILIZATION_SPRINT.md` Tier 1 is complete.

---

## The strategic shift (May 8, 2026)

Original plan: launch via Brigette Pheloung @ 1M followers, 14-day sprint to pitch, HoldCo-equity deal.

**Why we're not doing that:** Brigette's wedding is **June 2026 (next month)**. She's in execution mode, not planning mode. Pitching a wedding-planning tool 4 weeks before her wedding is wrong-tool-wrong-time. Spec section §10 explicitly warns about this opportunistic-founder pattern.

**Revised plan:**

1. **Track 1: B2B white-label planner portal** — primary commercial path (real money lives here)
2. **Track 2: B2C consumer differentiator** — secondary, builds the spec's image-gen vision
3. **Brigette: deferred to Q3-Q4 2026** — for Vertical 2 (Acquired Honeymoon), not for Acquired Planner. By then we have a working product + paying customers as proof.

No equity given to anyone until paying customers exist.

---

## TRACK 1 — B2B white-label planner portal

**Why first:** highest willingness-to-pay ($300-500/mo per planner vs ~$79/mo per couple), real customer already (Astia), each planner brings 10-30 weddings of B2C distribution for free.

### Phase 1 — Make Astia a paying customer (Week 1 post-stabilization)

- [ ] Charge Astia $X/month (test pricing — start at $200, raise as features ship)
- [ ] Stripe customer + subscription set up for her
- [ ] Quarterly check-in calendar invite for product feedback

### Phase 2 — Self-serve planner onboarding (Weeks 2-4)

- [ ] `/planner/signup` route — Stripe Checkout → org + workspace + admin role provisioned automatically
- [ ] Stripe products: `planner_starter` ($300/mo, up to 5 active couples), `planner_pro` ($500/mo, up to 20), `planner_unlimited` ($999/mo)
- [ ] Stripe webhook → marks org as `subscription_active`
- [ ] Onboarding email sequence (Resend) — welcome + 3 feature-tour emails over 7 days
- [ ] Admin shell shows "Trial ends in N days" / "Subscription active" banner

### Phase 3 — Client invitation flow (Weeks 4-6)

- [ ] `/admin/clients/new` — planner enters couple email + wedding date + region + names
- [ ] Magic-link sent to couple → lands on pre-branded `co_branded` skin workspace
- [ ] Couple lands with planner's logo, accent color, "Powered by Acquired Planner" attribution
- [ ] Per-couple billing line item on planner's Stripe subscription (metered)

### Phase 4 — Per-planner branding control panel (Weeks 6-7)

- [ ] `/admin/branding` — upload logo, set accent_hex, set planner_display_name, set planner_email/phone
- [ ] Writes to `workspace_branding` table (already exists, just needs UI)
- [ ] Preview pane showing how a couple sees the branded portal
- [ ] **Backfill Astia's branding row** so Hursh & Nisha portal restores `co_branded` properly

### Phase 5 — Document vault + invoice OCR (Weeks 7-9)

- [ ] `/admin/clients/[id]/documents` drop-zone (Supabase Storage)
- [ ] Claude vision/extraction parses PDFs: vendor name, amounts, due dates, line items
- [ ] Per-vendor view: all invoices grouped
- [ ] Per-couple view: all invoices grouped
- [ ] "Match to existing vendor" UI when AI is uncertain

### Phase 6 — Multi-couple dashboard (Weeks 9-10)

- [ ] Astia/planner dashboard shows: all active weddings, days-to-wedding countdowns, pending RFPs, next-30-day milestones, deposits-due cross-workspace
- [ ] Cash-flow view: incoming planner-invoice receivables + outgoing vendor commitments
- [ ] Filter by client, by status, by venue

### Phase 7 — Outbound to other planners (Weeks 10-12)

- [ ] Pitch deck for planners (different from Brigette/HoldCo deck)
- [ ] Founder-led outbound to 50 planners via Instagram DMs + wedding industry FB groups
- [ ] Goal: 5 paying planners by end of week 12
- [ ] Each new planner = 10-30 new B2C couples flowing through

---

## TRACK 2 — B2C consumer differentiator

**Why second:** B2B revenue funds B2C feature build. Without a paid B2B base, B2C marketing is brutal without a celebrity launch.

### Phase 1 — Aesthetic Profile system (Weeks 6-7)

Per spec §4. The unlock for everything visual.

- [ ] DB schema: `aesthetic_profiles` table (palette, mood, density, lighting, type, avoid)
- [ ] Onboarding flow: bride uploads 8-15 inspiration pins + venue photos + answers questionnaire
- [ ] Claude distills uploads into structured profile
- [ ] Profile persists per workspace, surfaces on every visual feature

### Phase 2 — Image generation engine (Weeks 7-10)

Per spec §4. **TOS check first** — if Higgsfield commercial wrap blocked, switch to Fal/Replicate.

- [ ] Higgsfield/Fal/Replicate TOS read + chosen
- [ ] Architecture: model-agnostic abstraction layer (`apps/web/lib/image-gen/`)
- [ ] Flow 1 — venue rehearsal: venue photo + aesthetic → 4 variations (1 credit = 4 outputs)
- [ ] "Refine" button → 4 new variations in chosen direction
- [ ] "Lock + use" → save to lookbook
- [ ] Aesthetic Profile feeds every gen automatically

### Phase 3 — Vendor Brief PDF generator (Week 10)

Per spec §4. **Do not skip — this is what turns visualization into execution.**

- [ ] One-tap "Generate Vendor Brief" on any locked image
- [ ] PDF: locked image + aesthetic profile summary + item list + dimensions + reference pins + couple contact + venue address
- [ ] Generated server-side via puppeteer or similar

### Phase 4 — Pricing + credit economy (Weeks 10-12)

Per spec §5.

- [ ] Stripe products: Starter $29/mo (25 gens), Plan $79/mo (150 gens), Visualize $149/mo (500 gens)
- [ ] Wedding Pass $499 one-time (6mo Plan + 200 bonus credits)
- [ ] Concierge $1,499 one-time (Visualize + offshore-team handles setup)
- [ ] Credit refill packs: $19/30, $49/100, $129/300, $399/1200
- [ ] Per-workspace credit balance, debited per generation
- [ ] Webhook from Stripe → credit balance update

### Phase 5 — Mood board + Save-the-date flows (Weeks 12-14)

Per spec §4. Variations of the same engine.

- [ ] Mood board: 5-15 inspiration pins → aesthetic doc + 4 unifying images
- [ ] Save-the-date: couple photo + aesthetic → print-ready invite suite
- [ ] Both share the engine + Aesthetic Profile

### Phase 6 — V1.1 agents (Weeks 14-20)

Per spec §3. The "AI doing real work" tier.

- [ ] Negotiation agent (counter-offer drafting, market comparison)
- [ ] Contract review agent (flags concerning clauses)
- [ ] Day-of timeline agent (run-of-show + auto-emails vendors)
- [ ] Budget reallocation agent
- [ ] Tablescape, cake, signage, dress, bridesmaids, hair/makeup flows (all variations of image engine)

---

## Cross-track: launch sequencing

### Soft launch — week 1 post-stabilization
- Send Rachel her Acquired Planner brief (already drafted)
- Charge Astia
- Capture testimonials over 4-6 weeks

### Beta — weeks 4-8
- 5 paying planners onboarded via outbound
- 50-150 active couples flowing through their portals
- B2C image-gen engine in development

### Public launch — weeks 12-14
- Image gen engine live for B2C
- Stripe pricing live
- Rachel testimonial + Astia case study published
- Founder-led PR push (no influencer dependency)

### Brigette pitch — Q3 2026 (post-her-wedding)
- Pitch is for **Vertical 2: Acquired Honeymoon**
- She's in honeymoon-planning mode
- Demo: pre-loaded Acquired Honeymoon for her actual upcoming honeymoon trip
- HoldCo conversation = real product behind it (Acquired Planner has paying customers + Rachel testimonial)
- Deal structure per spec §7

---

## What we're NOT doing

- ❌ Pitching Brigette before her wedding for Acquired Planner
- ❌ Giving equity to anyone before paying customers exist
- ❌ Raising VC
- ❌ Building image gen before Aesthetic Profile system is built
- ❌ Building credit economy before image gen is working
- ❌ ANY of this before Stabilization Sprint Tier 1 is complete

---

## Threshold logic for full HoldCo commitment

Per spec §9. **Pre-commit. Sign and date this when ready.**

| 30-day post-public-launch outcome | Decision |
|---|---|
| <300 subs | Launch failed. Keep platform alive at low cost. Iterate on positioning. Don't quit other businesses. |
| 300-600 subs | Real signal. Iterate. Add 1-2 more launch partners. Re-evaluate at 90 days. |
| 600-1,000 subs | Working. Acquired Planner above HonesTree in priority. Hire 1 FT engineer. Start Vertical 2. |
| 1,000+ subs | Breakout. Drop everything except FlowPilot + Acquired. Raise small seed. |
| 2,000+ subs | Unicorn-shaped. Stop everything else. CEO advisor. Raise capital. |

---

## End of file
