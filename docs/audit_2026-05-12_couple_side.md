# Couple-side audit — 2026-05-12 (Acquired Planner)

**Audit date:** 2026-05-12
**Audit posture:** Rachel McGrath, Switch House Philadelphia, Sept 12 2026 wedding
**Prior audit:** docs/audit_2026-05-06_couple_side.md (9 of 10 items closed)
**Audited against commit:** a04fd2abab0c9b3437acf506dee05b50b1e129ee
**Branch:** audit-2026-05-12-fresh

---

## Top-3 highest-leverage fixes ranked by Rachel-impact

1. **Strip "wedding-os" / "Tell Hursh" / "Barcelona" leaks** — the rebrand isn't done. Rachel sees old brand + the founder's name + the founder's wedding city in several user-facing surfaces, which immediately reads as "this product is not actually for me."
2. **Collapse the five money pages into one orientation surface** — Budget, Estimator, Full pricing, Payments, Spend are five separate nav pills. The orientation copy on each page helps once you're on it, but the nav itself doesn't tell Rachel where to start. One first-money page (probably /budget) with tabs to the others.
3. **Trim the 19-item nav** — the top nav has 19 pills (mobile: horizontal scroll). Pages like /map, /availability, /compare, /estimator, /pricing, /feature-status compete for attention with /plan and /budget. Rachel can't tell what's central.

## Findings (ordered by severity)

### 1. Stale brand "wedding-os" leaks through to the couple
- **Severity:** Blocker
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/components/couples-welcome/welcome-banner.tsx:60`; `apps/web/app/(app)/feature-status/page.tsx:19`
- **What's wrong:** The first-load welcome banner says "Welcome to wedding-os." (welcome-banner.tsx:60). The /feature-status hero says "Everything wedding-os does" (feature-status/page.tsx:19). Both fire for B2C couples in the first 60 seconds. The rebrand to "Acquired Planner" was clearly partial.
- **Suggested fix:** Replace "wedding-os" with "Acquired Planner" in both files; grep the rest of `apps/web/` for stragglers (none in admin paths, but worth a sweep).

### 2. "Tell Hursh" / "Ask Hursh" leaks the founder's name to couples
- **Severity:** Blocker
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/app/error.tsx:33`; `apps/web/app/login/page.tsx:211`; `apps/web/app/(app)/feature-status/page.tsx:85,147`
- **What's wrong:** Four user-facing places literally tell the couple to "Tell Hursh" / "Ask Hursh." Login fallback says "Forgot? Ask Hursh — passwords are admin-set" — for a B2C couple who created their own account, this is wrong factually AND nominally. Root error boundary says "If this keeps happening, tell Hursh."
- **Suggested fix:** Replace "Hursh" with "us" or "your planner" (where appropriate per skin). On error.tsx, just say "tell us — error ref:". On the login fallback for B2C: "Forgot? Use the magic-link option above." On feature-status: "Tell us which ones you'd actually use."

### 3. Public site hero hardcodes "Barcelona, Spain"
- **Severity:** Blocker
- **Effort:** 30 min
- **Needs new SQL:** No (column already exists — wedding_region)
- **Files involved:** `apps/web/app/w/[slug]/page.tsx:347`
- **What's wrong:** The published /w/[slug] hero subtitle reads `{dateLabel} · Barcelona, Spain` — the city is HARDCODED. For Rachel's Switch House Philadelphia page, guests would see "September 12, 2026 · Barcelona, Spain." This is the most-shared, most-judged surface in the app. Same file at line 323/702 only acknowledges this is parsed from the workspace name template.
- **Suggested fix:** Replace the hardcoded "Barcelona, Spain" with `workspace.wedding_region` (already a column, already populated by onboarding for new B2C couples). Fall back to omitting the location chip entirely when wedding_region is null — better blank than wrong.

### 4. Five separate "money" pages in the top nav
- **Severity:** Friction
- **Effort:** half day (nav restructure + tabs scaffold)
- **Needs new SQL:** No
- **Files involved:** `apps/web/components/nav.tsx:46-49`; `apps/web/app/(app)/{budget,estimator,pricing,payments,spend}/page.tsx`
- **What's wrong:** Nav has separate pills for Budget, Estimator, Full pricing, Payments, Spend. The orientation copy (audit #6 fix) helps explain each once you're on it, but for a first-time user the nav itself is a wall of similar-looking choices. Rachel does NOT need /pricing (planner-served only) or /estimator (forecast variant) before she has a budget.
- **Suggested fix:** Keep /budget and /payments in the top nav. Move /estimator, /pricing, /spend under a tab strip inside /budget (or a "Money" mega-section). For B2C couples, /pricing should redirect silently to /budget (the page already does this in some cases).

