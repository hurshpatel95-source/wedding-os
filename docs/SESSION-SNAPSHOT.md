# wedding-os — session snapshot (May 2026)

The state of the build at end-of-session. Use this when context compresses
or when picking the work back up cold.

> **Last update — major: planner-OS pivot landed.** wedding-os is now
> architected as a multi-tenant SaaS for wedding planners (any planner,
> not Astia-branded). One org per planner, one workspace per couple
> client. Two completed waves of parallel-agent work shipped today:
>
> - **Estimator** at `/estimator` — couple-side honest budget seeded from
>   Astia's two PDFs (Casa+MSL €222,686 / Casa+Xalet €229,726), inline
>   edit, side-by-side compare view. Local-only — no master template push.
> - **Wave 1 — Foundation slab** — `org_role` enum + 6 new tables (library
>   venues/vendors/media, playbook phases/tasks, workspace branding) + `/admin`
>   route shell with auth gate. Astha + Hursh-admin migrated to `org_admin`.
> - **Wave 2 — 5 parallel agents** — Library Venues + Library Vendors +
>   Playbook editor + `/plan` customization + Client roster + Branding
>   editor + New-client onboarding + push-to-workspace components.
>
> 35+ routes, 14 SQL migrations, 7 logins. See "Planner-OS architecture"
> section below for the full layout.

---

## TL;DR

Couple-side venue intelligence portal for Hursh & Nisha's Sept 2027 Barcelona
wedding, architected multi-tenant from day one. **15 routes**, **11 SQL
migrations**, **73 seeded planning tasks**, **6 venues**, **7 scenarios**, **48
date-availability marks**. Two AI features (Co-pilot chat + Pricing intake),
one AI assist (Email drafts). Live on Railway with 7 working logins.

---

## URLs + creds

| Thing | Where |
|---|---|
| Production | https://wedding-os-production.up.railway.app |
| Local dev | http://localhost:3200 |
| GitHub | https://github.com/hurshpatel95-source/wedding-os (`main` branch) |
| Supabase | https://supabase.com/dashboard/project/dfyryyzizxcxtysduono |
| Workspace path | `/Users/hurshpatel/Documents/wedding-os` |

**Logins (all use password `Wedding2027!`):**

| Role | Email | Persona |
|---|---|---|
| admin | astha@astiaevents.com | Astha (planner) |
| **admin** | **hurshpatel@greenskynj.com** | **Hursh (admin test view)** |
| couple | hurshpatel95@gmail.com | Hursh (couple) |
| couple | nishadesai98@gmail.com | Nisha |
| couple | Nirvisd@umich.edu | Nirvi |
| couple | Devaldesai73@gmail.com | Deval |
| couple | Sdndesai@msn.com | Sandy |

**Env vars (Railway + apps/web/.env.local):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_FX_EUR_USD=1.08`
- `ANTHROPIC_API_KEY` (in chat history — rotate at https://console.anthropic.com/settings/keys post-handoff)

**DB password (used by `_apply_one.ts`):** `gLtdK0Co8fMAp1pZ` — Project Settings → Database in Supabase

---

## Stack

- **Next.js 14.2.35** (App Router, TypeScript, Tailwind, shadcn/ui primitives)
- **Supabase** (Postgres + Auth + Storage + RLS) — single project, single workspace
- **pnpm 9.15.9** monorepo with `apps/web`, `packages/db`, `packages/lib`
- **Anthropic SDK 0.94** — Sonnet 4.6 for vision/extraction, Haiku 4.5 for chat
- **Leaflet 1.9 + react-leaflet 4.2** for the map view
- **SheetJS (xlsx)** for Excel parsing
- **date-fns** everywhere
- **Fraunces (display) + Manrope (body)** via `next/font/google` — warm cream `#F9F6F1` palette, rose-amber accent

Hosting: **Railway** (auto-deploys from GitHub `main`).

---

## All routes (15 total, all admin/couple gated by middleware)

