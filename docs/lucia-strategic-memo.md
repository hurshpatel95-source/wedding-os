# Strategic Memo — wedding-os, from Couple Tool to Stellata's Operating Platform

**From:** Lucia Vasquez-Reinhardt, CEO, Stellata
**To:** Hursh, founder
**Date:** 2026-05-05
**Re:** What it takes to run 50 luxury weddings concurrently on this codebase
**Length:** Read it. I'm not editing it down.

---

## 0. Context — why I'm writing this

I've spent two days inside `wedding-os`. I was looking for a couple-side venue compare tool for a single Indian destination wedding (the brief at `/Users/hurshpatel/Downloads/claude-code-brief.md` is unambiguous — line 4: "Build a couple-side venue intelligence portal..."). What I found is a multi-tenant schema that was deliberately over-engineered for the MVP (`org_id` + `workspace_id` on every table — see `supabase/migrations/20260505000001_init.sql:23-29`). That decision is the most important one in the repo. It's also the one that makes this memo worth writing.

Stellata books 40-60 weddings/year. Average ticket is just under €900K. Our binding constraint is senior-planner bandwidth: each senior caps around 8 weddings/year because the work is artisanal — vendor selection, design decisions, couple hand-holding, day-of execution. To get from 50 weddings/year to 100 without doubling senior headcount, we don't need a prettier venue picker. We need the system that the planner *runs the wedding from*.

I've evaluated everything on the market. HoneyBook is built for the $30K backyard-wedding planner — its CRM is fine but its vendor management is a glorified contact list and its pricing engine is a joke. Aisle Planner has the best couple-facing portal in the industry but its planner-side ops are stuck in 2017 — no contract milestones, no real run-of-show. Planning Pod tries to do everything and ends up doing nothing well; we tried it for three months in 2024 and our coordinators stopped opening it. Studio Ninja is photographer-first, retro-fitted for planners, useless. Aisle Society is content + directory, not ops. Allseated and Prismm are the only serious 3D floor-plan tools but they don't pretend to be operating systems. **There is no luxury-tier planner OS on the market.** Honest. There is space for what wedding-os could be.

So this memo is not "fix the couple portal." It's: here's what wedding-os has to become for me to put 50 concurrent weddings on it, and here's the order I'd do it in.

I'll be direct. There's a lot the brief got right. There's some it got wrong. I'll mark both.

---

## 1. The Vendor entity — schema proposal

### 1.1 What's wrong today

The current schema treats vendor work as **price line items** on a venue (`pricing_line_items` at `supabase/migrations/20260505000001_init.sql:135-145`). The seed file even sets up "Decor & Florals," "Photo & Video," "Music & DJ," "Glam," etc. as pricing categories (`supabase/seed/seed.ts:240-250`). These are **not pricing categories**. They are **vendor relationships**. A pricing category has a number. A vendor has a name, an email, a contract, two deposits, three deliverables, a day-of arrival window, a load-in plan, a payment schedule, a W-9 (or local equivalent), an insurance certificate, a cultural specialty, a portfolio, and a planner-internal reliability score.

You cannot run 50 weddings on price line items. You can run one wedding on price line items, badly.

### 1.2 The split: org-level vs workspace-level

This is the most important schema decision in the memo, so I'll be explicit. We need **both**:

