# wedding-os — state of the build (May 8 2026)

> Comprehensive map of what's built, what works, what's broken, and what's
> next. Two product surfaces: **B2B** (Astia-style planner serving couples)
> and **B2C** (DIY couples like Kyle / John / `rodnj.ops`). They share
> codebase + database; the consumer-side polish lags the planner-side.
>
> Read this when picking up cold or onboarding new collaborators.

---

## 1. What wedding-os is

Three product surfaces stacked on one Supabase + Next.js codebase:

1. **B2B Planner SaaS** (`/admin/*`) — sells to wedding planners as a
   competitor to Aisle Planner / Honeybook / Plannit. Planner manages
   library / playbook / clients / vendors / invoices / leads from `/admin`.

2. **B2B Couple shell** (couple `/` shell, planner-served) — a couple
   owned by a planner sees a polished read+limited-write workspace.
   Planner pre-populates venues, vendors, plan; couple RSVPs guests,
   answers Q&A, updates deposits, etc. **This is the shell Hursh+Nisha
   tested in for months. Most polished surface.**

3. **B2C DIY Couple** (couple `/` shell, no planner) — same shell as #2
   but the couple IS the workspace owner (`org_admin` of their own org).
   AI replaces the planner via `/onboarding`, `/budget`, `/autopilot`,
   `/assistant`. **This is the new buggy surface — built fast on top of
   #2 by stripping planner-gates and swapping in AI.**

The overlap between #2 and #3 is the value: same UI, different role
gates. Friction lives where #2's planner-assumes-data architecture leaks
into #3's empty-couple-cold-start flow.

---

## 2. Numbers as of May 8 2026

- **27 SQL migrations applied** to Supabase project `dfyryyzizxcxtysduono`
- **~205 routes** (Next.js App Router)
- **~50 tables** (workspaces, vendors, venues, guests, planning_tasks,
  budget_lines, leads, contracts, proposals, planner_invoices,
  planner_expenses, time_entries, gmail_connections, intake_sessions,
  alerts, autopilot_runs, etc.)
- **3 storage buckets**: `venue-photos`, `library-media`, `documents`
- **3 waves of parallel agent builds**: 8 + 12 + 8 = 28 agents shipped
- **Hosting**: Railway (auto-deploys from GitHub `main`)
- **Domain**: `wedding-os-production.up.railway.app`

---

## 3. Test accounts

All passwords: `Wedding2027!`. Sign in at /login → toggle to "Password" mode.

| Email | Workspace | Role | Use for |
|---|---|---|---|
| `hurshpatel@greenskynj.com` | Astia | org_admin (true planner) | Planner-side testing |
| `astha@astiaevents.com` | Astia | org_admin | Astha's view |
| `hurshpatel95@gmail.com` | Hursh & Nisha — Barcelona 2027 | couple (planner-served) | The B2B-couple POV with rich seeded data |
| `nishadesai98@gmail.com` | Hursh & Nisha — Barcelona 2027 | couple | Multi-user couple shell |
| `rodnj.ops@gmail.com` | Hursh's test wedding | couple (DIY) | **B2C cold-start testing** |
| `kcdevine96@gmail.com` | Kyle & Michelle — Newport | couple (DIY) | Real friend Kyle |
| `j.salicandro@gmail.com` | John's wedding | couple (DIY) | Real friend John |

---

## 4. Architecture map

### Couple-side shell (`/(app)/`)