| Route | Purpose |
|---|---|
| `/login` | Magic link OR password (toggle pills) |
| `/auth/callback` | Supabase OAuth code exchange |
| `/` (dashboard) | Hero countdown, activity feed (real, not dummy), 4 stat cards, top 3 lead-pick venues |
| `/assistant` | **Co-pilot chat** — Haiku 4.5 + workspace context + 30/day cap |
| `/plan` | **A-Z project tracker** — 73 seeded tasks, phase-grouped, auto-derived from data |
| `/venues` | Grid + filters (status / event_role / IO / catering / capacity / sort), bulk actions (admin) |
| `/venues/[id]` | 7 tabs: Overview / Photos / Visits / Notes / Q&A / Pricing / Decision |
| `/map` | Leaflet matrix of all 6 venues with status pins |
| `/availability` | Venues × dates matrix with 6-status enum, deck-seeded |
| `/vendors` | Index grouped by category (Design/Capture/Music/Glam/Ceremony/Logistics/F&B), bulk actions |
| `/vendors/[id]` | 4 tabs: Overview / Pricing / Tasks / Files. AI compose-email button. |
| `/guests` | Filterable table + RSVP stats + AI compose buttons (save-the-date / nudge pending) |
| `/guests/import` | **AI Excel ingest wizard** — drop XLSX/CSV → Claude maps columns → review → commit |
| `/pricing` | **Scenario studio** — 3 saved scenarios, MSL spaces breakdown, custom lines, vendor rollup, comparison strip |
| `/payments` | Milestones calendar + list view, mark-paid (admin) |
| `/spend` | Forecast vs actual, scenario picker, per-category + per-vendor breakdowns |
| `/compare` | 3-up venue side-by-side spec table |
| `/timeline` | Day-of run-of-show editor + `/timeline/print` for vendor PDF |
| `/settings/pricing` | Template control room — line items + recent intakes + change log + AI intake CTA |
| `/settings/pricing/intake` | **AI Pricing intake wizard** — drop screenshot/PDF/text → Claude extracts → review → apply |
| `/estimator` | **Estimator** — list of planner-PDF-seeded budget scenarios |
| `/estimator/[id]` | Builder — section-grouped lines, inline price override, toggle, auto-save |
| `/estimator/compare` | Side-by-side compare of two scenarios with line-by-line deltas |

### Planner-OS admin routes (org_admin only)

| Route | Purpose |
|---|---|
| `/admin` | Studio dashboard — stat cards (clients / library size / activity) |
| `/admin/library` | Hub linking to venues + vendors |
| `/admin/library/venues` | Venue library — grid, search, filter, sort |
| `/admin/library/venues/[id]` | Edit venue + media manager (drop-folder upload) |
| `/admin/library/venues/new` | Create venue (with optional AI brochure intake) |
| `/admin/library/vendors` | Vendor library grouped by category |
| `/admin/library/vendors/[id]` | Edit vendor |
| `/admin/library/vendors/new` | Create vendor |
| `/admin/playbook` | Master playbook editor — phases + tasks templates |
| `/admin/playbook/phases/[id]` | Phase drill-in detail |
| `/admin/clients` | CRM-style roster of couple workspaces |
| `/admin/clients/[id]` | Drill-in tabs: Overview / Branding / Activity / Settings |
| `/admin/clients/[id]/branding` | Per-couple accent color + logo + planner display name |
| `/admin/clients/new` | Create new client workspace + couple invite (magic link) |
| `/admin/settings` | Wave-2 placeholder |

### Planner-OS API routes

`/api/admin/library/venues/*` (POST/PATCH/DELETE + media + brochure intake), `/api/admin/library/vendors/*`, `/api/admin/playbook/{phases,tasks,apply}`, `/api/admin/clients/[id]/branding`, `/api/admin/clients/[id]/branding/logo`, `/api/admin/clients/new`, `/api/admin/push/{library-venue,library-vendor,playbook}`.

---

## Schema — 14 migrations

`supabase/migrations/`:

