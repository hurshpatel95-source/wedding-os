# wedding-os — session snapshot (May 2026)

The state of the build at end-of-session. Use this when context compresses
or when picking the work back up cold.

> Last update: spaces-breakdown live-merge fix (commit `aa46531`). When
> Hursh added a 5th space ("Extra hour", €1,000) to MSL via the venue
> editor, scenarios still showed the old 4 because they held a snapshot.
> Now scenarios render from `venue.spaces` (live truth) and overlay
> `event.spaces` selections — added spaces appear unchecked, opt-in.

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

---

## Schema — 11 migrations

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

**Pattern**: every workspace-scoped table has RLS with `workspace_id = auth_workspace_id()`. Admin-only writes use `and auth_is_admin()`. Sensitive features (pricing intake, vendors) are admin-only on read+write.

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
│   ├── migrations/                      # 11 SQL files
│   └── seed/                            # 18 helper scripts
├── docs/
│   ├── sprint-3-design.md               # AI Pricing intake architecture spec
│   ├── lucia-strategic-memo.md          # 834-line product strategy from "Stellata CEO" persona
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
5. Sign in at http://localhost:3200/login as `hurshpatel@greenskynj.com` / `Wedding2027!`
6. Read `docs/lucia-strategic-memo.md` if you want the strategic vision context
7. Read `docs/sprint-3-design.md` if revisiting AI intake details
8. Pick from the **Next-up backlog** above

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
