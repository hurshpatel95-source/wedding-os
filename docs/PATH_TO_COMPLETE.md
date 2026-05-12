# Path to "complete enough to send" — Acquired Planner

**Author:** Claude
**Date:** 2026-05-12
**Status:** Live plan. Update as decisions land.

This doc maps the work from "where we are now" → "Hursh is comfortable handing this to Rachel and other paying customers." It's the operating plan, not a wishlist. Each phase has clear in-scope work, time estimates, dependencies, and an explicit gate to the next phase.

---

## North star

A B2C couple lands cold and within 15 minutes feels: **"this is a real product, not a side-project. It knows what it's doing. It will help me."** No half-built surfaces, no scaffold-level nav, no confusing forks, no dead-ends.

---

## Where we are right now (2026-05-12 morning)

- T1 stabilization sprint shipped. Foundation is sound.
- 25 smoke specs, 34 active tests on prod, 0 failures.
- 25 mutation endpoints write-guarded.
- 13 of 15 audit-2 findings closed. 2 structural items + 1 SQL item open.
- The product is **functional end-to-end** but FEELS half-built in specific surfaces.

---

## Phase 0 — Deep usage audit (next 1-2 hr, parallel to Hursh production)

**Goal:** stop guessing what feels incomplete. Use the product the way Rachel would, list every friction at high resolution.

**Scope:**
1. Sign in fresh as `b2c-rachel` (raachmc@aol.com)
2. Walk the full first-hour flow: onboarding → budget gen → /plan → /vendors/find → /guests/import → /settings/public-site → /payments
3. Try each thing as if I'm a real couple with a real wedding. NOT skim. NOT acceptance-test. ACTUALLY USE IT.
4. Document every friction at the granularity: "the X on page Y at line Z confused me / failed / looked broken / made me ask 'is this it?'"
5. Mobile viewport pass on top of desktop
6. Co-pilot stress test — ask 5-10 real-couple questions, document where it falls short

**Output:** `docs/audit_2026-05-12_DEEP_couple_usage.md` — separate from the surface scan, MORE specific, ordered by user-impact

**Deliverable:** Hursh comes back, reads the deep audit, can scope Phase 2 with real data instead of my guesses.

**Time:** 1-2 hr via parallel agent.
**Dependencies:** none.
**Gate to Phase 1:** Hursh reviews + decides which items go into structural vs depth tracks.

---

## Phase 1 — Structural IA fixes (1-1.5 days)

The "this looks scaffolded" tells. Both items from audit-2 that I deferred.

### 1.1 Collapse the five money pages (audit-2 #4)

**Current:** `/budget`, `/estimator`, `/pricing`, `/payments`, `/spend` — five separate nav pills, four different "totals" on the same wedding.

**Proposed:**
- Keep `/budget` and `/payments` as nav primaries.
- Move `/estimator`, `/spend` under a tab strip inside `/budget` (or a "Money" section header on `/budget` with internal tabs).
- `/pricing` redirects silently to `/budget` for B2C (the page already redirects in some paths — extend).
- Each tab keeps its existing content + the orientation copy we just shipped, but the user doesn't have to navigate nav to switch.

**Effort:** half day.
**Risk:** medium. Touches IA. Could break smoke 18 (pricing fork). Need to update smoke specs in same commit.
**Decision needed from Hursh:** yes — confirm the "money tabs inside `/budget`" model before I build.

### 1.2 Trim the 19-pill nav (audit-2 #5)

**Current:** 19 nav items horizontally. Mobile = `overflow-x-auto` strip with no overflow indicator. Rachel won't scroll horizontally on her phone.

**Proposed primary nav (7-8 items):**
- Dashboard
- Plan
- Venues
- Vendors
- Guests
- Budget
- Payments
- Public site

**Behind "More" dropdown or `/explore` page:**
- Map, Availability, Compare, Estimator (→ now a tab inside Budget post-1.1), Pricing (→ redirect), Timeline, Co-pilot, Autopilot, Tour, Feature-status (or delete this surface entirely)

**Effort:** 1 hr for the nav restructure + 30 min for "More" dropdown.
**Risk:** low — pure presentational change.
**Decision needed from Hursh:** confirm the 8 primaries.

### 1.3 Settings hub (related)