| Route | What | Status (B2B-couple) | Status (B2C-DIY) |
|---|---|---|---|
| `/` | Dashboard | ✅ rich w/ Hursh+Nisha seeds | ✅ AutopilotTodayWidget mounted, redirects to /onboarding for cold-start |
| `/onboarding` | AI chat intake (10 questions + venues + anything-else) | n/a | ✅ Built — captures all fields + venue_candidates + free_form_notes; auto-inserts venues w/ Places enrichment; auto-seeds 84-task checklist on complete |
| `/assistant` | AI Co-pilot (workspace-aware Haiku, $5/day cap) | ✅ | ✅ |
| `/autopilot` | Today's queue + vendor pipeline + Gmail status | ✅ | ✅ |
| `/plan` | 12-month checklist | ✅ 73 seeded tasks | ✅ 84-task starter checklist auto-seeded post-onboarding |
| `/venues` | Venue list + add | ✅ 6 seeded | ✅ couples can now add (admin-gate removed); auto-populated from chat |
| `/venues/[id]` | 7-tab venue drill | ✅ | ✅ |
| `/vendors` | Vendor list + add | ✅ | ✅ couples can add (already worked) |
| `/vendors/find` | **Google Places vendor search** | ✅ | ✅ Places key wired ✓ — search returns 10 real local vendors |
| `/vendors/[id]` | Vendor drill (4 tabs) | ✅ | ✅ has AnalyzeWithAiButton + AutopilotStatusBlock |
| `/vendors/compare/[category]` | Side-by-side quote compare | ✅ | ✅ |
| `/budget` | **AI region-aware budget tree** (84 lines, sliders, vendor auto-link) | n/a | ✅ Sonnet generates personalized tree from guest count + region |
| `/payments` | Couple-side payment milestones | ✅ | ✅ |
| `/guests` | Guest list w/ Excel import | ✅ | ✅ Excel import + Add now visible to couples |
| `/guests/import` | AI Excel ingest wizard | ✅ Sonnet 4.6 + tool use | ✅ |
| `/guests/seating` + `/guests/seating/[planId]` | Seating organizer | ✅ floor plan + assignments + must/can't sit constraints | ✅ |
| `/guests/dashboard` | Live RSVP dashboard | ✅ | ✅ |
| `/timeline` + `/timeline/day-of` + `/timeline/print` | Run-of-show editor + mobile day-of view + PDF | ✅ | ✅ |
| `/availability` | Venues × dates matrix | ✅ admin-edits cells | ✅ couples now edit cells; empty-state with "configure venue first" CTA |
| `/map` | Leaflet map of venues | ✅ | ✅ |
| `/compare` | 3-up venue side-by-side spec | ✅ | ✅ |
| `/settings/public-site` | Public wedding site editor (5 themes) | ✅ | ✅ |
| `/settings/gmail` | Gmail OAuth connect | ✅ Setup pending UI when env unset | ✅ |
| `/feature-status` | Tour of every feature (live vs setup pending) | ✅ | ✅ |

### Planner-side admin shell (`/(admin)/admin/*`)

| Route | What | Status |
|---|---|---|
| `/admin` | Studio sales-pitch dashboard (revenue YTD, leads, vendor pipeline, calls) | ✅ |
| `/admin/welcome` | 5-step new-planner onboarding wizard | ✅ |
| `/admin/inbox` | Cross-client task inbox | ✅ |
| `/admin/leads` + `/admin/leads/[id]` | Lead pipeline + drill + convert-to-client | ✅ |
| `/admin/proposals` + drill + new + edit | Branded proposal builder + send + couple-view at `/proposal/[token]` | ✅ |
| `/admin/contracts` + drill + new | E-sign contracts + `/sign/[token]` couple view + audit | ✅ |
| `/admin/library/{venues,vendors}` | Org-scoped library + AI brochure intake | ✅ |
| `/admin/playbook` + `/admin/playbook/phases/[id]` | Master playbook editor + recurrence config | ✅ |
| `/admin/vendors` | Vendor CRM (Gmail banner) | ✅ |
| `/admin/clients` + `/admin/clients/[id]` | Client roster + drill (Overview / Branding / Billing / Documents / Activity / Time / Settings) | ✅ |
| `/admin/billing` | Cross-client invoice roster + Stripe payment-link generator | ✅ |
| `/admin/finances` | Studio P&L: revenue + expenses + time tracking + monthly bars | ✅ |
| `/admin/analytics` | Revenue YTD / YoY / lead funnel / per-client revenue | ✅ |
| `/admin/booking` | Public-listing config + recurring availability windows | ✅ |
| `/admin/marketing` | SEO scorecard agent (Sonnet 4.6) | ✅ |
| `/admin/testimonials` | Request → submit → publish flow | ✅ |
| `/admin/settings/team` | Invite teammates, manage team_role | ✅ |
| `/admin/settings/email-templates` | Save + reuse email templates | ✅ |
| `/admin/settings/lead-routing` | Auto-assign rules with priority | ✅ |
| `/admin/settings/calendar` | Google Calendar / iCal sync | ✅ |
| `/admin/feature-status` | Tour mirror of couple-side | ✅ |

### Public surfaces (no auth)

| Route | What |
|---|---|
| `/marketing` | SaaS landing for new planners |
| `/signup` | Self-serve planner signup |
| `/couples-signup` | Self-serve B2C couple signup |
| `/book/[orgSlug]` | Calendly-style consult booking |
| `/w/[slug]` | Couple's public wedding site (5 themes, RSVP CTA, plan-with-us section) |
| `/rsvp/[token]` | Per-guest self-serve RSVP + plus-one self-add |
| `/sign/[token]` | Couple click-to-sign contract |
| `/proposal/[token]` | Couple proposal view + accept/decline |
| `/testimonial/[token]` | Couple submission of post-wedding testimonial |