### 5. Top nav has 19 pills; mobile = horizontal scroll
- **Severity:** Friction
- **Effort:** 1 hr
- **Needs new SQL:** No
- **Files involved:** `apps/web/components/nav.tsx:35-55`
- **What's wrong:** 19 nav links. Mobile rendering is a horizontal-scroll strip with no overflow indicator (nav.tsx:233 — `overflow-x-auto`). Rachel won't scroll horizontally on her phone to find a feature she didn't know existed.
- **Suggested fix:** Pick 7-8 "primary" nav items (Dashboard, Plan, Venues, Vendors, Guests, Budget, Payments, Public site). Put the rest (Map, Availability, Compare, Estimator, Pricing, Timeline, Co-pilot, Autopilot, Tour) behind a "More" dropdown or in-context links from related pages.

### 6. /availability still defaults to "2027-09" when workspace has no wedding_date
- **Severity:** Friction
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/app/(app)/availability/page.tsx:32`
- **What's wrong:** Even though smoke test 19 was added 2026-05-08, the fallback constant is still `"2027-09"` (line 32). That's Hursh's Barcelona wedding month. A B2C couple who hits /availability before setting their date sees a calendar centered on September 2027 — confusing for Rachel whose wedding is Sept 12 2026.
- **Suggested fix:** Change the fallback to `new Date().toISOString().slice(0,7)` (current month) so a couple with no wedding date sees today, not legacy data. The smoke test guards the regression — keep it green.

### 7. Days-to-wedding shows "TBD" after the wedding date passes
- **Severity:** Polish
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/components/nav.tsx:214`
- **What's wrong:** Nav top-right tile: `daysUntil !== null && daysUntil >= 0 ? daysUntil : "TBD"`. For a workspace whose wedding date is in the past, this shows "TBD" — implying the date isn't set, when actually it just happened. Confusing for a couple coming back to plan thank-you cards / track final payments.
- **Suggested fix:** Render the absolute value with a "days since" suffix: when `daysUntil < 0`, show `{Math.abs(daysUntil)}` with eyebrow "Days since wedding" instead of "Days to wedding."

### 8. Dashboard hero subtitle says "{daysUntil} days until {workspace.wedding_date}" — formats as ISO
- **Severity:** Polish
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/app/(app)/page.tsx:634`
- **What's wrong:** The hero copy reads e.g. "124 days until 2026-09-12." The date is an ISO string, never formatted. Looks like a developer's debug output, not a wedding-planning app.
- **Suggested fix:** Wrap the date in `format(parseISO(workspace.wedding_date), "MMMM d, yyyy")` so it reads "124 days until September 12, 2026."

### 9. Dashboard "Welcome banner" has no Public site or Settings nudge
- **Severity:** Polish
- **Effort:** 30 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/components/couples-welcome/welcome-banner.tsx:52-90`
- **What's wrong:** The welcome banner pushes only the Co-pilot (one CTA). For Rachel landing fresh from onboarding, the obvious next moves are: (a) pick a public-site slug, (b) confirm wedding date + region, (c) generate the AI budget baseline. The banner doesn't surface any of those — and onboarding doesn't run if she came from an existing session, so the banner is the only first-load nudge.
- **Suggested fix:** Either turn the banner into a 3-step starter list ("Add your wedding date / Generate your budget / Pick your URL") or remove it entirely and lean on /onboarding for first-time guidance. The current half-effort is worse than either choice.

### 10. /vendors/find feature gate falls back to "preview" card silently — no useful message for Rachel
- **Severity:** Friction
- **Effort:** 30 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/app/(app)/vendors/find/page.tsx:81-85`; `apps/web/lib/feature-flags.ts`
- **What's wrong:** /vendors/find is the headline B2C feature (top right of /vendors). But it gates on `isFeatureReady("google_places") || isFeatureReady("brave_search")`. If neither API key is set in this environment, Rachel clicks the most prominent CTA on /vendors and lands on a "Feature preview" placeholder. That's a dead-end for her primary use case.
- **Suggested fix:** Either (a) make brave_search a hard requirement and check that key is set in production; or (b) make the empty fallback actionable — "Find vendors uses web search; ask your planner to enable it" plus a /vendors entry-point to manually add. Today the dead-end is the worst of both.

### 11. /onboarding chat sidebar disappears on mobile
- **Severity:** Friction
- **Effort:** 30 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/components/onboarding/onboarding-chat.tsx:249-465`
- **What's wrong:** The chat layout is `md:grid-cols-[minmax(0,1fr)_240px]`. On mobile (<md), the "What we know so far" sidebar collapses below the chat. The chat itself is `h-[calc(100dvh-220px)] min-h-[520px]` — a fixed-tall block. So on a phone, Rachel sees no progress indicator at all until she scrolls past the entire chat window (which keeps growing). She has no sense of how far through onboarding she is.
- **Suggested fix:** On mobile, render a slim progress bar above the composer (current `filledCount / FIELD_CHIPS.length` % already exists) so the progress signal is always visible. Keep the detailed sidebar collapsed-by-default below.