**Current:** `/settings/preferences`, `/settings/public-site` — no `/settings` index page. The nav doesn't have a "Settings" pill; users reach these via deep links.

**Proposed:** `/settings` becomes a hub with cards linking to Preferences, Public site, (and future: Notifications, Account, Billing). Each card has eyebrow + headline + last-updated info if available.

**Effort:** 1 hr.
**Risk:** very low.
**Decision needed:** none — straightforward.

### Phase 1 acceptance

- Smoke suite stays green
- Nav has 8 primaries, mobile shows no horizontal scroll
- Money tab strip on `/budget` works for both B2C and B2B
- Settings hub renders at `/settings`
- Audit-2 items #4 and #5 closed

---

## Phase 2 — Depth work (2-3 days, parallelizable)

The "the depth isn't there yet" tells. Multiple tracks, can run as parallel agents.

### 2.1 Onboarding review step

**Current:** chat → done → redirect. User has no chance to review/edit what AI extracted.

**Proposed:** After chat completion, render a `/onboarding/review` page showing:
- "Here's what we captured." — list of extracted fields (couple names, wedding date, region, guest count, budget target, etc.)
- Each row is editable inline
- "Looks good → Generate my budget" CTA, or "Edit something → Open settings"

**Effort:** half day.
**Files:** `apps/web/app/(app)/onboarding/page.tsx`, new `review/page.tsx`, possibly updates to `onboarding-chat.tsx` completion handling.
**Risk:** low. Additive.

### 2.2 Public site preview + Open Graph + SEO

**Current:** Edit slug + theme. Publish. No preview of the actual rendered site until you visit `/w/<slug>`. No OG image. No SEO meta.

**Proposed:**
- "Preview" iframe inside `/settings/public-site` showing the live rendered site as the user edits
- Auto-generate Open Graph image from couple name + date + theme
- `<meta name="description">` populated from `story_html` first 160 chars
- `<title>` = "{coupleName} · {weddingDate}"

**Effort:** 1 day.
**Files:** `apps/web/app/(app)/settings/public-site/*`, `apps/web/app/w/[slug]/page.tsx` (head metadata), possibly a new `/api/og/[slug]` route for OG image generation.
**Risk:** low. Adds value, doesn't change existing behavior.

### 2.3 Vendor lifecycle visibility

**Current:** Vendor has status, but the UX doesn't tell the lifecycle story. User can change status but doesn't see "what's next" guidance.

**Proposed:**
- On `/vendors/<id>`, render a small pipeline strip at the top: researching → rfp_sent → quoted → shortlisted → booked → completed
- Highlight current stage. Each stage has a 1-line "what now" subhead.
- Add inline "Next: send RFP" or "Next: log quote" button per stage that opens the right action.

**Effort:** half day.
**Files:** `apps/web/components/vendors/vendor-detail-tabs.tsx`, `apps/web/components/vendors/vendor-grid.tsx`.
**Risk:** low.

### 2.4 Mobile rendering pass

**Current:** one mobile issue caught (onboarding chat sidebar). Many likely remain.

**Proposed:** systematic walk through every couple page at 375x812 viewport (iPhone SE-ish), document every layout break, fix in batches.

**Effort:** 1 day.
**Risk:** low. Pure CSS / responsive class work.

### 2.5 Co-pilot improvements