---

## 5. Integrations / env vars

| Env var | Status | What it enables |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Set | Co-pilot, onboarding, budget AI, autopilot, scorecards |
| `SUPABASE_*` | ✅ Set | Database, auth, storage, RLS |
| `GOOGLE_PLACES_API_KEY` | ✅ Set | `/vendors/find` search + venue auto-enrich on onboarding |
| `GMAIL_OAUTH_*` | ⚠️ User configuring | Couple Gmail connect → vendor reply autopilot loop |
| `STRIPE_SECRET_KEY` + webhook | ❌ Not set | Per-invoice payment links, couple online pay |
| `RESEND_API_KEY` | ❌ Not set | Real outbound email (contract/proposal confirmations, mass guest msgs, daily digest) |
| `GOOGLE_OAUTH_*` (calendar) | ❌ Not set | Booking page busy-slot dimming |
| `BRAVE_SEARCH_API_KEY` | ❌ Not set | Vendor search fallback (Places primary) |
| `CRON_SECRET` | ❌ Not set | Daily 8 AM digest mailer |

Show full feature catalog with env-readiness checks at `/feature-status`.

---

## 6. Database — key tables

### Core
- `organizations` — orgs (planners + DIY couples each have one)
- `workspaces` — one per couple. Has wedding_date, wedding_region, base_currency, style_tags, guest_count_estimate, budget_target_eur, public_slug, public_theme_slug, public_published_at, autopilot_enabled
- `users` — links auth.users to org_id + workspace_id with role (admin/couple) + org_role (org_admin/member) + team_role (owner/planner/assistant)

### Couple data
- `venues` + `venue_visits` + `venue_photos` + `venue_notes` + `venue_questions` + `venue_decisions` + `venue_pricing` + `venue_date_marks`
- `vendors` + `vendor_tasks` + `vendor_attachments` (with autopilot_status, autopilot_enabled, last_inbound_at, quote_eur, quote_summary, ai_summary, gplaces_*)
- `guests` + `guest_event_invitations` + `guest_imports` (with is_plus_one, plus_one_of_guest_id, plus_one_max)
- `planning_tasks` — 84-task checklist auto-seeded for B2C couples
- `playbook_phases` + `playbook_tasks` — org-scoped templates (with recurrence_rule + recurrence_anchor)
- `floor_plans` + `seating_assignments`
- `timeline_items`
- `pricing_categories` + `pricing_line_items` + `pricing_scenarios` (Astia-era)
- `budget_estimates` (Astia-era /estimator)
- `budget_lines` — Wave 3 tree with parent_line_id self-ref + amount_estimated/committed/paid + vendor_id

### Planner OS
- `library_venues` + `library_venue_media` + `library_vendors`
- `workspace_branding`
- `planner_invoices` + `planner_expenses` + `time_entries`
- `leads` + `lead_routing_rules`
- `contracts` + `proposals` + `testimonials`
- `email_templates`
- `documents` (storage_path-prefixed: `vendor/<id>/...` or `<workspace>/...`)
- `payment_links` + `stripe_customers` + `subscriptions`
- `marketing_scorecards` + `booking_windows`
- `calendar_connections` + `calendar_busy_slots`

### Autopilot (Wave 3)
- `intake_sessions` — onboarding chat state
- `gmail_connections` — per-workspace Gmail OAuth
- `vendor_search_cache` — 7-day Places result cache
- `alerts` — couple/planner alert feed
- `autopilot_runs` — AI call trace + cost

### AI / costs
- `ai_conversations` + `ai_messages` + `ai_usage_daily`
- `pricing_intake_sources` + `pricing_intake_proposals` + `pricing_change_log`

---

## 7. AI architecture

| Surface | Model | Tool? | Cost guard |
|---|---|---|---|
| `/assistant` Co-pilot | Haiku 4.5 + prompt cache | No | 30 msg/user/day |
| `/onboarding/turn` | Sonnet 4.6 | `extract_intake_fields` | $5/org/day non-chat |
| `/api/email/draft` | Sonnet 4.6 | `emit_email_draft` | $5/org/day |
| `/api/pricing/intake/upload` | Sonnet 4.6 vision | `propose_pricing_changes` | $5/org/day |
| `/api/budget-lines/generate-baseline` | Sonnet 4.6 | `emit_budget_baseline` | $5/org/day |
| `/api/admin/marketing/scorecard` | Sonnet 4.6 | `emit_scorecard` | $5/org/day |
| `/api/autopilot/analyze-thread` | Sonnet 4.6 | `emit_vendor_status_change` | $5/org/day |
| `/api/autopilot/run-followup` | Sonnet 4.6 | `emit_followup_draft` | $5/org/day |
| `/api/autopilot/draft-outreach` | Sonnet 4.6 | `emit_personalized_rfps` | $5/org/day |
| `/api/guests/import` | Sonnet 4.6 | `map_guest_columns` | $5/org/day |