1. `20260505000001_init.sql` — orgs, workspaces, users, venues, venue_visits, venue_photos, venue_notes, pricing templates+categories+line items, venue_pricing, pricing_scenarios + 5 enums + updated_at trigger
2. `20260505000002_rls.sql` — RLS on every workspace-scoped table; helpers `auth_workspace_id()`, `auth_org_id()`, `auth_role()`, `auth_is_admin()`
3. `20260505000003_storage.sql` — `venue-photos` bucket, public read
4. `20260505000004_event_roles.sql` — `event_role` enum + `venues.event_roles` text[]
5. `20260506000001_vendors.sql` — vendors + vendor_tasks + vendor_attachments + 28-category enum + private `vendor-files` bucket
6. `20260506000002_lead_picks.sql` — `venues.is_lead_pick boolean`
7. ~~`20260506000003`~~ (skipped number, hire-fee columns added in `20260506000005` series)
8. `20260506000004_decision_qa_pros_cons.sql` — `venues.pros/cons text[]` + `venue_decisions` + `venue_questions`
9. `20260506000005_guests.sql` — guests + guest_event_invitations + guest_imports + private `guest-imports` bucket
10. `20260506000006_run_of_show.sql` — timeline_items
11. `20260506000007_planning_tasks.sql` — planning_tasks with phase + category + owner + auto_derive_kind
12. `20260506000008_venue_availability.sql` — venue_date_marks + 6-status enum
13. `20260506000009_ai_assistant.sql` — ai_conversations + ai_messages + ai_usage_daily
14. `20260506000010_pricing_intake.sql` — pricing_intake_sources + pricing_intake_proposals + pricing_change_log + private `pricing-intake` bucket
15. `20260506000011_budget_estimates.sql` — `budget_estimates` table for /estimator (per-couple JSONB blob, RLS open to workspace members)
16. `20260506000012_planner_os.sql` — **MAJOR**: `org_role` enum + `users.org_role` + 6 org-scoped tables (`library_venues`, `library_venue_media`, `library_vendors`, `playbook_phases`, `playbook_tasks`, `workspace_branding`) + `library-media` bucket + RLS gated on `auth_org_role() = 'org_admin'`
17. `20260506000013_org_admin_workspaces_visibility.sql` — additive RLS so org_admins can read every workspace in their org (needed for the picker, /admin/clients roster, push-to-workspace)
18. `20260506000014_plan_customization.sql` — `planning_tasks.phase_id` (FK to playbook_phases) + `planning_tasks.is_user_added` boolean default false

**Pattern**: every workspace-scoped table has RLS with `workspace_id = auth_workspace_id()`. Admin-only workspace writes use `auth_is_admin()`. Org-scoped tables (library/playbook) use `auth_org_role() = 'org_admin'`. Sensitive features (pricing intake, vendors) are admin-only on read+write.

---

## Seed scripts (`supabase/seed/`)

| Script | What it does | When |
|---|---|---|
| `_apply_one.ts` | Apply one SQL migration via direct pg connection | Whenever you add a migration |
| `apply_migrations.ts` | Apply ALL migrations in order | Initial setup |
| `seed.ts` | Org + workspace + 3 users + 6 venues + pricing template + 28 line items | Initial setup |
| `seed_scenarios.ts` | 3 scenarios (Sitges / Barcelona / Sept 11/12 Hybrid) | Initial setup |
| `seed_planning_tasks.ts` | 73 A-Z tasks across 9 phases | Initial setup |
| `seed_venue_availability.ts` | 48 deck-derived date marks (Casa Del Mar 9/4+5+17, Xalet 9/6+18, etc.) | Initial setup |
| `seed_timeline_template.ts` | Sangeet + Wedding day-of timeline | Optional |
| `tag_event_roles.ts` | Mark venues with which events they can host | Initial |
| `tag_lead_picks.ts` | Mark Casa Del Mar / MSL / ME Barcelona as lead | Initial |
| `merge_yacht_into_marina.ts` | One-shot: yacht venue → Marina Port Vell | Already ran |
| `update_emails.ts` | Replace placeholder emails with real | Already ran |
| `update_scenario_3.ts` | Update Scenario 3 to Sept 11/12 lead dates | Already ran |
| `set_passwords.ts` | Set `Wedding2027!` for all 7 users + create admin | Re-run if rotating |
| `set_hero_photos.ts` | Pick first JPG per venue as hero | Already ran |
| `geocode_venues.ts` | Hardcoded lat/lng for the 6 venues | Already ran |
| `fix_capacities.ts` | CdM + Marina Port Vell to 250 cap | Already ran |
| `gen_magic_link.ts` | Bypass email rate-limit, get a one-shot magic link | Use anytime |
| `invite_couple.ts` | Bulk-create couple users + magic links | Already ran for in-laws |
| `ingest_photos.ts` | Upload local venue folders → Supabase Storage | Already ran (51 photos) |

`pnpm` scripts in root `package.json` for the common ones (`db:seed`, `db:seed-scenarios`, etc.).

---

## AI architecture (3 places, 3 different patterns)

### 1. Co-pilot chat (`/api/ai/chat`, `/assistant`)
- **Model**: Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Caching**: workspace context (venues + vendors + scenarios + guests + plan stats) rendered as a `cache_control: ephemeral` system block. Most turns hit cache → 10× discount on input.
- **Cap**: `DAILY_CAP = 30` messages/user/day. Hard 429 when exceeded.
- **Memory**: last 12 turns sent. Older messages drop off.
- **Output cap**: 700 tokens.
- **Cost tracking**: every turn writes input/output/cache tokens + cost_usd to `ai_messages` and rolls up into `ai_usage_daily`.
- **Worst case**: $5.30/week at full daily cap × 7 users. Realistic: <$1/week.
- **System prompt**: stops Claude from inventing data, makes it cite real prices/names.

