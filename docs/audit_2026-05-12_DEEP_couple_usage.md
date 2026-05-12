# Deep couple-side audit — 2026-05-12 (Acquired Planner)

**Audit posture:** Rachel McGrath, Sept 12 2026 wedding, Switch House Philadelphia pre-loaded.
**Method:** code-resolution walkthrough at file:line. Read-only — no prod mutation.
**Audited against commit:** 9f2fec6 (main).
**Prior audit absorbed:** `docs/audit_2026-05-12_couple_side.md` (15 findings — not repeated).
**Goal:** higher-resolution findings than the prior surface scan. Aim 30-60 items.

---

## Findings (severity, then user-flow position)

### 1. Co-pilot system prompt still self-identifies as "wedding-os" and names Astha as the planner
- **Location:** `apps/web/app/api/ai/chat/route.ts:28` and `:42`
- **What I saw:** The system prompt begins `You are wedding-os Co-pilot…` and then says `The user has a planner (Astha); your job is workspace-aware judgment.` Rachel has no planner (she's B2C) and the brand is Acquired Planner. The Co-pilot, when asked about its identity or when nudged off the rails, will leak both.
- **Why it matters:** This is the AI Rachel will lean on the most. Any moment it says "wedding-os" or talks like Astha is her planner is the moment she stops trusting it.
- **Severity:** Blocker
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Replace `wedding-os Co-pilot` with `Acquired Planner Co-pilot`. Remove the Astha sentence; replace with "Some users have a human planner, some are self-planning — be neutral and use what the workspace data tells you."

### 2. Co-pilot quick-action chips are hardcoded to Hursh's wedding scenarios
- **Location:** `apps/web/components/assistant/assistant-chat.tsx:21-28`
- **What I saw:** On an empty Co-pilot thread, Rachel sees 6 quick-action chips. One is literally `"Compare Option 1 vs Scenario 3 (Sept 11/12)"` and another mentions Sept 11/12 — Hursh's Barcelona Friday/Saturday option. Rachel has no "Option 1" / "Scenario 3," no scenarios in her workspace, and her wedding is Sept 12 — clicking that prompt asks the AI a question about something that doesn't exist.
- **Why it matters:** The very first thing Rachel sees on the Co-pilot page is a question from someone else's wedding. Catastrophic for trust + makes the AI look broken when it answers "I don't see those scenarios."
- **Severity:** Blocker
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Make the chips workspace-aware. If there are no scenarios, swap the "Compare Option 1" chip for something like "What's our biggest open task?" If there's a wedding date, surface "What should we tackle this month?". If no venues, swap "Which venue is the best fit at 200 guests?" for "What venues should I start with in Philadelphia?".

### 3. Co-pilot sidebar "What it knows" hardcodes "73 tasks"
- **Location:** `apps/web/components/assistant/assistant-chat.tsx:338`
- **What I saw:** Sidebar bullets read `· Plan progress (% done across 73 tasks)`. The starter checklist is actually 84 tasks (`apps/web/lib/starter-checklist.ts` — 84 entries). Rachel's plan will show 84, not 73. The literal "73" comes from an older era.
- **Why it matters:** Stale UI copy is the cheapest tell that nobody is dogfooding. A user who counts (and Rachel-types do count) will know the number is wrong.
- **Severity:** High
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Either compute the actual count and pass it in, or remove the parenthetical: just `· Plan progress (% done across your tasks)`.

### 4. Public wedding site falls back to "September 2027" hero subtitle when wedding_date is null
- **Location:** `apps/web/app/w/[slug]/page.tsx:325`
- **What I saw:** `const dateLabel = workspace.wedding_date ? formatDate(workspace.wedding_date) : "September 2027";`. If Rachel publishes her public site before saving wedding_date in settings (very plausible for a couple who wants to lock the URL first), her guests see literally "September 2027" — Hursh's wedding date.
- **Why it matters:** The most-shared, most-judged surface in the entire app silently shows a different couple's date. The prior audit caught "Barcelona, Spain" hardcoded — this is the *date* version of the same bug, and it survived.
- **Severity:** Blocker
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** When `wedding_date` is null, render nothing (or "Date TBD" if you want a placeholder). Never default to a real date that belongs to someone else's wedding.

### 5. `formatDate` on public site returns the ISO string on parse error
- **Location:** `apps/web/app/w/[slug]/page.tsx:700-706`
- **What I saw:** `function formatDate(d: string): string { try { return format(parseISO(d), "MMMM d, yyyy"); } catch { return d; } }`. If a wedding_date row has any malformed value, the catch returns the raw string — guests see e.g. "2026-09-12" in the hero. Unlikely-but-possible at scale (Postgres DATE → string).
- **Why it matters:** Low likelihood, public surface, ugly. The dashboard had this exact bug pre-audit-2.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Return `""` (omitting the chip) instead of the raw ISO. Already correct convention elsewhere.

### 6. Co-pilot context build expects scenarios but Rachel has none — uncertain failure path
- **Location:** `apps/web/app/api/ai/chat/route.ts:64` (Scenario type in context), `:35` (system prompt mentions Option 1 vs Scenario 3)
- **What I saw:** The Co-pilot context includes `scenarios:` and the system prompt says "For comparisons (Option 1 vs 3, Casa Del Mar vs MSL, etc.) give a structured pros/cons." For Rachel — who has no `pricing_scenarios` rows — Casa Del Mar / MSL are not in her workspace either. Asking "compare our venues" with one venue (Switch House) will likely produce a sycophantic but useless answer. The system prompt is over-fit to one specific wedding's data shape.
- **Why it matters:** Quality of AI answers, not just framing. Question 1-8 (Flow 3) will lean on this prompt; without examples scoped to "you have 1 venue and no scenarios," the AI may invent comparisons.
- **Severity:** High
- **Effort to fix:** 1hr (rewrite system prompt to be data-shape-agnostic)
- **Needs new SQL?:** No
- **Suggested fix:** Rewrite system-prompt examples to use generic phrasing — "compare two venues you've added," "what's due in the next 30 days." Drop the "Casa Del Mar vs MSL" example.

### 7. /budget Empty state `placeholder` defaults still show "Newport, RI" — wrong region for Rachel
- **Location:** `apps/web/components/budget/empty-budget-tree.tsx:120`
- **What I saw:** The region input on the AI-baseline form has `placeholder="Newport, RI"`. After audit-2 patched the dashboard's Sept 2027, the budget form still suggests Newport. Rachel's region from onboarding will be Philadelphia, so the placeholder will be overridden by the prefilled value — but if onboarding didn't extract region (likely on first attempt), Rachel types into an empty field with a Newport hint.
- **Why it matters:** Minor cognitive load — "is this software actually for me?" — repeated four or five times in form placeholders adds up.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Use a generic placeholder like `"e.g. Philadelphia, PA"` or even just `"City or area"`.

### 8. Budget tree slider step jumps wildly mid-drag because step rules use a formula
- **Location:** `apps/web/components/budget/line-row.tsx:172-179`
- **What I saw:** `sliderStep = sliderMax >= 50000 ? 250 : sliderMax >= 10000 ? 100 : sliderMax >= 2500 ? 25 : 10;`. The `sliderMax` is `Math.max((localEstimate || 1000) * 3, 5000)` — so as Rachel drags the slider higher, `sliderMax` can recompute on the next render and the step doubles (e.g. crossing into the >=10000 band changes step from 25 to 100). For a Rachel who's trying to land on $14,250 exactly, the slider can step over it.
- **Why it matters:** Frustrating UX when fine-tuning. The text input is the workaround (LineRow:307+ adds inline-edit), but the slider feels broken until you find that.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Either freeze step on initial render, or surface the inline-edit affordance more prominently (a "type exact $" tooltip on slider hover).

### 9. Budget tree shows `tipping` + `contingency` as separate top-level categories
- **Location:** `apps/web/lib/autopilot-types.ts:102-103` (BUDGET_CATEGORIES)
- **What I saw:** Tipping and Contingency are top-level parent rows in the AI baseline. Most US couples don't think of either as a separate "category" — tipping rolls into catering/music/transport, contingency is a single "buffer" line. Rachel will look at 19 top-level parents and ask "what's contingency?"
- **Why it matters:** Cognitive overhead at first glance — the budget appears more complex than it needs to be. Industry-conventional budget trees use ~12-15 categories, not 19.
- **Severity:** Medium
- **Effort to fix:** 1hr (decide groupings + migrate)
- **Needs new SQL?:** No (categories are TS-side; no DB enum exists)
- **Suggested fix:** Either fold tipping into a "Service charges & tips" sub-line under each vendor-category parent, or rename "Contingency" to "Buffer (5%)" so its purpose is obvious.

### 10. Budget delete uses native `window.confirm()` — jarring iOS modal
- **Location:** `apps/web/components/budget/line-row.tsx:354`
- **What I saw:** `if (confirm(\`Delete "${line.label}"?\`)) { onDelete(line.id); }`. On iOS Safari, native confirm shows the page URL (`wedding-os-production.up.railway.app says...`) above the message — Rachel sees "wedding-os-production" branding leak right when she's deleting something.
- **Why it matters:** Brand leak in the URL banner (compounds finding 1's "wedding-os Co-pilot" leak), and the native dialog feels un-Acquired-Planner. Other delete actions in the app use sonner toasts + AlertDialog, which is the consistent pattern.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Use a proper AlertDialog (already used by other delete actions, e.g. /timeline) or do a one-tap-with-undo pattern (delete optimistically, show toast with "Undo").

### 11. Onboarding chat's "We know so far" sidebar shows budget in $ but uses €-named DB column
- **Location:** `apps/web/components/onboarding/onboarding-chat.tsx:64-65`
- **What I saw:** `if (key === "budget_target_eur" && typeof v === "number") return \`${budgetSymbol}${v.toLocaleString()}\`;`. The display formats using `budgetSymbol` (correctly USD-aware), but a code reviewer sees "budget_target_eur" — a comment ALREADY in `vendor-pricing-tab.tsx:34-35` flags this: "DB columns still named *_eur for legacy reasons (Hursh's Barcelona workspace shipped first)". The bug isn't visible to Rachel today, but the API uses the same naming, so future bugs are pre-loaded.
- **Why it matters:** Tech debt that's user-facing in the wrong moment. Currently dormant; will bite when someone tries to add multi-currency.
- **Severity:** Low (foundational)
- **Effort to fix:** half-day (rename column + update all references)
- **Needs new SQL?:** Yes (column rename or computed view)
- **Suggested fix:** Rename column to `budget_target` or add a view alias. Update the field name in `IntakeExtractedData`.

### 12. Onboarding completion redirect strands Rachel if she completes intake but `wedding_date` extraction failed
- **Location:** `apps/web/app/(app)/page.tsx:64-118`
- **What I saw:** Dashboard gate: "if (no wedding_date AND no completed intake) → /onboarding." After completing intake, even if the AI didn't extract `wedding_date`, the workspace gets `wedding_date=null` but `intake_sessions.status=completed`, so the redirect doesn't fire. But the WelcomeBanner step 1 ("Add your wedding date") points at `/settings/preferences` — which means Rachel finishes a 3-minute chat and is told "now go set your date manually." That's a regression of the intake's main purpose.
- **Why it matters:** Onboarding sold itself as "your dashboard, pre-populated." If the AI fails to extract the date (and it can — Rachel might say "we want to get married next year sometime" or just skip dates), Rachel is told to redo the work she just did.
- **Severity:** High
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Onboarding completion handler should detect missing critical fields and either (a) explicitly ask one more time before completing, or (b) seed the WelcomeBanner step 1 with the actual chat-extracted value if any partial data was captured.

### 13. /onboarding re-entry "you're all set" panel offers `/budget` link but no /plan or /settings links
- **Location:** `apps/web/app/(app)/onboarding/page.tsx:137-147`
- **What I saw:** Two buttons: "Go to my dashboard" and "Open my budget." If Rachel wants to fix the wedding_date that wasn't extracted, or want to jump into her tasks, or upload guests — no nudge. She has to hunt in the 19-pill nav.
- **Why it matters:** Re-entry happens specifically when something feels off — the affordance set should match the most common reasons to re-visit.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Add a third button "Open my plan" and surface a small text link "Need to fix something? Edit in Settings".

### 14. /settings/preferences "BigDayForm" wedding_date input uses native `type="date"` — no placeholder, weak mobile UX
- **Location:** `apps/web/components/settings/big-day-form.tsx:75-80`
- **What I saw:** The Wedding date input is `<Input type="date" />` with no placeholder. On iOS Safari, the input renders as `mm/dd/yyyy` in light grey but tapping it opens the native wheel — no visible cue that it's tappable, and no Save button visible without scrolling on mobile (the form's Save button is on the right of the input row inside the card, but the card is the second of four cards on a `md:grid-cols-2` layout — on mobile they stack and Save is below the fold).
- **Why it matters:** Wedding date is the single most important field. If Rachel tries to add it on her phone and isn't sure if it saved, she'll either re-do it (annoyance) or skip (functional regression).
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Sticky save bar at the bottom of the page on mobile (the public-site editor already does this — re-use that pattern). Optionally add a visible date-picker hint icon.

### 15. /settings/preferences silently 404-style returns null if no workspace
- **Location:** `apps/web/app/(app)/settings/preferences/page.tsx:38, 45`
- **What I saw:** `if (!user) return null;` and `if (!profile?.workspace_id) return null;` — both silently render an empty page. Rachel never gets an error message, just a blank container with the layout nav still visible.
- **Why it matters:** Hard-to-diagnose. If something breaks in the user/profile fetch (RLS misconfig, expired session), the user sees nothing — not even a "log in again" prompt.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Either redirect to /login (consistent with the layout's own redirect at apps/web/app/(app)/layout.tsx:20) or render a clear error state.

### 16. Currency toggle blurb says "Default for US weddings (Newport, NJ, Texas…)"
- **Location:** `apps/web/components/settings/currency-toggle.tsx:21, 27`
- **What I saw:** USD option's blurb names "Newport, NJ, Texas, anywhere stateside." That's three US locations: Newport RI/Newport NJ/Texas. Newport NJ doesn't exist as a wedding destination — Newport is in Rhode Island (one of the most popular US wedding cities), so this reads as a typo. EUR option lists Barcelona, Paris, Tuscany, Lisbon — fine on its own but still leans on Hursh's reference set.
- **Why it matters:** Low-stakes copy nit but it's visible on /settings/preferences and reads sloppy.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** "Default for US weddings (Philadelphia, Charleston, Austin, anywhere stateside)."

### 17. /budget BudgetTree has no mobile-specific layout — sliders + dropdowns + delete on one row at 375px
- **Location:** `apps/web/components/budget/line-row.tsx:194` (header row uses `flex-wrap` but no breakpoint-specific layout)
- **What I saw:** Each leaf-row header uses `flex flex-wrap items-center gap-3 px-4 py-3` — at 375px viewport the row wraps but the slider underneath (line-row.tsx:367-404) is below, and the 3 progress bars below that. Rachel adjusts the slider on mobile by trying to drag a 6px-tall track between a vendor-link dropdown and a delete button. The slider-drag area collides with scroll.
- **Why it matters:** Money is the page she'll come back to most. On mobile, it's the page that feels least like a phone app and most like a misadapted desktop tool.
- **Severity:** High
- **Effort to fix:** half-day (mobile layout redesign for budget rows)
- **Needs new SQL?:** No
- **Suggested fix:** Mobile-only collapsed row: just label + amount + chevron-to-expand. Expanded reveals the slider in its own row, with explicit "+" / "-" buttons as backup to drag.

### 18. /payments has no "you have no vendors yet" empty state — page renders zeros + stats
- **Location:** `apps/web/app/(app)/payments/page.tsx:236-282`
- **What I saw:** For a fresh workspace with no vendors, the page renders four StatCards all showing $0, the PaymentsCalendar (which will be empty), and the page header. No EmptyState. Rachel will land here and see "Total committed: $0 · Paid to date: $0 · Due next 30 days: $0 · Overdue: $0" with no nudge to do something. Compare to `/timeline/page.tsx:80-88` which gracefully gates via EmptyState.
- **Why it matters:** The page communicates nothing actionable when empty. A "go add vendors to start tracking payments" hint would close the loop.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** When `milestones.length === 0 && plannerInvoices.length === 0`, render an EmptyState pointing to /vendors.

### 19. /spend page has no empty state — same problem as /payments
- **Location:** `apps/web/app/(app)/spend/page.tsx:78-103`
- **What I saw:** Page renders header + SpendTracker even when vendors[] is empty. SpendTracker itself probably renders zeros + an empty bar chart. Rachel can't tell whether the page is broken or whether she just doesn't have data.
- **Why it matters:** Same as #18. Compounds: Rachel sees five money pages (budget/estimator/pricing/payments/spend) and three of them just show zeros.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Empty state pointing to /vendors and /budget.

### 20. /payments shows "Total committed: $0 (Booked vendors only)" — no explanation of what "booked" means
- **Location:** `apps/web/app/(app)/payments/page.tsx:258-263`
- **What I saw:** First stat card sub-line is "Booked vendors only." Rachel won't know that means "vendors with status=booked." The status enum (placeholder/researching/quoted/booked/paid) is internal vocabulary. She'll wonder "why is it $0 — I have 3 vendors with quotes?"
- **Why it matters:** Direct user confusion. The stat is correct but unexplainable without a tooltip.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Either change copy to "Once vendors are 'booked'" with an "?" tooltip, or rename the stat to "Locked-in spend" with the same constraint.

### 21. /payments planner-invoice table renders only if `plannerInvoices.length > 0` — never shows for B2C
- **Location:** `apps/web/app/(app)/payments/page.tsx:290`
- **What I saw:** "Planner invoices" section is conditionally rendered. Correct logic for Rachel (no planner = no invoices = no section), but the rest of the page is structured around the section's presence. With it hidden, there's no "what to do next" CTA at the bottom of /payments — the calendar is the only thing below the stats.
- **Why it matters:** The page lacks a finishing chapter for B2C.
- **Severity:** Low
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Below the calendar, surface a B2C-only "What's missing?" card pointing to the next likely action (add deposits to existing vendors, etc).

### 22. /vendors/find form requires region — empty error message is technical
- **Location:** `apps/web/components/vendor-search/vendor-search-form.tsx:117`
- **What I saw:** `setError("Region is required — try 'Newport, RI' or 'Lake Como, Italy'")`. Same Newport/Lake Como leak. Also: the error only mentions one of the two requirements (category + region). If Rachel submits without a category selected, behavior unknown from this read; likely a different error.
- **Why it matters:** Geographic suggestions are wrong for Rachel and don't reflect her workspace's `wedding_region` (Philadelphia) — even though the form passes `defaultRegion` from her workspace, the error message still hardcodes Newport.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** "Region is required — e.g. your wedding city + state." Or even just "Where should I search?"

### 23. /vendors empty-state CTA "Find vendors with AI" links to a page that may be a dead-end
- **Location:** `apps/web/app/(app)/vendors/page.tsx:164-169` (the empty-state CTA), `apps/web/app/(app)/vendors/find/page.tsx:109-149` (the gate)
- **What I saw:** The primary CTA on the /vendors empty state is "Find vendors with AI" → /vendors/find. That page gates on `isFeatureReady("google_places") || isFeatureReady("brave_search")` (find/page.tsx:80-81). If neither is ready in prod (which the prior audit's finding 10 already flagged), Rachel clicks the main CTA and lands on a "Vendor search isn't turned on yet" placeholder. The fix from prior audit improved the placeholder copy but didn't kill the dead-end-CTA pattern.
- **Why it matters:** Compounds the prior finding. The empty state of /vendors should not point at the gated page when the gate is closed.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Compute `searchReady` server-side in /vendors/page.tsx too, and either hide "Find vendors with AI" or rename to "Browse vendor directory" when off.

### 24. /vendors shows `VendorCreateButton` even when planner-served — contradicts isPlannerServed gate elsewhere
- **Location:** `apps/web/app/(app)/vendors/page.tsx:145, 170`
- **What I saw:** The header has `{!isPlannerServed && <VendorCreateButton />}` but the empty-state action block (line 170) always renders `<VendorCreateButton />`. The empty state checks `isPlannerServed` to fork the description but not the button itself. So a planner-served couple with an empty vendor list gets a "Add Vendor" button in the empty state but not the header. Inconsistent.
- **Why it matters:** Rachel is B2C so this doesn't bite her directly, but a planner-served couple will see contradictory affordances.
- **Severity:** Medium
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Wrap the empty-state action in `!isPlannerServed` like the header.

### 25. /guests/import dropzone accepts any drag without a "this file looks wrong" preview
- **Location:** `apps/web/components/guests/import-wizard.tsx:60-65, 40-58`
- **What I saw:** `onDrop` calls `upload(file)` directly. There's no client-side mime/extension check — if Rachel drags a `.pdf` of her guest list (she might!), it ships to `/api/guests/import` and the server returns whatever error. The accept attribute (`.xlsx,.xls,.csv,...`) only applies to file-picker selection, not drag-drop.
- **Why it matters:** A Rachel who has guests in a PDF — common — drags it, sees a generic error, doesn't know it's because of the format.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** In `onDrop`, check `file.name` extension client-side first; if not in allowlist, show inline message "Drop an .xlsx or .csv. Got a PDF? Copy-paste names into a sheet first."

### 26. /guests/import preview-table is `overflow-x-auto` with 8 columns — unusable on mobile
- **Location:** `apps/web/components/guests/import-wizard.tsx:308`
- **What I saw:** The preview table has 8 columns of `<Input>` fields wrapped in `overflow-x-auto`. At 375px, Rachel sees Name + Side + half of Email, has to swipe horizontally to see anything past column 3. Each cell is an `<Input className="h-7 min-w-[140px] text-xs">` — taps don't always land on the right field on a small screen.
- **Why it matters:** Guest import is a flagship "look what we can do" feature. Mobile users will bounce hard.
- **Severity:** High
- **Effort to fix:** half-day (mobile preview redesign)
- **Needs new SQL?:** No
- **Suggested fix:** On mobile, render each row as a stacked card with collapsible "Edit details" — same data, vertical layout.

### 27. /settings/public-site editor has no character/length feedback for the "story" textarea
- **Location:** `apps/web/components/public-site/public-site-editor.tsx:135-145`
- **What I saw:** "Our story (Markdown)" textarea has `rows={6}` and no character counter, no preview, no Markdown help. Rachel types her story; she has no idea what the published version will look like until she saves + opens /w/<slug>.
- **Why it matters:** Trust loop: type → save → switch tab → reload → see. That's 4 steps to see your story render. Markdown looks scary without help.
- **Severity:** Medium
- **Effort to fix:** half-day (live preview pane)
- **Needs new SQL?:** No
- **Suggested fix:** Add a "Preview" toggle next to the textarea showing the rendered Markdown side-by-side, or below at narrow viewports. Add tiny help text: "Use **bold**, *italics*, [links](url). Press tab in the editor for indent."

### 28. /settings/public-site URL slug input has no live validation against `SLUG_RE`
- **Location:** `apps/web/components/public-site/public-site-editor.tsx:118-126`; regex at `apps/web/app/api/public-site/route.ts:50` (`SLUG_RE`)
- **What I saw:** Server validates with `/^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$/` (lowercase letters, numbers, dashes, 3-62 chars) but the input has no client-side check. Rachel types `Rachel & Mike` → clicks Save → toast errors with a tech-y message after a round-trip. Helper text below says "Lowercase letters, numbers, and dashes. 3–62 characters." but doesn't enforce.
- **Why it matters:** Slow feedback loop on a frustrating field — most people are bad at slugs intuitively.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** On change, auto-transform: lowercase, replace spaces with dashes, strip non-alphanumeric-or-dash. Show the cleaned version inline ("Will save as: rachel-and-mike"). Reject too-short/too-long client-side.

### 29. /settings/public-site theme picker preview is a flat gradient — doesn't show the actual theme
- **Location:** `apps/web/components/public-site/public-site-editor.tsx:43-49` (THEME_SWATCHES)
- **What I saw:** Theme cards show a 64px-tall gradient strip + label. Rachel clicks "Bollywood" and sees an amber-pink gradient. The actual public site has different fonts (modern theme is uppercase sans-serif vs classic serif), card styles, etc. — none of that previews.
- **Why it matters:** The theme decision is high-stakes for the public site, but the picker doesn't show what changes. Rachel won't know "modern" means uppercase sans-serif until she publishes.
- **Severity:** Medium
- **Effort to fix:** 1hr (use an iframe or a screenshot per theme)
- **Needs new SQL?:** No
- **Suggested fix:** Either show a real iframe preview of /w/<slug>?theme=preview, or capture 5 actual theme screenshots and use those as the card hero. Even just showing the heading in the right font would help.

### 30. /settings/public-site has no "draft saved X seconds ago" indicator after save
- **Location:** `apps/web/components/public-site/public-site-editor.tsx:65, 428-432`
- **What I saw:** `savedAt` is a timestamp, and the sticky bar shows "Saved" if `savedAt` exists — but the indicator stays "Saved" forever after the first save. There's no relative-time refresh ("Saved 2m ago") and no clear signal that *new* edits aren't saved yet.
- **Why it matters:** Rachel edits → saves → edits more → can't tell if her latest edits are draft-only. Public-site editing is high-stakes — needs a tighter "dirty / clean" indicator.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Track a `dirty` state alongside `savedAt`. When `dirty && !saving`, show "Unsaved changes" in amber. When `!dirty && savedAt`, show "Saved 1m ago" with relative time.

### 31. /settings/public-site "Publish" button is enabled even when no story / no schedule / no FAQ
- **Location:** `apps/web/components/public-site/public-site-editor.tsx:442-449`
- **What I saw:** `disabled={saving || !slug}` — the only client-side gate is the slug being non-empty. Rachel can publish a page with literally nothing on it except a URL — guests would see the hero (with Sept 2027 fallback per finding 4) and nothing else.
- **Why it matters:** Easy to publish empty by accident. Even a soft warning ("This page has no content yet — publish anyway?") would help.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** If `!story && !schedule.length && !faq.length && !registry_url`, show a confirmation: "Your public site is mostly empty. Publish anyway?"

### 32. /timeline `EmptyState` shows when items=0 + wedding_date is null — but renders TimelineEditor even when wedding_date is null
- **Location:** `apps/web/app/(app)/timeline/page.tsx:80-95`
- **What I saw:** The `EmptyState` gates on `itemsList.length === 0 && !hasWeddingDate`. The `<TimelineEditor>` is rendered unconditionally below. So if Rachel has 0 items AND no wedding date, she sees BOTH the EmptyState ("set your wedding date first") and the empty editor below.
- **Why it matters:** Cognitive whiplash — "you need to set your date first" with an editor below it looking like she can just type things in.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Hide the editor entirely when wedding_date is null AND there are no items.

### 33. /assistant chat composer "Send" button has icon-only label; screen-reader gets generic "Send"
- **Location:** `apps/web/components/assistant/assistant-chat.tsx:208-216`
- **What I saw:** `<Button ... ><Send className="h-4 w-4" /> Send</Button>`. The literal "Send" text is shown beside the icon but the button has no aria-label — fine sighted-side. Compare to the OnboardingChat which has explicit `aria-label={sending ? "Sending message" : "Send message"}` (onboarding-chat.tsx:380). Inconsistent accessibility patterns.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Match the OnboardingChat pattern.

### 34. /assistant doesn't show today's used count in a glanceable place — only in sidebar
- **Location:** `apps/web/components/assistant/assistant-chat.tsx:225-232`
- **What I saw:** "Today's usage: X/30" lives in the sidebar Card. On mobile (`lg:grid-cols-[minmax(0,1fr)_280px]` collapses below `lg`), the sidebar drops below the chat. Rachel won't see her usage until she scrolls past a 640px-tall chat window.
- **Why it matters:** Rate-limit awareness matters — Rachel hits 30 mid-conversation and is surprised.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Tiny inline usage count next to the composer ("3/30 today") with the Send button.

### 35. /assistant clearAll uses native `confirm()` — same iOS modal leak as budget
- **Location:** `apps/web/components/assistant/assistant-chat.tsx:124`
- **What I saw:** `if (!confirm("Delete this conversation? Cannot be undone.")) return;`. Same pattern as finding 10 — native confirm shows the URL.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** AlertDialog.

### 36. /assistant chat surface lacks an "I tried to add another event — sangeet on Friday" handoff path
- **Location:** `apps/web/components/assistant/assistant-chat.tsx` (no action plumbing); `apps/web/app/api/ai/chat/route.ts:42` ("you're advisory only")
- **What I saw:** System prompt explicitly says "Don't promise to send emails or take actions — you're advisory only." So when Rachel asks Q8 ("I want to add another event — sangeet on the Friday before. Can you?"), the AI says "no, I can't." But the system has no surface that handles this — there's no "add event" form on /settings/public-site labeled clearly enough for Rachel to find. The schedule editor is on /settings/public-site but it's for the *public site* schedule, not the planning-side event/role model.
- **Why it matters:** Indian/Hindu weddings often have 2-4 day event structures (sangeet, mehndi, ceremony, reception). Switch House Philadelphia is a popular Indian-wedding venue. Rachel may well need this, find no path, and the AI refuses to help.
- **Severity:** High (for multi-event weddings; latent for single-event)
- **Effort to fix:** day+ (multi-event data model — events table, per-event guest invitations, per-event timeline)
- **Needs new SQL?:** Yes (event_roles table or events table)
- **Suggested fix:** Document the gap; design an Events surface that supports adding/naming multi-day events. Short term: Co-pilot should respond with "I can't add events myself, but here's how — go to /timeline or /settings/public-site → Schedule, and add a row."

### 37. Co-pilot `WorkspaceContextSnapshot` doesn't include `intake_sessions.extracted_data` — Astha-handoff context broken
- **Location:** `apps/web/app/api/ai/chat/route.ts:135-198` (buildContext fetches don't include intake_sessions or anything planner-facing)
- **What I saw:** Rachel's Q5 ("Did Astha send us anything new?") would be answered with "I don't see any messages from Astha." The Co-pilot has no concept of planner_invoices being from a planner, no autopilot inbox awareness, no email_threads import. The context is workspace data only.
- **Why it matters:** A planner-served couple (not Rachel, but the system is supposed to work for both) is told "I don't see anything from your planner" when the planner is sending messages off-platform.
- **Severity:** Medium (B2B regression; not a Rachel-blocker)
- **Effort to fix:** half-day (extend context to include alerts, email_threads, planner_invoices)
- **Needs new SQL?:** No
- **Suggested fix:** Add `recent_planner_alerts` and `recent_invoices` sections to `buildContext`. Surface them so Co-pilot can answer "did Astha send anything."

### 38. Login page password mode shows "Forgot? Use the magic-link option above." but magic-link mode has no equivalent "stuck? use password" copy
- **Location:** `apps/web/app/login/page.tsx:211-213`
- **What I saw:** Password mode footer: "Forgot? Use the magic-link option above." Magic-link mode footer: "We'll email a single-use link. Stays signed in for ~7 days." If Rachel's email blocks magic links (corporate filters, etc.), there's no nudge back to password.
- **Why it matters:** Asymmetric guidance; users who get stuck on magic-link have less help.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Magic-link footer: "Didn't get the link? Switch to password above, or check your spam."

### 39. Login error states show raw Supabase messages on password-failure
- **Location:** `apps/web/app/login/page.tsx:60`
- **What I saw:** `if (signInError) { setError(signInError.message); ... }`. Supabase's messages for wrong-password are "Invalid login credentials." — fine but lower-case "credentials" and no contextual help (e.g. "try the magic-link option").
- **Why it matters:** A failed password attempt is a high-anxiety moment for the user. A friendlier mapping helps.
- **Severity:** Low
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Map common Supabase error codes to friendlier copy, similar to the onboarding chat's network-error mapping.

### 40. Nav `daysUntil` past-wedding label "Days since wedding" lives in nav.tsx but no celebratory state for the wedding day itself
- **Location:** `apps/web/components/nav.tsx:211-221`
- **What I saw:** `daysUntil === null ? "TBD" : daysUntil >= 0 ? daysUntil : Math.abs(daysUntil)`. Same conditional renders "Days to wedding" or "Days since wedding" but on the wedding day itself (daysUntil = 0), it shows "0" / "Days to wedding." No "Today's the day!" treatment.
- **Why it matters:** The biggest day of Rachel's life is exactly the same eyebrow + number as 30 days out.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** `daysUntil === 0` → render a special "Today" label (e.g. heart icon + "Today's the day").

### 41. AlertsBell shows "Loading…" with no skeleton — text just appears
- **Location:** `apps/web/components/alerts/alerts-bell.tsx:109-112`
- **What I saw:** When loading the bell dropdown, shows text "Loading…" — no skeleton, no spinner. Inconsistent with the rest of the app which uses Loader2 icons elsewhere.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Use `<Loader2 className="h-4 w-4 animate-spin" />` for consistency.

### 42. Layout has no `<main>` wrap with `role="main"` or skip-to-content link
- **Location:** `apps/web/app/(app)/layout.tsx:193`
- **What I saw:** `<main className="container flex-1 py-10">{children}</main>` — has the `<main>` tag (good) but no `aria-label` or skip-link. Keyboard users tabbing through the 19-pill nav have to tab through every link before reaching content.
- **Why it matters:** Accessibility — and the app advertises itself as wedding-planning for anyone. 19 tabs to skip is real friction.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Add a visually-hidden skip-link at the top of the layout: `<a href="#main" className="sr-only focus:not-sr-only ...">Skip to content</a>`. Add `id="main"` to the `<main>` tag.

### 43. Public-site schedule editor allows free-text dates ("Sat Sep 11") with no normalization
- **Location:** `apps/web/components/public-site/public-site-editor.tsx:243-254`
- **What I saw:** Date input is `<Input value={item.date ?? ""} ... placeholder="Sat Sep 11" />` — free text. Rachel can type "Friday" or "the 11th" or "Sept 11" inconsistently across rows. The public site renders them verbatim.
- **Why it matters:** The published schedule will look unprofessional with mixed date formats.
- **Severity:** Medium
- **Effort to fix:** 1hr (date picker + auto-format)
- **Needs new SQL?:** No (or use a JSON migration to normalize existing data)
- **Suggested fix:** Use a date picker that outputs a consistent format ("Sat, Sep 11") for each row, with a free-text override for things like "Welcome Week."

### 44. Public-site editor sticky save bar appears INSIDE the card flow — not pinned to the viewport
- **Location:** `apps/web/components/public-site/public-site-editor.tsx:427`
- **What I saw:** `className="sticky bottom-0 -mx-4 ... bg-white/90"` — sticky but the parent has `space-y-4` and the bar is the last element. Sticky works in the page-scroll container but with the layout's `<main className="container py-10">`, the bar sticks at the bottom of the page itself. On scroll, it stays at the bottom — okay — but at the bottom of /settings/public-site there are 7-8 cards (URL+story, theme, registry, schedule, travel+hotel, dress code, FAQ) so the bar is reachable only after scrolling through everything once. On mobile this means a LOT of scrolling.
- **Why it matters:** Save UX. The bar exists but only after a long scroll.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Use `fixed bottom-0` instead, or render two save bars (top of page + bottom).

### 45. /vendors/find result-card has untracked file `result-card 2.tsx` (duplicate filename)
- **Location:** `apps/web/components/vendor-search/result-card 2.tsx` (untracked); same dir has `onboarding-chat 2.tsx`, `vendor-search-form 2.tsx` (per git status)
- **What I saw:** Four untracked `* 2.tsx` files in the working tree (per the git status above). These are macOS-style filename collisions (the " 2.tsx" suffix is what Finder generates when the file is duplicated). They're not in the commit but they're in the codebase as Rachel-relevant files.
- **Why it matters:** Hygiene. Suggests an aborted merge or a Finder-drag mishap. Could leak into a build if someone accidentally imports them.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Delete the `* 2.tsx` files. Add `** 2.tsx` to .gitignore so future Finder mishaps don't pollute the tree.

### 46. /map empty state copy still says "We pin every venue with an address on a single map" — passive voice, no Rachel-action verb
- **Location:** `apps/web/app/(app)/map/page.tsx:33-37`
- **What I saw:** The page-header description has TWO copy variants based on `points.length === 0`. The empty variant: "We pin every venue with an address on a single map so you can see how they cluster — beach, city, countryside — at a glance." This describes what the page WILL do, not what to do. The EmptyState below (line 41-46) does have actions.
- **Why it matters:** Confused information architecture — the description sells the feature; the empty state asks for action. They duplicate effort.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Pick one. Either strip the description on empty state, or strip the EmptyState.

### 47. Public-site `parseCoupleName` strips everything after "—" — breaks for "Rachel & Mike's wedding" workspace names
- **Location:** `apps/web/app/w/[slug]/page.tsx:708-712`
- **What I saw:** `const segments = workspaceName.split("—").map((s) => s.trim()); return segments[0] || workspaceName;`. For Hursh's workspace `"Nisha & Hursh — Barcelona 2027"`, this strips "Barcelona 2027" to get "Nisha & Hursh." But for the *new* default convention from `couple-identity-form.tsx:46`, names compose as `"Rachel & Mike's wedding"`. The em-dash split won't match, so the hero shows "Rachel & Mike's wedding" instead of "Rachel & Mike."
- **Why it matters:** Hero typography for B2C couples will say "...'s wedding" — ugly + redundant on a wedding website.
- **Severity:** Medium
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Strip trailing `'s wedding` AND optional ` — region year`. Already done elsewhere (the same regex is in `couple-identity-form.tsx:30`).

### 48. /onboarding chat sidebar field chips show "First priority" with no example value when filled
- **Location:** `apps/web/components/onboarding/onboarding-chat.tsx:46, 57-69` (chipDisplayValue)
- **What I saw:** `chipDisplayValue` returns `String(v)` for unknown keys — including `first_priority_category`. If the AI extracts "venue" or "photo_video," the chip shows that snake_case string literally. Compare to BUDGET_CATEGORY_LABEL which maps snake_case → "Photo & video" — but `chipDisplayValue` doesn't use that mapping.
- **Why it matters:** Rachel sees "photo_video" or "first_priority" string-literal values in the sidebar. Reads engineer-y.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** For `first_priority_category`, look up `BUDGET_CATEGORY_LABEL[v]` before stringifying.

### 49. /assistant Cost Today guardrails text says "Haiku 4.5" — model name leak
- **Location:** `apps/web/components/assistant/assistant-chat.tsx:256`
- **What I saw:** `<strong>Cost guardrails:</strong> Haiku 4.5 + prompt caching. Workspace context is cached so most messages are pennies. Daily cap protects against runaway use.` Same "Haiku 4.5" leak that the prior audit flagged for the header (audit_2026-05-12_couple_side.md finding 15) — it was fixed in the header but remained here.
- **Why it matters:** Anthropic model names mean nothing to Rachel. "$0.0004" + "messages this thread cost about pennies" is enough.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** "Workspace context is cached so most messages are pennies. Daily cap protects against runaway use."

### 50. /budget summary card "Vs target" delta uses Unicode minus (−) for negative, ASCII + for positive — visual inconsistency
- **Location:** `apps/web/components/budget/budget-tree.tsx:225-227`
- **What I saw:** `{delta >= 0 ? "+" : "−"}{symbol}...`. The negative case uses U+2212 (`−`) while the positive uses U+002B (`+`). They render at different widths in some fonts.
- **Severity:** Low (visual nit)
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Use `+` and `-` for both, or use `+` / `−` consistently.

### 51. Dashboard "Welcome banner" 3-step starter only ever pushes ONE pending step (not all 3)
- **Location:** `apps/web/components/couples-welcome/welcome-banner.tsx:83-115`
- **What I saw:** The `steps[]` array uses `if/else if/else if` so only the *first* incomplete step appears. Plus the always-present "Talk to the AI Co-pilot." So the banner shows 2 tiles max. The audit-2 fix message ("3-step starter list") implies all three but only one shows.
- **Why it matters:** Rachel sees Step 1 (Add wedding date) + Co-pilot. After fixing the date, she sees Step 2 (Generate budget) + Co-pilot. Could be intentional ("one at a time") but the audit-2 docs and the prior `mb-4 grid gap-2 sm:grid-cols-2` (line 150) suggest a more visible all-three pattern.
- **Severity:** Low (intentional?) — but if intentional, copy "3-step" is misleading
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Either render all 3 with checkmarks for completed ones (more "todo list" feel) or update the audit doc to clarify the one-at-a-time choice.

### 52. /payments calendar component uses currency symbol from workspace but vendor `*_eur` fields might be stored in actual EUR for legacy workspaces
- **Location:** `apps/web/app/(app)/payments/page.tsx:115-120`
- **What I saw:** `baseCurrency = workspace?.base_currency ?? "USD"` and formats with `formatCurrency(n, baseCurrency)`. The comment at line 117 explicitly says: "The amount_eur columns are misnamed historically — they're really 'amount in workspace base currency' (US couples store USD here, EU couples store EUR)." But this is a runtime assumption with no validation. A workspace that flips currency USD↔EUR mid-flight would now show the wrong symbol on existing amounts.
- **Why it matters:** Rachel won't trip this, but it's a latent multi-tenancy bug. If a planner imports estimates from Astha's EUR workspace into a USD couple's workspace, totals will be wrong by ~10x (USD/EUR exchange ratio inverted).
- **Severity:** Medium (latent)
- **Effort to fix:** day+ (audit existing data + add `amount_currency` column)
- **Needs new SQL?:** Yes (column)
- **Suggested fix:** Add `amount_currency` to vendors / budget_estimates / planner_invoices. Backfill existing rows from workspace.base_currency. Display formatted in the row's own currency.

### 53. /vendors/find page heading "Find vendors" duplicates the same heading from /vendors header
- **Location:** `apps/web/app/(app)/vendors/find/page.tsx:97-99` and `apps/web/app/(app)/vendors/page.tsx:124-126`
- **What I saw:** /vendors h1 is "Vendors"; /vendors/find h1 is "Find vendors." The back-link "Back to vendors" suggests they're parent/child, but the duplicated word "vendors" makes the breadcrumb redundant.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Rename /vendors/find h1 to "Discover" or "Search the directory."

### 54. /onboarding "Skip for now" link is rendered as `<a href="/?skip-onboarding=1">` inside a `<Button asChild>` — uses full-page nav, not router
- **Location:** `apps/web/components/onboarding/onboarding-chat.tsx:478-487`
- **What I saw:** `<Button asChild variant="ghost"><a href="/?skip-onboarding=1">Skip for now...</a></Button>`. Native `<a>` causes a hard navigation; Next's router-aware Link would be faster. Minor but inconsistent — most other in-app nav uses Link.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Use `next/link`.

### 55. /budget "Generate baseline" toast says "Drag any one to re-balance" — but the slider drag UX is broken on mobile (finding 17)
- **Location:** `apps/web/components/budget/empty-budget-tree.tsx:60-62`
- **What I saw:** Toast text after generate: "Generated ${json.lines_inserted} budget lines. Drag any one to re-balance." On mobile, Rachel can't drag (per finding 17) — the toast literally instructs an action that doesn't work.
- **Severity:** Medium
- **Effort to fix:** 15min (copy fix)
- **Needs new SQL?:** No
- **Suggested fix:** "Generated 84 lines. Tap any one to edit." Cross-platform.

### 56. /guests/import "Claude cost $0.0042" leak in preview header
- **Location:** `apps/web/components/guests/import-wizard.tsx:236-238`
- **What I saw:** `{preview.cost_usd !== undefined && (<> · Claude cost {formatMoney(preview.cost_usd, "USD")}</>)}`. Rachel imports her guest list and the preview tells her "Claude cost $0.0042." She doesn't know who Claude is or why she should care.
- **Why it matters:** Backend cost leaks into user-facing UX. Same family as the model-name leaks (findings 1, 49).
- **Severity:** Medium
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Remove the cost display from the user view (keep server-side logging for ops). At most, tuck it in a "details" pop-over for the curious.

### 57. /guests/import shows "Heuristic mapping (no API key)" badge — internal-state leak
- **Location:** `apps/web/components/guests/import-wizard.tsx:251`
- **What I saw:** Badge text: "Heuristic mapping (no API key)" when `claude_used` is false. Rachel doesn't manage API keys.
- **Severity:** Medium
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** "Basic column mapping" if AI is off. No mention of API keys.

### 58. /vendors empty-state planner-served branch uses passive "Reach out to your planner if you have a specific vendor in mind"
- **Location:** `apps/web/app/(app)/vendors/page.tsx:151-155`
- **What I saw:** Description: "Reach out to your planner if you have a specific vendor in mind." No contact info, no button, just a sentence. Compare to /autopilot's planner-served splash which at least links to /vendors and /payments.
- **Severity:** Medium (B2B, not Rachel-impact)
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Surface the planner's email/phone if available (workspace has `org_id` → org has contact_email).

### 59. Public site `/w/<slug>` "Plan with X" footer always appears for B2C couples if their org has a published booking site — strange CTA for Rachel
- **Location:** `apps/web/app/w/[slug]/page.tsx:608-664`
- **What I saw:** The "Plan with {planner.name}" section renders when `planner` is non-null AND `bookSlug` (an org with a published /book/ page). For a B2C-self-serve Rachel, her org is the "Acquired Planner" platform org. If that org has a published booking page, her wedding site invites her own guests to "book a consult with Acquired Planner." That's a CTA she didn't write and didn't approve.
- **Why it matters:** Public-site users see a "book a consult with planner" CTA on a couple's wedding site — confusing for guests, awkward for the couple.
- **Severity:** High (depends on org config — but if not currently broken, it's one config away)
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Gate the footer on workspace.skin: only render for `co_branded` / `white_label` / `acquired_style_collab`, not for plain `acquired_planner` (which is B2C self-serve).

### 60. /spend page description says "For your plan see /budget; for the payment calendar see /payments" — inline cross-linking in p tag
- **Location:** `apps/web/app/(app)/spend/page.tsx:88-93`
- **What I saw:** The description paragraph has two inline `<a className="underline">` links. The convention works (the budget page has the same), but it's clear the prior audit's "five money pages" finding (#4) is still unresolved — the page descriptions are doing the navigation work the nav can't.
- **Why it matters:** Workaround pattern that signals the structural problem isn't fixed.
- **Severity:** Medium (referencing prior unresolved item)
- **Effort to fix:** half-day (per prior audit)
- **Needs new SQL?:** No
- **Suggested fix:** See prior audit finding 4.

### 61. Onboarding chat "Reconnecting…" toast can fire mid-fast-response — 3s timer doesn't know reply just arrived
- **Location:** `apps/web/components/onboarding/onboarding-chat.tsx:152-154`
- **What I saw:** `slowTimer = setTimeout(() => setReconnecting(true), 3000)`. If a response takes exactly 3.1s, "Reconnecting…" briefly appears even on success. The cleanup at line 211 runs in `finally`, but state set in the setTimeout can flicker between 3000ms and the response arrival.
- **Why it matters:** Confusing UX flash on borderline-fast responses.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** Move the indicator to a "delayed loading" pattern using `useDeferredValue` or a longer threshold (5s).

### 62. /plan auto-derived tasks may show stale due_date if wedding_date changes after task creation
- **Location:** `apps/web/app/(app)/plan/page.tsx:105-110`
- **What I saw:** `if (t.due_date) return t; if (t.months_before == null || !weddingDate) return t; ... d = addMonths(parseISO(weddingDate), -t.months_before)`. The compute only runs when `due_date` is null. If the seed wrote due_date as `wedding_date - 12mo` and Rachel then updates wedding_date in /settings, those due_dates don't re-derive.
- **Why it matters:** Wedding-date moves (postponements happen!) → tasks anchored to the old date.
- **Severity:** Medium
- **Effort to fix:** 1hr (re-anchor logic on wedding_date PATCH)
- **Needs new SQL?:** No (logic-only)
- **Suggested fix:** On `/api/workspace/preferences` PATCH when wedding_date changes, recompute every planning_task.due_date from months_before.

### 63. Error boundary `console.error` log line still includes "[wedding-os root error boundary]" string
- **Location:** `apps/web/app/error.tsx:20`
- **What I saw:** `console.error("[wedding-os root error boundary]", error);`. User won't see this directly (DevTools only), but anyone screen-sharing during a support call WILL see it. Brand leak via dev console.
- **Severity:** Low
- **Effort to fix:** 15min
- **Needs new SQL?:** No
- **Suggested fix:** `console.error("[acquired-planner root error]", error);`

### 64. /assistant chat scrolls to bottom on every render even when user is reading mid-thread
- **Location:** `apps/web/components/assistant/assistant-chat.tsx:62-64`
- **What I saw:** `useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, sending]);`. Every message append triggers smooth-scroll-to-bottom. If Rachel scrolls up to re-read a previous answer mid-conversation, the next message yanks her back down.
- **Why it matters:** Common chat-UX rule: only auto-scroll if user is already at the bottom.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** Track scroll position; only auto-scroll when `scrollTop + clientHeight >= scrollHeight - 100` (user is at/near bottom). Otherwise show a "↓ new message" pill.

### 65. /onboarding chat textarea autoFocus runs every re-render via useEffect — can fight mobile keyboards
- **Location:** `apps/web/components/onboarding/onboarding-chat.tsx:122-126`
- **What I saw:** `useEffect(() => { if (!sending && !complete) { textareaRef.current?.focus(); } }, [sending, complete]);` Plus `autoFocus` on the textarea itself (line 372). On mobile Safari, autofocus + programmatic focus can pop the keyboard at moments the user didn't expect, especially when assistant replies arrive.
- **Why it matters:** Mobile UX. Rachel's keyboard popping up while she's reading the AI's response.
- **Severity:** Medium
- **Effort to fix:** 30min
- **Needs new SQL?:** No
- **Suggested fix:** On mobile (`window.matchMedia('(max-width: 768px)')`), skip the programmatic focus.

---

## Top-10 most user-impactful findings

These are the items Rachel will hit hardest in her first hour or first share-with-friends moment:

1. **Co-pilot system prompt still says "wedding-os" + names "Astha" as planner** (finding 1) — invisible to Rachel until she pushes on the AI; then it leaks.
2. **Co-pilot quick-action chips hardcoded to Hursh's wedding** (finding 2) — visible on first /assistant load, the chip literally references "Option 1 vs Scenario 3 (Sept 11/12)."
3. **Public-site hero falls back to "September 2027" when wedding_date is null** (finding 4) — Rachel's guests see Hursh's date.
4. **Onboarding completion silently strands Rachel if wedding_date wasn't extracted** (finding 12) — the AI sells "we'll pre-populate everything" then asks her to do it manually.
5. **/budget mobile UX is broken — slider doesn't drag cleanly at 375px** (finding 17) — the most-revisited page, broken on her primary device.
6. **/guests/import preview table is 8 columns wide on mobile** (finding 26) — flagship feature, unusable for a Rachel who does this on her phone.
7. **Co-pilot context can't answer "did Astha send anything new"** (finding 37) — and "73 tasks" in the sidebar is wrong (finding 3) — chatbot will look unaware.
8. **Public-site "Plan with X" footer can fire for B2C couples** (finding 59) — Rachel's guests see a "book a consult with Acquired Planner" CTA she didn't approve.
9. **/payments + /spend have no empty states** (findings 18-19) — three of the five money pages just show zeros with no path.
10. **Multi-event weddings have no first-class surface** (finding 36) — Switch House Philadelphia hosts a lot of Indian weddings; Rachel may need sangeet/mehndi support and finds nothing.

---

## Themes

1. **Brand/founder leaks survived audit-2.** Six findings (1, 2, 3, 10, 22, 49, 63) are hard-coded references to "wedding-os," "Astha," "Casa Del Mar/MSL," "Haiku 4.5," "Newport," or "73 tasks." The earlier surface scan hit the loudest leaks; the deep scan finds them in API system prompts, dev console output, model names, and stale counts. **There is no programmatic brand-leak guard** — these will re-appear with every new feature unless we add a smoke-test that greps the served HTML for `wedding-os|Astha|Hursh|Barcelona|Haiku|MSL`.

2. **Empty states are inconsistently designed.** Some pages use the shared `EmptyState` component (timeline, map, compare, venues, availability, guests). Three money pages don't (budget has a custom card-form combo; payments and spend just render zeros). The result: Rachel learns one mental model, then it stops applying halfway through.

3. **Mobile breaks at the "money" + "data input" surfaces.** /budget, /guests/import, /settings/public-site editor — all designed desktop-first, with `flex-wrap` + `overflow-x-auto` as the only mobile concessions. Three findings (14, 17, 26, 30, 34, 44) cluster here.

4. **Confirm dialogs are inconsistent.** Some destructive actions use AlertDialog (timeline), some use native `confirm()` (budget delete, assistant deleteThread). The native-confirm path leaks the URL on iOS, compounding the brand-leak theme.

5. **The Co-pilot is structurally weakest at the moments it needs to be strongest.** Six findings target the assistant: identity leak (1), example mismatch (2), stale stats (3), advisory-only refusal pattern (36), context-build gaps (37), and mobile usage visibility (34). It's the AI Rachel will lean on the most and the surface that least feels finished.

6. **The B2B/B2C fork is enforced via `isPlannerServed` checks scattered across pages.** Most pages get it right but the fork is duplicated in many places (vendors, autopilot, dashboard, vendors/find, payments). One miss (finding 24 — VendorCreateButton inconsistency, finding 59 — Plan-with-planner footer) and the user experience contradicts itself. **A higher-order `<IfB2C>` / `<IfB2B>` wrapper, or a single source of truth, would prevent drift.**

7. **Toast-based feedback is the only confirmation pattern.** Save / delete / generate all rely on sonner toasts. Toasts are 2-second flashes — Rachel who looks away misses them entirely. Some pages add `savedAt` indicators (public-site editor) but the pattern isn't generalized.

8. **The five money pages problem is unsolved and visible in the audit findings.** Three findings (18, 19, 21, 60) all reference downstream effects of having Budget / Estimator / Pricing / Payments / Spend as five different surfaces. The prior audit flagged this as finding 4; this audit shows the problem cascading through empty states, copy, and inline cross-linking.

---

## What I couldn't audit + why

1. **Real iOS/Android device testing.** I read the code and inferred from class-name patterns; couldn't actually take 375px screenshots. Findings 14, 17, 26, 34, 44 are confident based on the code but might shake out differently on the real device.
2. **Live 500-error path.** I can't trigger a real prod 500 without DB access. Error boundary copy was inspected, but real-world rendering across error.tsx / loading.tsx / not-found.tsx wasn't visually tested.
3. **The actual AI answer quality for the 8 Co-pilot questions.** I read the system prompt and context builder but didn't have a way to call the prod API as Rachel. Finding 6 / 36 / 37 are about the prompt structure; the actual answer-shape is unverified.
4. **/api/onboarding/turn extraction accuracy.** I read the Co-pilot's context builder but not the onboarding extraction prompt. If onboarding fails to extract `wedding_date`, that ripple effect (finding 12) is real but the underlying extractor logic wasn't read.
5. **Permission-denied / /admin path for B2C.** I confirmed the /(admin)/layout.tsx redirect, but did not test that every admin sub-route enforces this — a single route that bypasses the layout could leak admin views.
6. **The Stripe payment-link flow in /payments.** Untouched; flagged for future audit.
7. **Public-site `RsvpForm` + `InquiryForm` for guests.** Read the imports; didn't audit the actual guest-side UX.
8. **The intake-session → workspace data sync.** What gets written back to workspaces.guest_count_estimate / budget_target_eur / wedding_region from the chat — verified only by reading complete/route.ts excerpts.

---

## Confidence level

**Medium-High.** Strong on:
- Code-level findings with concrete file:line citations
- Brand-leak findings (grep-verifiable)
- Architectural patterns (B2C/B2B fork, empty states, money pages)
- The Co-pilot system-prompt audit (finding 1, 2, 3, 6, 37)

Weaker on:
- Mobile-specific findings (17, 26) — confidence high from code, but no live render
- AI answer-quality findings (6, 36) — couldn't test
- The "five money pages" downstream effects — confidence high but the fix is structural and depends on user research

The recommendations are stable: even if I missed one or two mobile-specific issues, the brand-leak / empty-state / Co-pilot themes are independently verifiable.