All non-chat calls write to `autopilot_runs` (or `ai_messages` for chat) with cost_usd + tokens for billing visibility.

---

## 8. PENDING — ranked by what blocks Kyle/John from real use

### 🔥 Critical bugs surfaced May 8 (couples-side polish)
- [x] Couples can't add venues manually — admin gate removed (`0263ca6`)
- [x] Couples can't add guests / import Excel — admin gate removed (`0263ca6`)
- [x] `/availability` says "Read-only — admin can edit" — fixed (`0263ca6`)
- [x] `/estimator` shows "Astia's two PDFs" — scrubbed + redirects to /budget when empty (`8530032`)
- [x] Onboarding skipped budget/style/priority questions — fixed (`5356ad9`)
- [x] /plan empty for B2C couples — manually seeded for the 3 test accounts; auto-seed in onboarding/complete (`66254c8`)
- [x] AI chat doesn't capture venues mentioned — venue_candidates now extracted + auto-inserted with Places enrichment (`66254c8`)
- [x] No way to revisit onboarding chat — added `/onboarding` "Setup chat" nav link (`0263ca6`)
- [ ] **Currency: should default USD with EUR toggle** — currently EUR-primary in many displays (estimator, budget, payments, spend, planner_invoices)
- [ ] **Login redirect bug**: dual-role couples (org_admin + role=couple) bounce to /admin instead of /. Workaround: demoted 3 test accounts to org_role=member. Real fix: middleware checks role too.
- [ ] **`/admin/welcome` redirect for non-Astia orgs**: a fresh org_admin signing up at /signup gets the wizard but it might be Astia-specific in copy. Verify.

### ⚠️ Real-use bugs likely to surface in Kyle's week 1
- [ ] **Vendor quote upload** — drag PDF onto vendor → stored in /documents but no UI to mark it as the "official quote" or extract amount via AI
- [ ] **Quote history** — only latest `quote_eur` stored. If vendor sends "$5k for option A, $7k for option B," we lose option A.
- [ ] **Gmail attachment auto-save to documents bucket** — Gmail thread body is read by THREAD-ANALYZER; PDF attachments aren't pulled into per-vendor /files
- [ ] **Couple-shell currency switch** — workspace.base_currency exists but most pages hardcode €/$ symbols. Need a `lib/format-currency.ts` helper that reads workspace context.
- [ ] **Seating plan respects new RSVPs** — claim it works (drag from unassigned pool); needs verification against new guest additions post-floor-plan creation.
- [ ] **Onboarding intake doesn't honor `/onboarding?reset=1`** — re-entering after completion creates a new session but the AI doesn't know it's a follow-up. UX: should greet "Welcome back — what changed since last time?" instead of starting fresh.

### 📐 Architecture cleanup (surfaces that bleed B2B → B2C)
- [ ] **Hursh+Nisha workspace data is "real" but read-only-ish for testing** — when Hursh changes things via couple shell as `hurshpatel95@gmail.com`, those edits affect HIS Astia test workspace. Need a way to fork it / freeze it as a demo set.
- [ ] **Pricing template (Astia-era) still loads on /budget for Astia clients** — couples assigned to Astia's org might see Astia's quoted prices auto-fill via legacy code paths. Should verify: does `budget_lines` truly stay separated from `pricing_line_items` for couples in Astia's org?
- [ ] **"View as workspace" picker in /admin nav** sends planner to / as that couple — but session-cookies and active_workspace_overrides interaction with B2C couples isn't tested.

### 🚀 Real next features (post-bug-cleanup)