### 2. Pricing intake (`/api/pricing/intake/upload`, `/settings/pricing/intake`)
- **Model**: Sonnet 4.6 — vision-capable for screenshots, structured extraction.
- **Tool use**: forced `tool_choice: { type: "tool", name: "propose_pricing_changes" }`. Claude returns structured `proposals[]` with confidence + verbatim quote.
- **Catalog injection**: existing line-item catalog passed in user content so Claude can match by `line_item_id`.
- **Apply flow**: per-proposal accept/edit/reject. Default-price → UPDATE `pricing_line_items`. Override → merge into `venue_pricing.overrides` JSONB. New → INSERT new line item. Every mutation writes a `pricing_change_log` row with `actor_kind='ai_intake'` + source_id + proposal_id + evidence.
- **Auto-apply gate** (designed but not enforced yet): confidence ≥ 0.92 AND single match AND no needs_info → auto-apply. Currently always shows review screen.
- **Cost**: per-intake $0.02–0.10 depending on source size. Bills only when admin drops something.

### 3. Email drafts (`/api/email/draft`, vendor + guest pages)
- **Model**: Sonnet 4.6
- **Tool use**: `emit_email_draft` returns subject + body + to_suggestion + reply_by.
- **7 kinds**: vendor_rfp / vendor_followup / vendor_contract_reminder / vendor_payment_nudge / guest_save_the_date / guest_rsvp_nudge / guest_update / custom. Each has its own system prompt for tone.
- **Context**: per-vendor full row OR per-guest filter (e.g. "where rsvp=pending"). Workspace info always included.
- **Output**: ComposeDialog gives copy-to-clipboard, .eml download, or "Open in Gmail" deep link.
- **No actual sending** — Astha pastes into her existing email. Gmail integration is the "Phase 2" callout shown on /vendors and in the compose dialog footer.

### 4. Guest Excel ingest (`/api/guests/import`)
- Parses XLSX/CSV with SheetJS, sends header + sample rows to Claude with `map_guest_columns` tool. Claude returns column mapping + normalized rows + per-row warnings. UI lets admin edit + commit. Falls back to header-name heuristics when ANTHROPIC_API_KEY missing.

---

## Key design decisions (locked in)

1. **Multi-tenant from day one.** Every workspace-scoped table has `org_id` + `workspace_id` even though MVP runs one workspace. RLS enforces both. Lift to multi-planner SaaS without rewrite.
2. **Hand-rolled `Database` types in `packages/db/src/types.gen.ts`.** Mirrors what `supabase gen types typescript` would output. Some newer tables (vendors, ai_*, pricing_intake_*) use minimal client casts in pages (e.g. `supabase as unknown as { from: ... }`) when the table came after the types update. Pattern is consistent across the codebase.
3. **Haiku for chat, Sonnet for vision/extraction.** Cost-driven. Haiku is plenty smart for workspace-aware Q&A.
4. **Prompt caching for everything where context is stable.** Co-pilot's workspace context, intake's line-item catalog. Cuts cost ~10×.
5. **Excel pricing import was CUT.** Deferred in favor of AI intake (better UX for messy WhatsApp screenshots).
6. **`<button onClick>` not `<form onSubmit>`** — house rule from the original brief, observed everywhere.
7. **Lead picks** = Casa Del Mar / Mas de Sant Llei / ME Barcelona. Tagged via `venues.is_lead_pick`. Drives dashboard order.
8. **Scenario 3 is the lead option** — Sept 11 (Sat) Sangeet @ Casa Del Mar + Sept 12 (Sun) Wedding @ MSL whole venue. Sun MSL min is 220 → no shortfall at 220 guests (vs €4,800 shortfall on Saturday).
9. **Currency**: EUR base everywhere; USD toggle on calculator + spend tracker via `NEXT_PUBLIC_FX_EUR_USD` static rate.
10. **VAT split**: 21% venue / 10% F&B + accom — Spanish IVA rates baked into scenario calc engine.
11. **Spaces source-of-truth = `venue.spaces`** (admin-edited, DB). `event.spaces` only holds the per-space `selected` state. Adding/removing/repricing spaces on a venue propagates to every scenario without touching scenario data. Implemented via `getEffectiveSpaces()` merge in `scenario-studio.tsx`.
12. **Estimator is local-only.** Per-couple budget edits at `/estimator/[id]` NEVER push to the master pricing template or to /pricing scenario inputs. The Estimator is the "honest budget" view; /pricing is the "compare venue options" view. Same data world, different jobs.
13. **`org_role` is the planner-vs-couple axis** (`org_admin | member`), distinct from the legacy `role` (`admin | couple`). Org-scoped tables (library_*, playbook_*) gate on `auth_org_role() = 'org_admin'`. Workspace-scoped tables still gate on `auth_role()`. Both columns coexist; the data migration set them in sync.
14. **Library is org-scoped, workspace is per-couple.** A planner builds their library once (venues, vendors, playbook); each new client workspace receives a CLONE of selected library items via `/api/admin/push/*`. Edits to a workspace copy do not affect the library, and vice-versa. This is the reuse model that makes the SaaS work.