- **`org_vendors`** — Stellata's curated stable. Reused across many weddings. Includes our preferred florist in Lake Como, our pyrotechnician in Dubai, our two pandits in NJ, our four DJs across Europe. This is the asset that makes Stellata Stellata.
- **`workspace_vendors`** — the wedding-specific vendor instance. Carries the contract, deposits, deliverables, status, comms thread for *this* wedding. Optionally linked to an `org_vendor` row, but not required (sometimes the couple insists on their cousin's photographer — fine, one-off, no org row).

Two tables, joined. The reason it has to be two tables and not one is that org-level data is **shared truth** (the florist's portfolio link, our internal reliability score, blacklist flag, last-known rate card) and workspace-level data is **transactional** (deposit paid 2027-03-14, balance due 2027-08-15, 3 changes after final headcount). If you collapse them you either denormalize the shared truth (50 weddings = 50 stale copies of the florist's contact) or you lose the per-wedding state. Both wrong.

### 1.3 Proposed DDL

```sql
-- New enum
create type vendor_category as enum (
  'venue',                -- yes, venues become vendors. see §3
  'catering',
  'florist',
  'decor',
  'photographer',
  'videographer',
  'photo_booth',
  'dj',
  'live_band',
  'sound_av',
  'lighting',
  'mua_hair',
  'mehendi',
  'dhol',
  'baraat_horse',
  'pandit',
  'priest_officiant',
  'rabbi',
  'imam',
  'stationery',
  'signage',
  'rentals_furniture',
  'lounge_furniture',
  'transportation',
  'guest_shuttle',
  'bridal_car',
  'security',
  'permits_legal',
  'pyro_fireworks',
  'fire_ceremony',
  'translator_emcee',
  'cake_dessert',
  'bar_mixology',
  'late_night_food',
  'wellness_spa',
  'guest_concierge',
  'gifting_favors',
  'other'
);

create type vendor_status as enum (
  'sourcing',         -- planner is identifying options
  'rfp_sent',         -- ask is out
  'shortlisted',      -- 2-3 in play
  'awaiting_quote',
  'quoted',
  'negotiating',
  'contract_sent',
  'contract_signed',
  'deposit_paid',
  'in_progress',
  'final_payment_due',
  'paid_in_full',
  'delivered',        -- wedding day done
  'closed',
  'rejected',
  'blacklisted'       -- never use again, with reason
);

create type vendor_currency_basis as enum ('flat', 'per_guest', 'per_event', 'per_hour', 'per_day', 'percent_of_total');

-- ORG-LEVEL: Stellata's stable. One row per real-world vendor business.
create table org_vendors (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  category vendor_category not null,
  business_name text not null,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  whatsapp text,                          -- destination weddings live on WhatsApp
  website text,
  instagram text,                         -- non-negotiable in luxury
  portfolio_url text,
  service_regions text[] not null default '{}',  -- ['barcelona','lake-como','dubai']
  cultural_specialties text[] not null default '{}', -- ['indian-hindu','jewish','muslim','western']
  languages text[] not null default '{}',
  rate_card jsonb,                        -- structured but flexible: {basis, base, tiers, addons}
  rate_card_currency text,
  rate_card_updated_at date,
  insurance_on_file boolean not null default false,
  insurance_expires_on date,
  reliability_score numeric(3, 2),        -- 0.00–5.00, internal
  reliability_notes text,
  preferred boolean not null default false,
  blacklisted boolean not null default false,
  blacklisted_reason text,
  tags text[] not null default '{}',      -- ['vegan-friendly','jain-certified','english-speaking','quick-turnaround']
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index org_vendors_org_idx on org_vendors(org_id);
create index org_vendors_category_idx on org_vendors(org_id, category);
create index org_vendors_regions_idx on org_vendors using gin (service_regions);
create index org_vendors_specialties_idx on org_vendors using gin (cultural_specialties);

-- WORKSPACE-LEVEL: this wedding's instance of a vendor.
create table workspace_vendors (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  org_vendor_id uuid references org_vendors(id) on delete set null,  -- nullable: one-offs allowed
  category vendor_category not null,                                  -- denormalized for filter speed; trigger enforces match
  display_name text not null,                                         -- override allowed (e.g., "Sandra's florist (mom's pick)")
  contact_name text,
  contact_email text,
  contact_phone text,
  status vendor_status not null default 'sourcing',
  primary_event_id uuid,                                              -- see §5: events become first-class
  serves_event_ids uuid[] not null default '{}',                      -- one florist may serve all 5 events; one DJ may serve only Sangeet+Reception
  contract_total numeric(12, 2),
  contract_currency text,
  contract_basis vendor_currency_basis,
  contract_signed_at date,
  contract_url text,                                                  -- Supabase Storage signed URL
  scope_summary text,                                                 -- one paragraph of what they're delivering
  deliverables jsonb not null default '[]'::jsonb,                    -- [{label, due_date, status, notes}]
  cultural_requirements text,                                         -- "must be jain-pure kitchen", "no beef on premises", "kosher under OU"
  arrival_window tstzrange,                                           -- day-of load-in
  departure_window tstzrange,
  power_requirements text,                                            -- AV/lighting need real planning
  staff_count integer,
  meal_required boolean not null default false,                       -- vendor meals are 5-15% line item people forget
  notes text,
  is_couple_visible boolean not null default true,                    -- hide internal-only vendors (security, day-of coordinator)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ws_vendors_workspace_idx on workspace_vendors(workspace_id);
create index ws_vendors_status_idx on workspace_vendors(workspace_id, status);
create index ws_vendors_event_idx on workspace_vendors using gin (serves_event_ids);
create index ws_vendors_org_link_idx on workspace_vendors(org_vendor_id);

-- Payment milestones: separated from vendors. A vendor has many.
create type payment_status as enum ('scheduled', 'sent', 'cleared', 'overdue', 'cancelled', 'refunded');
create type payment_method as enum ('wire', 'ach', 'card', 'cash', 'check', 'crypto', 'wise', 'other');

create table vendor_payments (
  id uuid primary key default uuid_generate_v4(),
  workspace_vendor_id uuid not null references workspace_vendors(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,                    -- "Deposit 25%", "Second draw", "Final balance"
  amount numeric(12, 2) not null,
  currency text not null,
  due_date date not null,
  status payment_status not null default 'scheduled',
  method payment_method,
  paid_at timestamptz,
  reference text,                         -- wire confirmation, check number
  invoice_url text,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index vendor_payments_due_idx on vendor_payments(workspace_id, status, due_date);
create index vendor_payments_vendor_idx on vendor_payments(workspace_vendor_id);

-- RFP threads: one per vendor outreach, with multiple messages
create table vendor_rfps (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  category vendor_category not null,
  brief text not null,                    -- the ask, AI-drafted, planner-edited
  sent_to uuid[] not null default '{}',   -- org_vendor ids
  responses jsonb not null default '[]'::jsonb,  -- [{vendor_id, received_at, quote, attachments}]
  status text not null default 'open',
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Vendor reviews: post-wedding, written by the planner. Feeds reliability_score.
create table vendor_reviews (
  id uuid primary key default uuid_generate_v4(),
  org_vendor_id uuid not null references org_vendors(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete set null,
  org_id uuid not null references organizations(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  rating_communication integer check (rating_communication between 1 and 5),
  rating_quality integer check (rating_quality between 1 and 5),
  rating_value integer check (rating_value between 1 and 5),
  rating_day_of integer check (rating_day_of between 1 and 5),
  body text,
  would_rebook boolean,
  authored_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- Trigger to recompute org_vendors.reliability_score on review insert.
-- Trigger to enforce workspace_vendors.category matches org_vendors.category when linked.
-- Both omitted here for brevity.
```

### 1.4 RLS posture

Critical and the brief got this half-right. Workspace-scoped tables need workspace-level RLS; **org-scoped tables (`org_vendors`, `pricing_templates`, `vendor_reviews`) need org-level RLS, not workspace.** Today's schema has `pricing_templates` keyed by `org_id` (line 117), which is correct — so the precedent exists. Apply the same pattern to `org_vendors`. A senior planner working on Wedding A *should* see the org's full vendor stable. A couple should NOT. A new policy:

```sql
-- Anyone in the org with role='admin' or 'planner' (new role, see §8) reads org_vendors.
-- Couples don't read org_vendors directly — they read workspace_vendors with is_couple_visible = true.
```

This is also the moment to add a `planner` role. Today there's only `admin` and `couple` (`init.sql:8`). For Stellata, "admin" is the org owner (me, ops director) and "planner" is the senior planner / coordinator. Different scopes. Brief missed this.

---

## 2. Vendor & Misc tab — design

### 2.1 What the planner sees

Opening the tab on one wedding (let's say Nisha & Hursh, Barcelona):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Vendors & Misc                                       [+ Add vendor]  [RFP …] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Pipeline summary:  ● 3 sourcing   ◐ 4 quoted   ◑ 5 contracted   ● 2 paid    │
│                    ⚠ 2 overdue payments   ⚠ 1 deliverable due this week     │
├──────────────────────────────────────────────────────────────────────────────┤
│ ▾ Always-needed                                                              │
│                                                                              │
│   Florist               Sourcing       3 RFPs out                ▸          │
│   Photographer          Quoted         €8,400 / €12,000 / €18,500 ▸          │
│   Videographer          Contract sent  Studio Bonheur            ▸          │
│   DJ                    Signed         DJ Vikram (org pref ★)    ▸          │
│   MUA & Hair            Sourcing       0 RFPs out  ⚠ 14 weeks    ▸          │
│   Stationery            Signed         Papier Atelier            ▸          │
│                                                                              │
│ ▾ Indian-specific                                                            │
│                                                                              │
│   Pandit                Signed         Pandit Sharma (NJ)        ▸          │
│   Mehendi               Quoted         Henna by Sana             ▸          │
│   Dhol players          Sourcing       0 RFPs out                ▸          │
│   Baraat horse          Sourcing       Local check needed        ▸          │
│   Fire ceremony permit  Sourcing       Council approval req'd    ▸          │
│                                                                              │
│ ▾ Venue-specific                                                             │
│                                                                              │
│   Sound system          (Mas de Sant Llei doesn't include)       ▸          │
│   Lounge furniture      Quoted         €2,500                    ▸          │
│   Generator             (Yacht only)                              ▸          │
│                                                                              │
│ ▾ Closed / Not pursued                                          [collapsed] │
└──────────────────────────────────────────────────────────────────────────────┘
```

Click into one vendor and you get a single page with five sub-sections, each collapsible:

1. **Identity & contract** — business name, contact, signed date, contract PDF, scope summary.
2. **Money** — payment schedule (table of `vendor_payments`), running total, overdue chip, "Add milestone" button.
3. **Deliverables** — checklist with due dates: "Engagement shoot delivery 2027-06-01," "Final shot list approved 2027-08-01," "Sample album mockup 2027-10-30."
4. **Day-of plan** — arrival window, load-in instructions, power, meal, contact onsite. Feeds the run-sheet (see §4.6).
5. **Comms log** — every email and WhatsApp thread. (Phase 2; Gmail integration. Not Sprint 4.)

The **primary action button** at the top of each vendor page is context-aware: "Send RFP" → "Request quote" → "Send contract" → "Mark deposit paid" → "Confirm day-of plan." This is the single most important UX decision because it's what stops planners from missing the next step at 11pm.

### 2.2 What the couple sees

A read-only, simplified view. Hide internal-only vendors (`is_couple_visible = false` — security, day-of coordinator, runner). For the visible ones, show: name, category, status (mapped to friendly: "We're getting quotes" / "Booked!" / "Final touches"), and the deliverables they care about ("engagement shoot date," "shot list review"). **Hide internal reliability scores. Hide rate cards. Hide reviews.** The couple sees the dance, not the choreography.

### 2.3 What the vendor-ops manager sees

Same as the planner, plus a cross-wedding view at the org level: "All florist RFPs open across all weddings," "All payments due in next 14 days across the org." That's the dashboard that keeps me awake — not "is Wedding A's florist booked," but "are 12 weddings' florists booked by week 12 of the engagement." See §4.7.

### 2.4 Why this matters

Right now if I open a venue in this app I see a Pricing tab that tells me decor will cost €18,000. That's a number. It is not a vendor. It is not a contract. It is not a deposit due in March. It is not a load-in window at 6am. **Pricing tabs make for great couple-side compare screens. They do not make for planner ops.** Vendor & Misc is where the actual wedding lives.

---

## 3. Category taxonomy — full list, marked

I'm putting venue itself in the table because at scale a venue *is* a vendor (contract, deposit, day-of contact, deliverable). Treating it specially in the schema (separate `venues` table) is fine for now, but conceptually it shares 90% of the workflow with every other vendor.

| Category | When | Notes |
|---|---|---|
| Venue (ceremony) | Always | Existing `venues` table. Keep it, but it should also have a row in `workspace_vendors` for payment + run-of-show. |
| Venue (reception) | Always | Often same site, sometimes not. |
| Catering (in-house) | If venue has it | Stellata's reality: 70% of luxury venues are in-house catering. Brief assumes this. |
| Catering (external) | If venue does NOT | The hard cases — Mas de Sant Llei has €180/pp menu min, but a yacht might bring its own caterer. |
| Bar / Mixology | Always | Often bundled but sometimes a separate prestige hire. |
| Cake & Dessert | Always | Western: cake. Indian: mithai bar. Jewish: viennese table. Track separately from catering. |
| Late-night food | Often | Pizza truck, paella, chaat — these are now expected at $1M+ weddings. |
| Florist | Always | The single biggest variable line. 8-15% of total budget. |
| Decor / Production | Always | Often a different shop than florals. Drape, ceiling install, mandap build, chuppah build, huppah cover. |
| Lighting design | Always at luxury | Separate from sound. Programmable washes, gobos, intelligent lighting. |
| Sound / AV | Always | If venue doesn't include. |
| Photographer | Always | |
| Videographer | Always | Almost always different studio than photo. |
| Photo Booth / 360 booth | Often | Western/fusion ubiquitous. Indian also. |
| DJ | Almost always | |
| Live band | Often | Cocktail trio, dance band, jazz combo. |
| Cultural music | Culture-specific | Sitar/tabla (Indian), Klezmer (Jewish), Andalusian flamenco (Spain), Sufi qawwali (Muslim/Indian). |
| Dhol players | Indian | Baraat. |
| Baraat horse / Vintage car / Elephant | Indian / culture-specific | Elephant only with specific cultural framing and welfare clearance — Stellata policy. |
| MUA — bride | Always | |
| MUA — family / bridal party | Almost always | |
| Hair styling | Always | Often bundled with MUA. |
| Mehendi (henna) artist | Indian | Mehndi event. |
| Officiant — priest / pastor | Western/Christian | |
| Officiant — pandit | Indian Hindu | Often flown in. |
| Officiant — rabbi | Jewish | |
| Officiant — imam | Muslim | |
| Officiant — civil | Always (legal) | Many destinations require a local civil officiant for the legal portion separate from the religious one. Spain/Italy notably. |
| Translator / Emcee | Often (destination) | |
| Stationery | Always | Save-the-dates, invitations, RSVPs, day-of (menus, programs, place cards). 6-12 month lead. |
| Signage | Always | Welcome signs, seating charts, way-finding, hashtag walls. |
| Rentals / Furniture (formal) | Almost always | Tables, chairs, china, glassware, linens. Often through caterer; sometimes separate. |
| Lounge furniture | Often | Cocktail areas, after-party. Indian: separate sangeet seating. |
| Mandap / Chuppah / Huppah build | Culture-specific | |
| Transportation — guest shuttle | Almost always (destination) | |
| Transportation — bridal | Always | |
| Transportation — VIP / family | Often | |
| Security | Often (luxury, celebrity, royal) | |
| Permits — fire ceremony | Indian | Hindu rituals require open flame; many venues need explicit permit. |
| Permits — fireworks / sparklers | Often | Spain regulates heavily. Italy too. |
| Permits — drone | Often (destination) | |
| Pyrotechnics / Fireworks / Cold sparks | Often | |
| Wellness — spa / yoga / chef wellness | Often (multi-day) | Welcome retreats. |
| Guest concierge | Always (destination) | The single biggest "we forgot this" — a dedicated guest experience team. |
| Gifting — welcome bags | Always (destination) | Hotel drop, custom packaging. |
| Favors | Often | |
| Childcare / Kids' room | Often | |
| Pet handler | Rare (always when needed) | The dog wears the suit. The dog needs a handler. Don't forget. |
| Day-of coordinator | Always | If not provided by Stellata in-house. |
| Translator | Often (destination, family travels) | |
| Insurance — event | Always | This is non-negotiable and the brief omits it entirely. Wedding insurance, liability, weather contingency. |
| Weather contingency | Always (outdoor) | Tent vendor on standby. |

**Counts that matter:** A typical Stellata Indian wedding contracts **22-28 distinct vendors**. A Western luxury wedding: 16-20. A multi-day destination South Asian wedding with 5 events: **30-35**. The brief's pricing model has 9 categories and treats vendors as price line items. That's not the right unit of work.

---

## 4. Workflow multipliers — what gets a senior from 8 → 12-15 weddings/year

I'm ranking these by impact. Not by how easy they are. **You don't need all of them in Sprint 4.** You need 1, 4, and 6 in Sprint 4. The rest can wait.

### 4.1 AI-assisted RFPs

**Why it matters.** A senior planner sends 22-28 RFPs per wedding. If each RFP takes 25 minutes (read brief, customize ask, attach docs, send to 3 vendors, log thread), that's ~10 hours per wedding just on RFP authoring. Across 8 weddings/year, that's a working week and a half. AI-drafted RFPs that the planner edits-and-sends turn that into 8 minutes each. That's 6 weddings of bandwidth recovered per planner per year. **By itself, this gets a senior from 8 → 9.5.**

**Screen.** Click "Send RFP" on a vendor row. Drawer opens with: pre-filled brief (couple, dates, headcount, venue, cultural notes pulled from the workspace), category-aware ask ("for a florist: arch design ref, 8 centerpieces, bridal bouquet x 5, ceremony installation"), three suggested org_vendors with reliability scores, and three editable fields. Click "Send to all 3." Email goes via Stellata's domain. Replies land in `vendor_rfps.responses` and ping the planner.

### 4.2 Vendor scorecards & cross-wedding reuse

**Why it matters.** Today my florist database is in three planners' heads, two Notion pages, and one Excel sheet from 2023. I can't query "show me every florist who's ever worked a Lake Como wedding for us with a Jain dietary client and a >4.5 average rating." If I could, I'd save 3 hours of vendor-sourcing per wedding. Across 50 weddings/year that's 150 hours = 4 weddings of bandwidth. **8 → 8.5 by itself, but in combo with RFP it compounds.**

**Screen.** New top-level page: `Org → Vendor Stable`. Filterable grid by category, region, cultural specialty, last-used-date, reliability score. Click a vendor, see every wedding they've worked for us, every review, last rate card, blacklist flag if any. Buttons: "Add to wedding," "Send RFP," "Update rate card."

### 4.3 Contract tracking

**Why it matters.** Three weddings ago we lost €4K of vendor deposits because a contract auto-renewed an exclusivity clause we didn't catch. Last year a videographer's contract specified "raw footage delivered within 90 days" and we didn't catch them at day 91. Contract milestones are a litigation surface and currently they live in PDFs on Google Drive. Surfacing the next 14 days of contract triggers across 50 weddings — that's table stakes.

**Screen.** Per-vendor: contract upload, key dates extracted (planner can edit), three milestone types: payment, deliverable, expiration. Org-level dashboard: "Next 30 days, all weddings, all vendors" with a heat-mapped timeline.

### 4.4 Payment milestone alerts

**Why it matters.** Vendor deposits at the luxury tier follow a typical pattern: 25-30% on signing, 25% at midpoint (often 6 months out), 40-50% balance at 14-30 days before the event. With 50 concurrent weddings each carrying ~25 vendors with ~3 milestones each, that's ~3,750 payment events on the Stellata calendar. We currently track maybe 60% of them on time. The 40% we miss = late-payment fees, vendor relationship damage, and last-minute scrambles.

**Screen.** Org dashboard, "Payments" section: overdue (red), due-this-week (amber), upcoming-30d (green). Per-wedding view too. Bulk action: "Mark these 8 sent." Optional: integrate with Wise/Mercury for actual wire initiation later (Phase 2+, careful — I'd not auto-pay; just queue with planner approval, see §6).

### 4.5 Couple self-serve portal

**Why it matters.** 40% of senior-planner time on a wedding is reactive: "what's the menu look like again?", "can I see the photos from the venue visit?", "what color did we land on for the linens?". If the couple has a beautiful, current self-serve portal, that 40% drops to 15%. That alone is the difference between 8 weddings/year and 12.

**Screen.** What the couple sees today (the venue compare + scenarios) is a great start. Add: vendor list (their visible subset), key dates timeline, payment schedule (their portion), guest list status, current run-of-show preview, photo galleries from each visit, mood boards. Plus a "Decisions needed from us this week" widget — three pending decisions max, with the planner's recommendation.

This is where Aisle Planner is actually quite good. Aim for parity then surpass on design. Stellata's brand is design.

### 4.6 Day-of run-sheet generator

**Why it matters.** Currently each senior writes the day-of run-sheet in Google Docs from a template. It's 14-22 pages. It takes 8 hours. It then gets revised 6-8 times in the final two weeks. If we generate it from structured data (events, vendors, arrival windows, deliverables, guest count, transport schedule), the first draft writes itself in 90 seconds and revisions are diff-based. **2-3 weddings of bandwidth recovered per senior per year.**

**Screen.** Per-wedding: "Run-of-show" tab. Pulls events (§5), each event has a timeline. Each timeline slot has: time, activity, location, lead vendor, lead planner, contingency. Auto-generated from `workspace_vendors.arrival_window` + event start times + scope. Export to PDF for vendor briefing pack. Export to mobile-friendly view for day-of staff.

### 4.7 Org-level dashboard

**Why it matters.** Today there is no view across weddings. I cannot answer "which 5 weddings are at risk this quarter" without DM'ing 6 planners. With this view, I can.

**Screen.** Top of `Org` nav. Tiles:
- Weddings by phase (Discovery / Design / Booking / Pre-prod / Wedding week / Closeout)
- Risk: weddings with >2 overdue items
- Capacity: planner load (each senior's count)
- Revenue forecast: contracted vs pipeline by quarter
- Vendor stable health: insurance expirations, reliability decay

This is the pane I'd open with my morning coffee.

---

## 5. Multi-event reality — events become first-class

### 5.1 The problem

Today, "events" are a string array inside a JSONB column on `pricing_scenarios.inputs.events_selected[]` (`init.sql:165` and brief line 75). That's wrong for everything south of the pricing calculator. South Asian weddings are not "a wedding with 5 sub-toggles." They are **5 distinct events**, each with its own venue (sometimes), guest list (subset), vendors (overlapping but not identical), timeline, decor, dietary plan, and headcount. Multi-day Western weddings have it too: welcome dinner, rehearsal, ceremony, reception, brunch.

Stellata's reality:
- Mehndi: 80-120 women, daytime, henna artists + DJ + lunch + decor; often at a smaller venue.
- Sangeet: 200-400 mixed, evening, DJ + live performance + sound stage + dinner; often at the resort ballroom.
- Haldi: 30-80 close family, morning, no music, light catering.
- Ceremony: 250-400, daytime, pandit + mandap + fire ceremony + photo + video, restricted catering window.
- Reception: 250-400, evening, the big one, full vendor stack.

That's 5 floor plans, 5 vendor manifests, 5 timelines, 5 menus, 5 guest lists. The current schema can't represent any of this except as a comma-separated string.

### 5.2 Proposed: events as first-class

```sql
create type event_kind as enum (
  'mehndi', 'sangeet', 'haldi', 'engagement_party',
  'welcome_dinner', 'rehearsal_dinner',
  'ceremony', 'cocktail_hour', 'reception',
  'after_party', 'next_day_brunch',
  'pre_wedding_shoot',
  'other'
);

create table events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  kind event_kind not null,
  name text not null,                                -- "Sangeet — Bollywood Night"
  start_at timestamptz,
  end_at timestamptz,
  venue_id uuid references venues(id) on delete set null,  -- one venue per event; nullable for tbd
  expected_guest_count integer,
  confirmed_guest_count integer,
  dietary_breakdown jsonb,                           -- {vegetarian: 0.6, jain: 0.2, halal: 0.1, ...}
  dress_code text,
  formality text,                                    -- 'casual', 'cocktail', 'black_tie'
  cultural_notes text,
  is_couple_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_workspace_idx on events(workspace_id, sort_order);
```

### 5.3 Downstream changes (this is where it gets real)

Once `events` is a table, four things change:

1. **Venue ↔ event becomes many-to-many.** Today `venues` is workspace-scoped. Now we need: which venues are booked for which events? Add `event_id` FK on `venues` is wrong (one venue serves many events; one event has one venue most of the time, sometimes split). Use a join table: `event_venue_bookings(event_id, venue_id, hire_fee, deposit_paid_at, contract_signed_at)`. Don't kill the existing venue browse experience; just add the booking layer.

2. **Vendors map to events.** `workspace_vendors.serves_event_ids[]` (in my §1 DDL). The same DJ may do Sangeet + Reception but not Ceremony. The same florist does all 5. The same caterer might do 4 but a separate Jain caterer does Haldi. A photographer may have a 3-event scope.

3. **Guest list becomes per-event.** Brief omits guest list entirely. We need it. Schema sketch:

```sql
create table guests (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  side text,                                         -- 'bride', 'groom', 'mutual'
  primary_email text,
  household_id uuid,                                 -- group invite address
  dietary text[],
  notes text,
  created_at timestamptz not null default now()
);

create table guest_event_invitations (
  guest_id uuid not null references guests(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  rsvp_status text,                                  -- 'pending','yes','no','maybe'
  meal_choice text,
  table_assignment text,
  primary key (guest_id, event_id)
);
```

This is the foundation for seating, dietary counts that drive catering invoices, and headcount-driven re-pricing.

4. **Pricing recalculates per-event.** Today's pricing engine computes one total per scenario × venue. New: total = sum of (per-event totals). Each per-event total is itself a sum of vendor-line costs scoped to that event. The existing `pricing_line_items` mechanism stays but it's downgraded to a *fallback* calculator (the AI-drafted "what-if" before vendors are contracted). Once vendors are contracted, **the contract is the source of truth, not the calculator.** This is a hard pivot. The brief had pricing engine as the deliverable. In a planner OS, the pricing engine is a forecasting tool, not the spine.

### 5.4 Western multi-event

Same pattern, fewer events: welcome dinner / rehearsal / ceremony / cocktail / reception / brunch. The event_kind enum already covers it. Don't make this Indian-specific. Just generic events.

---

## 6. What I'd cut from the brief

I'm not here to be polite. Here's what isn't earning its keep:

- **Per-venue Excel override sheet (brief line 92).** Excel is fine for *initial* pricing template upload. Once vendors are contracted, the override sheet is a parallel source of truth that drifts. **Cut it.** Excel imports yes, override-via-Excel no. Edit overrides in the app, period.

- **Sensitivity slider at -20%/+20% guest count (brief line 80).** Cute on paper. In practice, couples don't move on a 20% guest count swing — they move on specific +/- 30 to +/- 50 hard numbers ("if my dad's whole side comes that's +47"). And venues don't price linearly. **Cut.** Replace with a "Scenarios" tab where the planner saves 3-5 named scenarios at hand-picked guest counts.

- **"Compare up to 3 venues" (brief screen 6).** Real luxury venue selection isn't a 3-up grid; it's a curated narrative the planner walks the couple through. Build a compare *export* (PDF the planner can present), not a UI screen the couple bangs around in. **Demote** to PDF generator.

- **Decision log per venue (brief sprint 4 #12).** This is just `venue_notes` with `pinned=true`. **Cut as a separate feature.** Repurpose existing `venue_notes`.

- **The whole "do not build planner-side console" constraint (brief line 121).** This is the single most damaging line in the brief. The brief explicitly forbids the lead pipeline, vendor RFPs, contracts, and AI co-pilot. **Every one of those is required to scale.** I understand why it was written — scope discipline for one wedding's MVP. But if you're going to take wedding-os anywhere, you have to invert that constraint *now*, before tech debt accretes.

- **Magic-link only auth (brief line 122).** Fine for the couple. **Not** fine for senior planners and ops staff who log in 30x/day. Add SSO and remember-me sessions for the planner role. Magic link is a UX tax once you're past the engagement phase.

- **"Yacht charter" as a default seed venue.** It's a Hursh+Nisha thing. Not a default. Move it to the seed-data file specific to that workspace, not the boilerplate.

---

## 7. What I'd add — top 5 missing features, ranked

1. **Events table + per-event scoping (§5).** This is the keystone. Without it, none of the multi-event handling works and the pricing calculator stays toy-grade. Build it Sprint 4.

2. **`org_vendors` + `workspace_vendors` + Vendor & Misc tab (§1, §2).** The work that turns this into a planner OS. Sprint 4 must touch this.

3. **Org-level vendor stable browse + "Add to this wedding" flow (§4.2).** The cross-wedding reuse pattern. Sprint 5.

4. **Run-of-show generator (§4.6).** The single feature most likely to make planners *advocate* for the tool internally. They will use it daily in the final 6 weeks of every wedding. Sprint 5-6.

5. **Guest list + per-event invitations (§5.3 #3).** The brief omits this. Aisle Planner has it. We need it for catering counts, seating, and the couple portal feels gutted without it. Sprint 6.

(Honorable mentions that didn't make the top 5: design board / mood board canvas — table stakes long-term, but acquirable via Pinterest+Notion handshake for now. Floor-plan tool — partner with Allseated/Prismm via embed, do not build. Email/Whatsapp inbox unified comms — Phase 2, hugely valuable, hugely complex.)

---

## 8. Open questions for the founder

1. **Are we building this for Stellata, for Astia, or for the market?** The architecture says multi-tenant SaaS. The brief says one couple. Which is real? If multi-tenant SaaS, then `org_vendors` priority goes up and pricing template authoring becomes a per-org thing, not a global. If one couple with multi-tenant as a hedge, then we slow-roll the org-level features and double down on Astia's planner workflow first. **I need this answered before scoping Sprint 4.**

2. **What's the role taxonomy?** Today's enum is `admin | couple` (`init.sql:8`). At Stellata I have **at least**: org_owner, ops_director, senior_planner, junior_planner, design_lead, vendor_ops, finance, couple, vendor_external (the vendor logs in to confirm a deliverable). RLS gets considerably gnarlier. Do we want vendor-side login at all, or do all vendor comms stay outside the system?

3. **Where does money actually move?** Tracking payment milestones is one thing. Initiating wires/ACH is another. I'd vote *do not* hold custody of payments — be a tracker, not a payor. Integrate read-only with bank/Wise/Mercury. But this is a founder-level call and it has compliance ripples (KYC/AML, money transmitter licenses by jurisdiction). What's your appetite?

4. **Cultural depth — how far do we go?** The vendor category list above leans Indian/Western/Jewish/Muslim. Stellata also does Hispanic/Latin Catholic, Persian, Korean, Chinese, and queer non-traditional. Each has its own micro-vendors (e.g. Persian *sofreh aghd* setup, Chinese tea ceremony attendant). Do we ship a base + culture packs, or do we go all-in on a master taxonomy? My vote: base + culture packs, and let planners fork the taxonomy at the org level.

5. **Multi-tenancy bite-radius.** The schema is multi-tenant but the pricing template is `org_id`-scoped (good). The issue is that a planner agency like Stellata that books across continents may want **regional sub-templates** under one org. Today there's no `region_id` or sub-org concept. Are we OK introducing a `org_branches` table now (Barcelona, Lake Como, Dubai, Mexico City for me), or do we punt and let multi-region orgs spin up multiple `organizations` rows? The latter is messier; the former is more work upfront. **My vote: do it now.** It's two columns and a join table; doing it later is an excruciating migration.

---

## 9. Closing — the honest read

The brief built a beautiful, opinionated couple-side venue tool. The schema (especially `org_id` + `workspace_id` everywhere — `init.sql:23-29, 51-52, 116-117, 162-163`) was the right call and is the only reason this memo is short instead of 4,000 lines. Most "we built it for one customer" tools have to be torn out by the roots. This one doesn't. Lift the constraint that bans planner-side features (brief line 121), add Events + Vendors in Sprint 4, and you have something I would put 50 weddings on by next September.

Build this and I'll be your first paying enterprise customer at €120K/year for 25 seats.

Don't build this and HoneyBook will eat the upper-mid market in 18 months and we'll all keep running our weddings on Notion + WhatsApp + a prayer.

Your call.

— L.

---

## Appendix A — Sprint plan I would actually run

The brief's Sprint 4 is "polish + compare view + decision log + mobile + deploy" (`/Users/hurshpatel/Downloads/claude-code-brief.md:112-116`). I'd replace it. Here's how I'd sequence the next four sprints with the framing of "what makes wedding-os Stellata-grade by November 2026."

**Sprint 4 — Events + Vendor Foundation (3 weeks)**

- New tables: `events`, `event_venue_bookings`, `org_vendors`, `workspace_vendors`, `vendor_payments`.
- Migrate `pricing_scenarios.inputs.events_selected[]` consumers to read from `events` table. Keep the JSONB column for one release as a fallback; add a backfill script.
- Add `planner` role to `user_role` enum. Update RLS policies for `org_vendors` (org-level read for admin/planner, no read for couple).
- Build the Vendor & Misc tab on the venue detail page (the screen sketch in §2.1). Don't worry about the org-stable browse yet — just per-wedding vendor CRUD with payment milestones.
- Skip the "Compare 3 venues" UI from the brief. Punt to PDF export later.

**Sprint 5 — Org Vendor Stable + RFPs (3 weeks)**

- Top-level `Org → Vendor Stable` page with filter grid (§4.2 screen).
- "Add to this wedding" flow: pick org_vendor → spawn workspace_vendor with prefilled fields.
- AI-assisted RFP drawer (§4.1). Start with template-based drafting; add LLM-powered customization in Sprint 6.
- Vendor reviews submission flow (post-wedding closeout). Recompute reliability_score on insert.

**Sprint 6 — Guest List + Run-of-Show (4 weeks)**

- `guests` + `guest_event_invitations` tables (§5.3).
- Guest list import (CSV from couples' draft Google Sheet — they all start there).
- Per-event RSVP tracking. Couple-portal RSVP page lives separate from this — that's a public-facing micro-site, Sprint 8.
- Run-of-show generator (§4.6). PDF export. Mobile day-of view.

**Sprint 7 — Org Dashboard + Risk Surfacing (2 weeks)**

- Org-level "Today" pane (§4.7).
- Cross-wedding payment dashboard.
- Cross-wedding deliverables-due dashboard.
- Insurance expiration warnings on org_vendors.
- Planner load capacity tracker.

**Sprint 8 — Couple Self-Serve Portal v2 (3 weeks)**

- Public RSVP micro-site (one per workspace, custom subdomain).
- Couple decisions queue widget.
- Photo galleries from each visit, mood-board canvas integration (Pinterest embed acceptable).
- Mobile-first pass on the couple side. (Mobile pass on planner side is *not* urgent — planners work at desks. Couples work on phones in bed.)

**Sprint 9+ — Comms inbox, contract OCR, integrations**

Gmail / WhatsApp Business API into a unified `vendor_messages` thread per workspace_vendor. Contract OCR to auto-extract milestone dates. Stripe / Wise read-only for payment confirmation. Allseated/Prismm embed for floor plans.

This sequence prioritizes **planner throughput** over **couple delight** for the first four sprints, then doubles back. That's deliberate. Right now the couple portal is already 70% there. The planner OS is 0% there. Closing the planner gap first is what justifies the price tag.

---

## Appendix B — RFP economics, with numbers

I keep saying "AI-assisted RFPs save 6 weddings of bandwidth per planner per year." Let me show the math because I want this to be defensible when you bring it to investors.

**Today (manual RFP):**
- 25 RFPs per wedding × 25 minutes each = 625 minutes = ~10.4 hours of pure RFP authoring.
- Per senior planner at 8 weddings/year: 83 hours/year.
- Stellata fully-loaded senior planner cost: ~€140K/year. At 1,800 productive hours/year = €78/hour. RFP authoring = ~€6,500/year/planner of the planner's *own time*, not even counting opportunity cost.

**With AI-assisted RFP (target):**
- 25 RFPs × 8 minutes each (read AI draft, tweak ask, hit send) = 200 minutes = 3.3 hours.
- Per planner at 8 weddings/year: 27 hours/year. Saves 56 hours.
- Apply that 56 hours to the marginal wedding ramp (each wedding consumes ~225 senior-planner hours end-to-end). 56 hours = 0.25 of a wedding.

That's the *RFP-only* lift. Multipliers stack:
- RFP automation: +0.25 weddings.
- Run-of-show generator: +0.4 weddings (saves 5-6 hours of doc authoring per wedding × 8 = 40-48 hours).
- Couple self-serve portal cuts reactive comms 40% → 15%: a senior spends ~2 hours/week on couple comms across 8 active weddings, reducing that by 25 percentage points = ~26 hours/year reclaimed = +0.12 weddings.
- Vendor stable reuse + scorecards cut sourcing time 3 hours/wedding × 8 = 24 hours = +0.1 weddings.
- Cross-wedding payment dashboard: harder to quantify in hours, but reduces the 40% "missed milestone" rate down to ~10%, eliminating ~40 fire-drill hours/year per planner = +0.18 weddings.

Stack: 0.25 + 0.4 + 0.12 + 0.1 + 0.18 = **+1.05 weddings/year per senior planner**.

That's modest. The compounding effect is in *retention* — burned-out planners quit, and replacing one senior planner costs Stellata 8-12 months of ramp + ~€60K of disruption. The real ROI of wedding-os isn't just the +1 wedding/year per planner; it's keeping the planners we have.

I'd put the realistic top-of-funnel at 8 → **10-11** weddings/year per senior. The "12-15" upper bound in the section header assumes we get junior planners taking on 50% of the run-sheet + vendor-comms work, which requires the OS to be smooth enough that a junior can run it without the senior in every loop. Achievable, but two years of product development away.

---

## Appendix C — Sample run-of-show output

Here's what the run-of-show generator should produce for the Sangeet event of the Nisha & Hursh Barcelona wedding, given current data + my proposed schema:

```
SANGEET — Sat 5 Sep 2027, Mas de Sant Llei
Confirmed: 240 guests | Dietary: 65% veg, 18% jain, 8% halal, 9% no-restriction
Lead planner: Astha Doshi  |  Day-of coordinator: TBD

13:00  Vendor load-in begins (Forest space)
       Lead: Maria (Stellata vendor ops, on-site)
       Florist: Floristería del Mar — 2 vans, gate code 2747
       Decor: Studio Barcelona Events — 1 truck, 6 staff
       Sound: Audio Mediterráneo — 4 line arrays + 1 sub
       Lighting: Lumière BCN — 12 movers + 6 wash
       Power: 2 distros from venue panel B (confirmed w/ venue 2027-08-01)

15:00  MUA + Hair arrives, bridal suite
       Lead: Roshni (MUA — premium, contracted €4,200)
       Hair: Coco (sub-contracted by Roshni)

17:00  DJ Vikram soundcheck (45 min)
       Sangeet performances rehearsal — 3 family acts, 25 min total

18:30  Photographer + Videographer arrive
       Photo: Studio Bonheur (lead Antoine + 2nd shooter Lucia)
       Video: Reel Yatra (lead Vikram K + 2 ops)
       First look: 18:45-19:15 in Orange Courtyard

19:30  Guest arrival, cocktail courtyard
       Welcome drinks: 3 stations
       Light bites (jain-pure station identified with placard)
       Mehendi touch-up booth open (Sana, 1 artist)

20:30  Guests move to Forest space for performances
21:00  Performances + emcee block (75 min)
22:15  Dinner service — buffet x 4 stations
23:00  Open dance floor (DJ Vikram)
01:30  Last call, late-night chaat station opens
02:30  Hard close (venue contract — Mas de Sant Llei requires)
03:00  Vendor strike begins
05:00  Site clear (venue contract)

Vendor meal counts (must be in catering count):
  Photo: 4   Video: 3   DJ: 2   MUA: 2   Sound: 4   Lighting: 4
  Decor strike crew: 6   Florist (early arrival only): 2   Total: 27

Cultural notes:
  - Jain catering must be a sealed, separate prep line (Astha confirmed
    with caterer 2027-07-12).
  - Alcohol: full bar OK at Sangeet per couple (different from
    Ceremony — see ceremony run-sheet, dry until reception).
  - Mehendi station decorations should reference morning event
    aesthetic continuity.

Risk flags:
  - Forest space = outdoor. Tent backup confirmed w/ Carpas Tarragona,
    contracted €4,500, on standby with 4hr deploy SLA.
  - Power: lighting + sound peak draw = 87 amps; venue panel B
    rated 100. No headroom for catering convection. Catering on
    separate generator (caterer's, included).
```

This is what gets generated from the schema in 90 seconds. Today it takes Astha 6-8 hours. Multiply by 5 events per Indian wedding × 8 weddings/senior/year = 240-320 hours/senior/year. **This is the killer feature.**

---

## Appendix D — DDL for join tables I gestured at but didn't write

For completeness so the engineer building Sprint 4 doesn't have to guess:

```sql
-- Many-to-many: events ↔ venues (one event usually has one venue but split-venue
-- weddings happen, e.g., ceremony at chapel + reception at hotel)
create table event_venue_bookings (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete restrict,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  hire_fee numeric(12, 2),
  hire_currency text,
  hire_includes text,                         -- "menu, drinks, service, tableware, furniture"
  hire_excludes text,                         -- "sound, lighting, decor"
  contract_signed_at date,
  contract_url text,
  deposit_amount numeric(12, 2),
  deposit_paid_at date,
  balance_due_at date,
  cancellation_terms text,
  weather_clause text,
  created_at timestamptz not null default now()
);

create unique index event_venue_unique on event_venue_bookings(event_id, venue_id);
create index event_venue_workspace_idx on event_venue_bookings(workspace_id);

-- Many-to-many: workspace_vendors ↔ events (already gestured at via serves_event_ids[]
-- on workspace_vendors, but for cleaner queries we may want a real join table).
-- I'd start with the array column and migrate to a join table if/when query
-- patterns demand it. Don't over-engineer Sprint 4.

-- Vendor inquiry/lead tracking (for the "vendor reaches out to us" direction —
-- inverse of vendor_rfps which is "we reach out to vendor"):
create table vendor_inquiries (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  category vendor_category,
  business_name text not null,
  contact_email text,
  source text,                                -- 'instagram_dm', 'inbound_email', 'event_referral'
  triaged_to uuid references users(id),
  status text not null default 'new',         -- 'new','reviewing','added_to_stable','rejected'
  notes text,
  created_at timestamptz not null default now()
);
```

The `event_venue_bookings` table is the cleanest place to hold the wedding's actual booking financials per event-venue pair. It's also where Stellata's accounting team will pull from for revenue forecasting. Don't bury this under a JSONB.

---

## Appendix E — On the multi-tenant pivot biting later

I said in §8 that I'd rather add `org_branches` now than later. Here's why specifically.

The current schema treats `organizations` as the top of the hierarchy. For Astia (single-planner agency), one `organizations` row is fine. For Stellata, one `organizations` row covers the brand but doesn't model the operational reality of four regional offices that share a vendor stable in some categories (international DJs we fly anywhere) and not others (local florists are regional).

If we don't introduce branches now, two things happen:
1. **`org_vendors.service_regions` becomes an unmanaged free-for-all.** Today's planner tags "barcelona" on every Spanish vendor; tomorrow's planner tags "spain" or "iberian-peninsula"; next year's planner queries "Mediterranean" and gets nothing. The text array becomes write-only data.
2. **Reporting fragments.** "Revenue by region" requires joining service_regions to `events.venues.address` parsed somehow. That's a hack.

The fix is small if done now:

```sql
create table org_branches (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,                         -- 'Barcelona', 'Lake Como', 'Dubai', 'Mexico City'
  region_code text not null,                  -- 'es-bcn', 'it-como', 'ae-dxb', 'mx-cdmx'
  default_currency text,
  default_languages text[],
  created_at timestamptz not null default now()
);

-- Add nullable branch_id to workspaces, org_vendors, users.
alter table workspaces add column branch_id uuid references org_branches(id);
alter table org_vendors add column primary_branch_id uuid references org_branches(id);
alter table users add column branch_id uuid references org_branches(id);
```

Nullable so existing data doesn't break. New weddings opt into a branch. Reporting becomes trivial. RLS extension is one extra clause. **Doing this in Sprint 4 is two hours. Doing it in Sprint 14 is two weeks of migration + bug-fixing.**

I bring this up because it's the kind of thing that gets written off as "over-engineering" on day one and then quietly costs you a quarter of engineering velocity in year two. The brief made the right call adding `org_id` + `workspace_id` everywhere — let's not stop one column short.

— L.