**Planner-side (Astha would ask for these):**
- [ ] Stripe payment links wire-up + webhook (set keys → it works)
- [ ] Resend wire-up + DNS (set keys → it works)
- [ ] WhatsApp Cloud API for vendor outreach (Astha's primary channel)
- [ ] Multi-team fully tested (currently single-owner; team invites work but role-permission depth is shallow)
- [ ] Calendar sync productionized (polling cron + Google webhook)

**Couple-side (Kyle would ask for these):**
- [ ] Kyle's actual Gmail → autopilot loop (Hursh wires Gmail OAuth)
- [ ] Vendor quote PDF auto-attach + AI line-item extraction
- [ ] Seating plan AI auto-arrange (already in schema, needs UI)
- [ ] Mobile wedding day live timeline + crisis chat
- [ ] Mood board / Pinterest-style inspiration
- [ ] Mass guest SMS (currently email only)

**B2C-specific gaps:**
- [ ] Couples-signup → `/admin/welcome`-style quick first-tasks tour for couples (we have /onboarding but it's chat; some couples want a checklist setup)
- [ ] Onboarding → AI suggests vendor categories based on style_tags + first_priority_category
- [ ] Public wedding site theme picker IS in /settings/public-site, but no preview before save
- [ ] Couple-shell branding (workspace-level color/logo) — exists for planner-served couples; B2C couples have a default. Add a "make it yours" customization step to onboarding.

---

## 9. Known bugs Hursh has called out (as of May 8)

| Bug | Status | Fixed in commit |
|---|---|---|
| Estimator says "Astia's two PDFs" | ✅ FIXED | `0263ca6` → fully rebuilt `f34ba69` |
| Estimator removed entirely (mistake) | ✅ RESTORED | `f34ba69` rebuilt to pull from budget_lines |
| Plan is empty for B2C couples | ✅ FIXED | Manual seed + auto-seed in `66254c8` |
| Plan tasks not editable (Monday-style) | ✅ FIXED | `f34ba69` — pencil icon → drawer w/ phase/due/owner/category/notes |
| Onboarding skipped budget/style/priority | ✅ FIXED | `5356ad9` |
| Onboarding doesn't ask "anything else?" | ✅ FIXED | `66254c8` |
| AI chat doesn't capture venues mentioned | ✅ FIXED | `66254c8` |
| Couples can't add venues / guests | ✅ FIXED | `0263ca6` |
| `/availability` "Read-only" message | ✅ FIXED | `0263ca6` |
| Astia/Astha references everywhere | ✅ FIXED | `0263ca6` (25 files scrubbed) |
| dual-role couple login → /admin | ✅ WORKAROUND (demoted 3 test accts to org_role=member) | TBD: middleware fix to check role too |
| Currency primary EUR not USD | ❌ OPEN | Next priority |
| Magic link burned by email preview | Use email+password (`Wedding2027!`) | n/a |
| Hobby Railway plan queued builds | ✅ Queue cleared | n/a |

---

## 10. How to pick this back up cold

1. `cd ~/Documents/wedding-os`
2. `pnpm install` (only if needed)
3. Read this doc + `docs/SESSION-SNAPSHOT.md` (older but has cold-start commands + DB password)
4. Sign in at https://wedding-os-production.up.railway.app/login as `hurshpatel@greenskynj.com` / `Wedding2027!`
5. Test surfaces using the test-account roster in §3
6. Pending items in §8 are ranked top-to-bottom by impact

For new work: when Hursh asks for a feature that touches both planner + couple shell, build for couple shell and verify planner shell still works (rare to need a planner-only fix anymore — the patterns are stable).

---

## 11. The honest assessment Hursh asked for

**B2B planner side** (`/admin/*`): well-tested, sales-pitch-ready. Astha can use it Monday morning. Has Wave 1 + Wave 2 polish.

**B2B couple side** (couple shell when planner-served): also polished — Hursh+Nisha workspace with real seeded data is the proof. Plan, venues, vendors, guests, public site, seating, all work.

**B2C couple side** (couple shell, DIY): **was rougher.** Built fast on top of B2B couple by stripping admin gates and adding /onboarding + /budget. As of today's commits (`5356ad9` → `66254c8` → `0263ca6` → `8530032`):
- Onboarding chat now thorough (9 fields + anything-else)
- Plan auto-seeds 84 tasks
- Venues mentioned in chat auto-create with Places enrichment
- Couple-shell admin gates removed
- Astia/Astha leak scrubbed across 25 files
- `/estimator` redirects to `/budget` for empty workspaces

But the consumer surface still has real friction:
- **Currency defaults to EUR** — not great for US couples
- **Vendor quote upload UX** — exists but rough
- **Gmail attachments not pulled** — only message body
- **Onboarding revisit UX** — works mechanically but doesn't acknowledge "you've already done this once"
- **Compare venues / Map** — useful but undertested for B2C

The right next step: get Kyle / John actually using it for real wedding planning, fix what they hit. The bugs in #9 are what I've found internally; users will surface 2x more.