---

## Live data state (Supabase, end of session)

- **1 org** (Astia Events) + **1 workspace** (Nisha & Hursh — Barcelona 2027)
- **7 users**: 2 admins + 5 couple
- **6 venues**: Casa Del Mar, Xalet Del Nin, ME Sitges Terramar, Marina Port Vell (250 cap incl. yacht photos), Mas de Sant Llei, ME Barcelona. All with hero photos, lat/lng, hire fees, event roles, pros/cons fields ready.
- **51 venue photos + videos** in Supabase Storage `venue-photos` bucket
- **3 scenarios**: Option 1 Sitges / Option 2 Barcelona / Scenario 3 Hybrid (lead)
- **9 pricing categories + 28 line items** — Astha's quoted rates
- **48 venue date marks** seeded from Astha's deck
- **73 planning tasks** across 9 phases
- **0 vendors yet** (no test data — admin adds via /vendors)
- **0 guests yet** (admin imports via /guests/import)
- **0 timeline items** (run `pnpm db:seed-timeline` for template)
- **6 library_venues** (org-scoped, ported from demo venues via `db:seed-library`)
- **9 playbook_phases + 73 playbook_tasks** (Astia's master template, via `db:seed-playbook`)
- **1 workspace_branding row** with `accent_hex='#9d174d'` and `planner_display_name='Astia Events'` — drives the couple shell's nav theme

---

## Known issues / "would-fix-later"

| Item | Severity | Notes |
|---|---|---|
| Co-pilot replies don't render markdown (bullets/bold show as raw chars) | low | Add `react-markdown` to MessageBubble in `assistant-chat.tsx` |
| `.next` cache occasionally corrupts on local dev (vendor-chunks errors) | low | `rm -rf apps/web/.next` + restart preview |
| /vendors had a 500 (server-component onClick) — **fixed in commit `6556125`** | resolved | |
| MSL spaces not auto-loading on fresh scenarios — **fixed in commit `c1a28fb`** | resolved | |
| Admin-added spaces (e.g. MSL "Extra hour" €1k) didn't appear on existing scenarios — **fixed in commit `aa46531`** | resolved | Scenarios now read live from venue.spaces; selections preserved by label match. |
| Mobile pass is partial (filter bars reflow, but scenario builder + tables could use more) | medium | One sweep across components/* would do it |
| Magic-link emails rate-limited at ~3/hr on Supabase free tier | low | Use `gen_magic_link.ts` (admin API bypass) — already wired |
| `supabase` CLI removed from devDependencies | by design | DB managed via `_apply_one.ts` instead |

---

## Next-up backlog (ordered by my recommendation)

### Quick wins
1. **Markdown rendering in Co-pilot** (~10 min) — adds polish where you'll spend the most time
2. **Recent conversations sidebar** in /assistant (~15 min) — multi-thread support
3. **Loading skeletons** across pages (~45 min) — first-load polish
4. **Toast notifications** for save/error feedback (~30 min)
5. **Global search Cmd-K** to jump between venues/vendors/guests (~1.5 hr)

### Medium
6. **Auto-apply gate** for high-confidence pricing-intake proposals (~1 hr) — designed at `AUTO_APPLY_THRESHOLD = 0.92`, just needs server enforcement
7. **Calculator-line "source" popover** — click any pricing line, show the change_log entries with quote + actor (~2 hr) — biggest payoff of the intake feature, currently not surfaced
8. **Mobile responsive sweep** across scenario builder + dense tables (~1.5 hr)
9. **Dashboard widget for Co-pilot** — embed a quick-prompt input on `/` so people discover it (~30 min)

### Bigger
10. **Public wedding website** — public route at `/w/[slug]` with logistics + RSVP link, no login required (~4–6 hr). Generated from existing workspace data.
11. **Guest self-serve RSVP** — token-based public page, each guest gets a personal link (~3–4 hr). Saves Astha hours of manual entry.
12. **Gmail integration** (Phase 2) — Gmail OAuth, monitor inbound vendor emails, auto-status-flip vendors when quotes arrive (~2–3 days). Callout banners already in place hyping it.
13. **Resend integration** — actual email send-from-app instead of just drafts (~half day, needs Resend account + DNS)
14. **WhatsApp Cloud API** — Astha's primary channel. Phase 2/3 from earlier plan. Needs Meta Business verification + dedicated WA number.
15. **Mood board / inspiration** — Pinterest-style image collection per theme (~3 hr)

### Planner-OS follow-ups (post-Wave-2)
16. ✅ **Wire push-buttons into library pages** — done in commit `853dc6c`. `PushVenueButton` + `PushVendorButton` render on `/admin/library/venues/[id]` and `/admin/library/vendors/[id]` with workspace picker.
17. ✅ **Apply branding to couple shell** — done in commit `853dc6c`. `app/(app)/layout.tsx` fetches `workspace_branding`, passes accent_hex + logoUrl + planner_display_name down to nav. Active pill + heart-icon gradient now use accent_hex; planner display name in subtitle.
18. ✅ **Seed playbook from existing 73 planning_tasks** — done. `db:seed-playbook` script ran successfully → 9 phases + 73 tasks live in playbook for Astia's org.
19. ✅ **Seed library from existing 6 venues** — done. `db:seed-library` ran → 6 library_venues live (Casa Del Mar, Marina Port Vell, MSL, ME Barcelona, ME Sitges Terramar, Xalet Del Nin). Photos NOT byte-copied — paths reference the workspace's `venue-photos` bucket; planner can re-upload via `/admin/library/venues/[id]` if they want bytes in `library-media`.
20. **Functional "View as workspace" picker** — currently a stub link to `/?as=<id>`. Needs server-side cookie or impersonation pattern so an org_admin actually sees that workspace's data. ~2 hr.
21. **Drag-to-reorder library media** — current up/down arrows work but DnD would be nicer. Needs `@dnd-kit/core`. ~45 min.
22. **Push buttons inside `/admin/clients/[id]`** — currently you push FROM library detail; would also be useful to push FROM client drill-in (one client receives N venues). ~30 min.
23. **Phase 8 — Real SaaS (deferred)**: signup, Stripe, marketing site, Resend, WhatsApp.

### Won't-build (intentionally cut)
- Family voting (user said no)
- Photo comments (user said it works as-is)
- Vows + translator (out of scope)

---

## File map (what lives where)

```
wedding-os/
├── apps/web/
│   ├── app/
│   │   ├── (app)/                    # auth-gated route group
│   │   │   ├── layout.tsx            # SSR fetches role + workspace, renders Nav
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── assistant/page.tsx    # Co-pilot
│   │   │   ├── plan/page.tsx         # A-Z tracker
│   │   │   ├── venues/                # list + detail with 7 tabs
│   │   │   ├── map/page.tsx
│   │   │   ├── availability/page.tsx
│   │   │   ├── vendors/                # list + detail with 4 tabs
│   │   │   ├── guests/                 # list + import wizard
│   │   │   ├── pricing/page.tsx        # scenario studio
│   │   │   ├── payments/page.tsx
│   │   │   ├── spend/page.tsx
│   │   │   ├── compare/page.tsx
│   │   │   ├── timeline/                # editor + print
│   │   │   └── settings/pricing/        # template + intake
│   │   ├── api/
│   │   │   ├── ai/chat/                 # Co-pilot endpoint
│   │   │   ├── email/draft/             # Email draft endpoint
│   │   │   ├── guests/import/           # Excel ingest
│   │   │   └── pricing/intake/          # Pricing intake (upload + apply)
│   │   ├── login/page.tsx
│   │   └── layout.tsx                   # Fraunces + Manrope fonts
│   ├── components/
│   │   ├── ui/                          # shadcn primitives
│   │   ├── nav.tsx
│   │   ├── assistant/
│   │   ├── availability/
│   │   ├── compare/
│   │   ├── email/
│   │   ├── guests/
│   │   ├── map/
│   │   ├── payments/
│   │   ├── plan/
│   │   ├── pricing/
│   │   ├── spend/
│   │   ├── timeline/
│   │   ├── vendors/
│   │   └── venues/
│   └── lib/
│       ├── anthropic.ts                 # SDK client + cost calculators
│       ├── scenario-types.ts
│       ├── scenario-calc.ts             # pure pricing engine
│       ├── venue-pricing.ts             # hardcoded hire fees + spaces (legacy; migrating to DB)
│       ├── plan-types.ts
│       ├── plan-auto-derive.ts          # /plan live-status overlay
│       ├── guest-types.ts
│       ├── pricing-intake-types.ts
│       ├── email-templates.ts           # 7 prompt templates per kind
│       ├── vendor-types.ts
│       ├── vendor-categories.ts
│       ├── event-roles.ts
│       ├── venue-status.ts
│       ├── availability-types.ts
│       ├── supabase/{client,server,middleware}.ts
│       └── utils.ts                     # cn, formatMoney
├── packages/
│   ├── db/src/{index.ts,types.gen.ts}   # Database type
│   └── lib/src/{index.ts,pricing.ts}    # Cross-package shared
├── supabase/
│   ├── config.toml
│   ├── migrations/                      # 14 SQL files
│   └── seed/                            # 19 helper scripts
├── apps/web/app/(admin)/                # planner-OS shell (org_admin only)
│   ├── layout.tsx                        # auth gate + workspace picker stub
│   └── admin/{library,playbook,clients,settings}/...
├── apps/web/components/{admin-clients,admin-library,admin-playbook,admin-push}/
├── docs/
│   ├── sprint-3-design.md               # AI Pricing intake architecture spec
│   ├── lucia-strategic-memo.md          # 834-line product strategy from "Stellata CEO" persona
│   ├── wave-2-briefs.md                 # parallel-agent dispatch briefs
│   └── SESSION-SNAPSHOT.md              # this file
├── README.md
├── .env.example
├── package.json                          # root, with all `db:*` scripts
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Recent commits (most recent first)

```
853dc6c Planner-OS follow-ups: push buttons, seeds, couple-shell branding
88a5f1d SNAPSHOT: capture Estimator + Wave 1 + Wave 2 (planner-OS pivot)
db4863a Merge Wave 2 Agent E — New-client onboarding + push-to-workspace components
0819e8e Merge Wave 2 Agent A — Library Venues CRUD + media + AI brochure intake
3e7f9a6 Merge Wave 2 Agent C — Playbook editor + /plan custom-task additions
2c63352 Merge Wave 2 Agent D — Client roster + workspace branding
44ca97c Merge Wave 2 Agent D — Client roster + workspace branding (initial)
14b4829 Untrack tsconfig.tsbuildinfo (it's a build artifact, regenerated by tsc)
327dc19 Merge Wave 2 Agent B — Library Vendors
691b0fa Wave 1 follow-up: org_admin can read all workspaces in their org
6040372 Merge Wave 1 — planner-OS foundation slab
f13bc0e Ignore agent worktrees (.claude/worktrees/) and remove accidental commit
5a84959 Wave 2 briefs — five parallel-agent briefs for planner-OS build-out
7f50b58 Estimator: side-by-side compare view at /estimator/compare
74357b3 Estimator — couple-side honest budget seeded from Astia's two PDFs
e2e9c92 SNAPSHOT: add spaces live-merge fix + design decision #11
aa46531 Scenario builder: spaces always reflect live venue data
b05eae7 Add docs/SESSION-SNAPSHOT.md — full state of the build
6556125 Fix /vendors 500 — onClick handler on <a> in server component
402de13 AI Pricing intake — drop screenshot/PDF/text, Claude extracts, admin reviews, applies
a47f037 Co-pilot — workspace-aware AI chat with cost guardrails
c1a28fb Bulk vendors + Spend tracker + Payments calendar + Availability calendar + MSL spaces fix
1b36373 Map view + A-Z project tracker — every wedding task in one place
9a68a81 Sprint 4 polish — Decision log, Q&A, Pricing tab, Pros/Cons, activity feed
bb12cfb Sprint 5 — Guest list with AI Excel ingest + Run-of-show generator
47500ae AI-drafted vendor + guest emails (Claude) + Gmail-soon callout
b978a8f Editable venue hire fees — admins can change pricing in-app
40e3f7d Password auth + admin user + lead-pick venues for dashboard
5136964 Drop supabase CLI from devDependencies to unblock Railway build
87189db Disable react/no-unescaped-entities to unblock production build
2adc65f Bump Next.js to 14.2.35 to patch CVE-2025-55184 + CVE-2025-67779
f5e62fe Initial commit — wedding-os Sprint 1-3 + vendor module
```

---

## How to pick up cold (next session)

1. `cd /Users/hurshpatel/Documents/wedding-os`
2. `pnpm install` (if needed)
3. `cp .env.example apps/web/.env.local` (already done — has all keys including `ANTHROPIC_API_KEY`)
4. `pnpm dev` (or use the `wedding-os` preview server in `.claude/launch.json`)
5. Sign in at http://localhost:3200/login as `hurshpatel@greenskynj.com` / `Wedding2027!` — lands on `/admin` (org_admin)
6. Or sign in as `hurshpatel95@gmail.com` to see the couple shell + Estimator
7. Read `docs/wave-2-briefs.md` to understand how the planner-OS sub-features are organized
8. Read `docs/lucia-strategic-memo.md` if you want the strategic vision context
9. Pick from the **Next-up backlog** above — the planner-OS follow-ups (16–20) are the most useful "make Wave 2 actually feel finished" work

When applying a new migration: `SUPABASE_DB_URL='postgresql://postgres:gLtdK0Co8fMAp1pZ@db.dfyryyzizxcxtysduono.supabase.co:5432/postgres' ./node_modules/.bin/tsx supabase/seed/_apply_one.ts supabase/migrations/<file>.sql`

---

## Hard truths to remember

- **The ANTHROPIC_API_KEY is in this chat transcript.** Rotate it post-handoff via https://console.anthropic.com/settings/keys.
- **Supabase keys are also in this chat.** They're not as sensitive (service_role bypasses RLS but only against your own project) but consider rotating if paranoid.
- **DB password (`gLtdK0Co8fMAp1pZ`) is in this transcript.** Rotate via Project Settings → Database.
- **Railway redeploys on every push to `main`.** Build takes ~3-4 min. Magic-link emails on free Supabase tier cap at ~3/hr; use `gen_magic_link.ts` to bypass.
- **Couples can read `pricing_change_log`** by RLS design — the calculator-line popover (not yet built) is intentionally couple-facing. Don't store sensitive data there.
- **`vendors` / `ai_*` / `pricing_intake_*` tables use cast pattern** in pages because they came after the initial Database types pass. RLS still enforced server-side; just bypassing the client-side type generic. Pattern: `supabase as unknown as { from: (t: string) => { select: ... } }`.
- **Wedding date is intentionally null** in the workspace until you pick between Sept 4/5/6/12/18. Dashboard countdown shows "TBD" until set. Once set, plan-page due dates auto-anchor.
- **Astia's lead option** is Sept 11 Sangeet @ Casa Del Mar + Sept 12 Wedding @ MSL — already encoded in Scenario 3 + availability "tentative" marks.
- **Spaces architecture**: `venue.spaces` (DB) is the source of truth for which spaces exist + their prices. `event.spaces` (in `pricing_scenarios.inputs`) only stores per-space `selected` booleans. The render-merge in `scenario-studio.tsx`'s `getEffectiveSpaces()` is what makes admin venue edits flow through to all scenarios automatically. Don't reverse this — it's the cleanest way to keep one editable source of truth.
- **Estimator vs /pricing**: same data world (workspace), different jobs. Estimator is line-by-line "what we'll spend" with planner-PDF baselines + couple overrides. /pricing is event-bucketed "compare venue options". They do NOT share data — Estimator overrides stay in `budget_estimates.sections` JSONB. This was an explicit product call.
- **Library is org, workspace is couple**. Once Wave 2 is fully wired, every new couple gets a CLONE from the library — not a reference. Edit the library, future clients get the new version; existing clients keep what they were given. Don't accidentally make library a reference relationship — that's a cardinal mistake the SaaS pivot avoids.
- **`org_role` and `role` are different axes.** `role = 'admin' | 'couple'` is the legacy workspace-level distinction (it gates some existing UI like vendor compose-email). `org_role = 'org_admin' | 'member'` is the planner-vs-couple SaaS axis. Both columns exist on `users`; the data migration set them in sync. New code should prefer `org_role`. Don't try to rationalize them yet — wait until you have a second planner org.
- **Push components ARE wired now** (commit `853dc6c`). `/admin/library/venues/[id]` and `/admin/library/vendors/[id]` render the push picker. Pushing a venue clones the row + photo references into the target workspace; existing demo workspace already has the venues so test pushes won't duplicate-key — pick a fresh workspace via `/admin/clients/new`.
- **Couple shell branding IS wired now** (commit `853dc6c`). `accent_hex` drives the active-pill background + heart icon gradient. Planner_display_name shows in subtitle. Logo uploads on `/admin/clients/[id]/branding` flow through. Falls back gracefully if no branding row exists.
- **Library photos are path-references, not bytes**. `db:seed-library` set `library_venue_media.storage_path` to the same paths as the workspace's `venue-photos` rows, but the bytes live in `venue-photos` not `library-media`. The signed-URL helper in the media manager will return broken URLs. Real fix: re-upload via the venue detail page, or write a one-shot script to copy bytes between buckets. Documented above as known caveat.