**Current:** context loads more tables (post-audit-1 #4) but quality unverified. Audit-2 #15 simplified the header copy.

**Proposed (gated on Phase 0 stress-test findings):**
- Whatever the stress test surfaces
- Likely: more grounded answers via tighter prompt, better empty-state when no context, message counter inline

**Effort:** TBD post-Phase 0.

### 2.6 Dashboard depth

**Current:** action widgets ship (Due this week, Deposits, RSVPs, Unanswered Q). Two-step starter list on welcome banner.

**Proposed:**
- Activity feed — "What's changed in your workspace since you last logged in" (gated on Phase 3 last_seen_at column for true per-user, OR uses workspace.updated_at for a workspace-level v0)
- Co-pilot suggestion card on the dashboard (today's specific tip based on workspace state)

**Effort:** half day for the workspace-updated_at version. Full per-user version blocked on SQL.

### Phase 2 acceptance

- Onboarding has explicit review/edit step
- Public site has preview + OG + SEO
- Vendor pipeline is visible + actionable
- Mobile rendering passes a structured review
- Co-pilot stress test issues resolved
- Dashboard has more daily-utility

---

## Phase 3 — Schema-dependent items (post T1.1 part 2 activation)

Blocked on Hursh's ~10 min to add `SUPABASE_DB_URL` to Railway env + flip `railway.json.staged`. Once T1.1 part 2 is live, these become unblocked.

### 3.1 since-you-last-visited surface (audit-1 #8)

**Schema:** `users.last_seen_at timestamptz` column + write on every authenticated page load.
**UX:** notification dots on nav items, "1 new" badges per section, "Since you were last here" digest on dashboard.
**Effort:** 1.5 hr (schema + UI).
**Dependencies:** T1.1 part 2.

### 3.2 Track 1 Phase 1 — charge Astia

**Needs:** Stripe key in Railway env + new `subscriptions`, `invoices`, `payment_methods` tables + Stripe webhook handler.
**Effort:** 4-6 hr build + Hursh's call on pricing tier.
**Dependencies:** Stripe env var.

### 3.3 Track 1 Phase 2 — /planner/signup self-serve flow

**Needs:** new tables for org creation + planner-to-couple workspace creation flow + Stripe subscription assignment.
**Effort:** 1-2 days.
**Dependencies:** Phase 1 done first.

### 3.4 T1.2 phase 2 — eliminate 473 type casts

**Needs:** Supabase CLI authed + `pnpm gen:types` workflow.
**Effort:** 1-2 days mechanical.
**Dependencies:** Supabase CLI auth.

---

## Phase 4 — Pre-Rachel checklist (last 30 min before send)

When everything above is shipped + reviewed, this is the final pass:

1. Sign in incognito as `raachmc@aol.com` / `Wedding2027!`
2. Walk her stated path in the Rachel brief: `/onboarding` → `/budget` → `/plan` → `/estimator` → `/vendors/find` → `/guests/import` → `/settings/public-site`
3. Capture screenshots of every screen
4. Walk it again on mobile
5. Walk it on Safari (Rachel uses an AOL email, so likely on Mac/Safari)
6. Smoke suite green on prod
7. Hursh reads `docs/rachel_onboarding_brief.md` one more time
8. Hursh sends

---

## Sequencing — recommended order

Phase 0 (now, parallel to Hursh production) →
Hursh review of Phase 0 findings →
Phase 1 (structural fixes, ~1.5 days) →
Phase 2 tracks in parallel (~2-3 days) →
T1.1 part 2 activation (Hursh, 10 min) →
Phase 3 items (~3-4 days) →
Phase 4 pre-Rachel checklist (30 min) →
Send Rachel.

**Total wall-clock to "comfortable handing this to Rachel":** 5-7 working days from now, depending on parallelism + Hursh's decision speed on Phase 1 IA calls.

---

## What I can do unilaterally while Hursh is in production (next 1-2 hr)

1. **Phase 0 deep usage audit** — kicks off via a parallel agent right now
2. **Phase 0 mobile rendering audit** — second parallel agent if room
3. **Phase 0 Co-pilot stress test** — third parallel agent if room
4. **Settings hub (Phase 1.3)** — no IA decision needed, can build now
5. **OG image generation scaffold (Phase 2.2 sub-task)** — no decision needed

**What I won't do without Hursh's call:**
- Phase 1.1 (money pages) — needs IA confirmation
- Phase 1.2 (nav trim) — needs primary-8 confirmation
- Anything in Phase 3 — blocked on env / migrations
- Anything that would feel like improvising past the audit

---

## Decision register — open questions for Hursh

When you're back, decide each (1-2 sentences enough):

1. **Money page IA model** — confirm tab strip inside `/budget`, redirect `/pricing` for B2C? Or keep them separate with cleaner nav grouping?
2. **Primary nav 8** — confirm: Dashboard / Plan / Venues / Vendors / Guests / Budget / Payments / Public site? Or different set?
3. **`/feature-status` page** — delete entirely, or gate to admin only?
4. **OG image generation** — generate dynamically per slug (sharper, more work), or use a single template image (faster)?
5. **Onboarding review step** — required (forced gate) or skippable (default-yes button + dismissible)?
6. **Pricing for Astia (Phase 3.2)** — what's the number? $99/mo? $499/mo? Per-couple seat? Per-org flat?

---

## End of plan
