# Couple-side UX gap audit — recovered from transcript

**Date originally run:** 2026-05-06 19:38 UTC
**Original agent:** "Couple-side UX gap audit", subagent_type general-purpose, run in background, agentId `ad62e17d54fa3bde0`
**Original audit target:** wedding-os at this commit / state, as the couple Hursh & Nisha for Sept 2027 Barcelona wedding (workspace shape, not the post-rebrand "Acquired Planner" framing — but the issues all carry over)
**Recovery date:** 2026-05-11, recovered from `0a1b1d7d-ddbc-476e-a7e1-a801fc8ad7fc.jsonl` at line 3447 (task-notification result block)
**Why this doc exists:** the audit was verbal/ephemeral in the prior session and didn't survive the May 11 compaction. Lost it, Hursh called it out, recovered + persisting. Don't lose it again.

---

## The findings — verbatim from the audit, with current-state annotations

### 1. No way to publish/share the public wedding site
- **Severity:** Blocker
- **Effort:** half day
- **Original finding:** /w/[slug] site existed but no couple UI to set public_slug, edit story_html, or copy share URL. Couple had to ask Astha to hand-edit the DB.
- **STATUS 2026-05-11:** ✅ **FIXED.** `/settings/public-site` exists with slug input, theme picker, publish toggle. API endpoint at `/api/public-site/route.ts` (now write-guarded via 989d9d3). Smoke test 15 guards it.

### 2. Public site missing standard guest-portal sections (registry, hotel, travel, schedule, dress code, FAQs)
- **Severity:** Blocker
- **Effort:** half day
- **Original finding:** workspaces table only had name + wedding_date + public_slug + story_html. Couple couldn't add anything else.
- **STATUS 2026-05-11:** ✅ **MOSTLY FIXED.** PATCH /api/public-site accepts: `registry_url`, `registry_label`, `travel_md`, `hotel_block_md`, `dress_code_md`, `faq` (Q&A array), `schedule` (time+date+label+location array), `public_theme_slug`. Need to verify UI exposes all fields on /settings/public-site.

### 3. Couple cannot mark their own deposits paid
- **Severity:** Blocker
- **Effort:** 30 min
- **Original finding:** /payments calendar in couple nav but `mark-paid` gated `role === 'admin'`. Same for timeline-editor. Couple had to ping Astha.
- **STATUS 2026-05-11:** UNVERIFIED. Need to check current state of `payments-calendar.tsx` and `timeline-editor.tsx`.

### 4. Co-pilot is blind to half the workspace
- **Severity:** Friction
- **Effort:** 1 hr
- **Original finding:** `buildContext()` in /api/ai/chat/route.ts only loaded workspaces/venues/scenarios/vendors and counts (not names) for guests/tasks. Missing: budget_estimates, payments milestones, venue_decisions, venue_questions, timeline_items, venue_date_marks. "Who hasn't RSVP'd?" / "what did we decide?" all returned vague answers.
- **STATUS 2026-05-11:** UNVERIFIED. Need to check current buildContext().

### 5. No wedding date set, but UI assumes one
- **Severity:** Friction
- **Effort:** 1 hr
- **Original finding:** wedding_date was null. No couple-side picker. Dashboard countdown said "TBD", /plan due dates didn't anchor, /payments overdue misbehaved.
- **STATUS 2026-05-11:** ✅ **FIXED.** /settings/preferences has wedding-date picker. Smoke test 04 verifies it persists. T1.3 work-rolled write-guard.

### 6. Estimator vs /pricing vs /spend — three views, no orientation
- **Severity:** Friction
- **Effort:** 30 min
- **Original finding:** Four money pages (Estimator, Full pricing, Payments, Spend), no UI orientation about which to trust.
- **STATUS 2026-05-11:** UNVERIFIED. Need to check current page subheads.

### 7. Dashboard is informational, not actionable
- **Severity:** Friction
- **Effort:** 2 hrs
- **Original finding:** Dashboard showed shortlist + activity + 4 stats (two hardcoded "—"). Didn't surface: what's due this week, RSVPs landing, deposits coming up, blocked tasks, unanswered questions, today's Co-pilot suggestion.
- **STATUS 2026-05-11:** PARTIALLY FIXED. AutopilotTodayWidget exists for B2C, T1.5 fork in place. But many stat tiles may still be placeholders.

### 8. No "what changed since I was last here?" surface
- **Severity:** Friction
- **Effort:** 1.5 hrs
- **Original finding:** No per-user notification dots, no "1 new update" badges, no since-you-last-visited digest. Both Hursh and Nisha log in but activity feed is workspace-global.
- **STATUS 2026-05-11:** UNVERIFIED — almost certainly not built.

### 9. Public site hides the venue list when no is_lead_pick is set
- **Severity:** Polish
- **Effort:** 15 min
- **Original finding:** `/w/[slug]/page.tsx:129` only renders "Where it all happens" when leadVenues.length > 0. Should fall back to `venues.filter(v => v.status === 'decided' || v.status === 'booked')` or hide the section header.
- **STATUS 2026-05-11:** UNVERIFIED.

### 10. Vendor-add for couples with no contact info or category guidance
- **Severity:** Polish
- **Effort:** 30 min
- **Original finding:** /vendors had VendorCreateButton for couples, but page copy said "Your planner's internal CRM stays in their admin view." Inconsistent — either remove the button or reframe as "Suggest a vendor for Astha to vet".
- **STATUS 2026-05-11:** UNVERIFIED.

---

## Top-3 ranked by couple-impact (per the original audit)

1. **#1 publish public site** (FIXED ✅)
2. **#2 registry/hotel/travel sections** (MOSTLY FIXED ✅)
3. **#3 couple can mark paid** (UNVERIFIED — likely still open)

Together originally estimated ~1.5 days of work to unblock the full "we picked venues → deposit paid → site shared" flow.

---

## What we're acting on tonight (2026-05-11)

After status-checking each, the items genuinely still pending will be dispatched to parallel worker agents (each in its own branch for review/merge by Hursh). Items already shipped are documented above for history, not for re-work.

## Notes for future sessions

- This audit was specific to the couple side. There's no equivalent recent audit of the planner/admin side. If we need one before launching B2B Phase 1 (charging Astia), spawn a fresh one.
- The wedding-os → Acquired Planner rebrand changed names but the listed pages all still exist under the same paths.
- The audit author's biases: skewed toward "what Joy/Zola/Knot have." That framing is correct for the B2C self-serve surface but undershoots the B2B planner-served surface where the planner does many things the couple-tools assume the couple does themselves.