### 12. /guests/import and /guests/seating subpages have no back-link
- **Severity:** Polish
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/app/(app)/guests/import/page.tsx`; `apps/web/app/(app)/guests/seating/page.tsx`
- **What's wrong:** Both pages have a header but no "Back to guests" link. They were reachable via /guests buttons (Upload from Excel, Seating organizer), but once Rachel is on the seating page, she has to use the nav pill to get back. /settings/preferences and /settings/public-site both have an `ArrowLeft → Back to dashboard` — the guests subpages were missed.
- **Suggested fix:** Add the same `<Link href="/guests" ...>` ArrowLeft pattern to the top of both subpages. Match the visual treatment in settings/preferences/page.tsx:78-84.

### 13. Onboarding fallback default for guests = 120, budget = 75000 is shown unconditionally as input placeholder
- **Severity:** Polish
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/components/budget/empty-budget-tree.tsx:22-28`
- **What's wrong:** When a couple hits /budget without prior onboarding-extracted data, the form `useState` defaults to "120" and "75000". The inputs show these as VALUES, not placeholders — so Rachel might accidentally click "Generate my baseline" and get a 120-guest / $75k budget when hers is really 80 guests / $40k. The Sept 2026 Switch House persona has both numbers from intake (line 22 reads workspace.guest_count_estimate first), but if intake skipped budget or somehow didn't write back, she's silently presented with $75k.
- **Suggested fix:** Show the defaults as `placeholder=` attributes only when the workspace fields are null, not as initial state values. Make the user actively type them. The toast warns on non-positive values; a placeholder prompts the user to actually fill them.

### 14. Onboarding ?skip-onboarding=1 footnote exposes a URL trick in raw form
- **Severity:** Polish
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/components/onboarding/onboarding-chat.tsx:444-462`
- **What's wrong:** Sidebar footnote literally says "Visit /?skip-onboarding=1 to bypass entirely" with the URL as a styled link. Rachel doesn't need to know about query params; this looks like a dev hatch. Worse: a couple in mid-conversation might click it accidentally and skip the entire intake (the dashboard handles it but loses the chat history).
- **Suggested fix:** Replace the URL with a styled "Skip for now" Button that links to `/?skip-onboarding=1` — same destination, no URL syntax. Or remove this card entirely now that the dashboard handles re-entry gracefully.

### 15. /assistant subhead exposes "Haiku 4.5 · capped at 30 messages/day"
- **Severity:** Polish
- **Effort:** 15 min
- **Needs new SQL:** No
- **Files involved:** `apps/web/app/(app)/assistant/page.tsx:99`
- **What's wrong:** The Co-pilot eyebrow says "Workspace-aware AI · Haiku 4.5 · capped at 30 messages/day." "Haiku 4.5" is a model name Rachel has no context for, and the cap of 30 is fine to surface but the implementation detail isn't. Reads engineer-y.
- **Suggested fix:** Replace with "Workspace-aware AI · 30 messages a day" or surface the daily-used counter inline ("12/30 used today") inside the chat component, not the header.

## Items intentionally NOT flagged

- **Audit #8 (since-you-last-visited surface)** — deferred per Hursh's note; needs new SQL (per-user `last_seen_at` column or events table). Out of scope tonight.
- **Estimator vs Budget vocabulary** — even after collapse-the-money-pages (#4), there's a deeper question about whether "Budget" (your plan) vs "Estimator" (forecast) is a useful distinction for B2C couples. Leaving alone because the orientation copy fix from audit #6 is plausibly sufficient until we have real B2C user feedback.
- **AlertsBell empty state** — the bell next to sign-out renders but I didn't deep-read its empty state. Worth a future pass but low priority for first-time UX.
- **Co-pilot capability inconsistencies** — buildContext was expanded (audit #4 closed) but I didn't spot-check whether the AI vendor email drafts / autopilot context / Co-pilot have parity. That's a deeper investigation, not a finding.
- **/feature-status page existing at all** — arguably it shouldn't exist for B2C couples; it's a sales-y "look what we COULD do" surface. But removing requires a roadmap decision, not a fix.
- **Public site theme picker only has 5 themes** — fine for now; not user-facing-broken.
- **/timeline empty state when wedding date not set** — already gracefully gates with EmptyState (timeline/page.tsx:80-88). Good as-is.
- **Mobile rendering of /budget BudgetTree** — likely needs work, but I didn't spot a specific bug; deferred to a focused mobile audit.
