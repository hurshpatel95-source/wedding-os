# Sprint 3 — Pricing Engine + AI Intake Design

Source-of-truth scope: `claude-code-brief.md` §"Pricing Calculator Behavior",
§"Excel Template", §"Sprint 3 — Pricing Engine".
New scope (beyond brief): AI-assisted pricing intake from planner
WhatsApp screenshots / PDFs / pasted text, with confidence-gated apply
and per-line audit trail surfaced in the calculator.

Code anchors:
- Schema: `supabase/migrations/20260505000001_init.sql:115-173`
- RLS:    `supabase/migrations/20260505000002_rls.sql:106-163`
- Calc:   `packages/lib/src/pricing.ts:57-99`
- Seed:   `supabase/seed/seed.ts:226-302` (28 line items, 9 categories)

---

## 1. New tables (DDL sketch)

New migration: `supabase/migrations/20260510000001_pricing_intake.sql`.

```sql
-- enums
create type intake_source_kind   as enum ('image', 'pdf', 'text', 'whatsapp_export');
create type intake_status        as enum ('uploaded', 'extracting', 'extracted', 'partial', 'failed', 'applied', 'archived');
create type intake_proposal_kind as enum ('default_price', 'override', 'new_line_item');
create type proposal_decision    as enum ('pending', 'accepted', 'edited', 'rejected', 'needs_info');
create type change_actor_kind    as enum ('user', 'ai_intake', 'excel_import', 'seed', 'manual_admin');
create type change_target        as enum ('default_price', 'override_price', 'override_included', 'override_notes', 'new_line_item');

-- 1) intake source: one row per upload/paste
create table pricing_intake_sources (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  workspace_id    uuid not null references workspaces(id)    on delete cascade,
  template_id     uuid not null references pricing_templates(id) on delete cascade,
  venue_id        uuid     references venues(id) on delete set null, -- null => default-price intake
  uploaded_by     uuid not null references users(id) on delete restrict,

  kind            intake_source_kind not null,
  status          intake_status not null default 'uploaded',
  storage_path    text,                    -- supabase storage key for image/pdf
  mime_type       text,
  byte_size       integer,
  raw_text        text,                    -- pasted text or extracted text fallback
  source_label    text,                    -- "Astha WhatsApp 2026-04-12" etc.
  source_dated_at date,                    -- date the planner sent the quote

  -- claude run metadata
  model           text,                    -- e.g. "claude-sonnet-4-6"
  claude_request  jsonb,                   -- full request body sent (prompt+inputs, redacted of file bytes)
  claude_response jsonb,                   -- full structured response from Claude
  prompt_tokens   integer,
  output_tokens   integer,
  cache_read_tokens  integer,
  cache_write_tokens integer,
  cost_usd        numeric(10, 4),
  error           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index pricing_intake_sources_workspace_idx on pricing_intake_sources(workspace_id, status, created_at desc);
create index pricing_intake_sources_venue_idx     on pricing_intake_sources(venue_id);

-- 2) one row per Claude-extracted candidate change (until applied/rejected)
create table pricing_intake_proposals (
  id              uuid primary key default uuid_generate_v4(),
  source_id       uuid not null references pricing_intake_sources(id) on delete cascade,
  kind            intake_proposal_kind not null,

  -- match: either points to existing line item, or proposes a new one
  matched_line_item_id uuid references pricing_line_items(id) on delete set null,
  proposed_category    text,    -- when kind='new_line_item'
  proposed_label       text,
  proposed_description text,
  proposed_unit        pricing_unit,
  proposed_tier        pricing_tier,
  proposed_unit_price  numeric(12, 2),
  proposed_currency    text,
  proposed_included    boolean, -- override-only
  proposed_notes       text,

  -- Claude's view
  confidence      numeric(4, 3) not null check (confidence between 0 and 1),
  rationale       text,                    -- one-line "why I matched this"
  evidence        jsonb,                   -- {quote, page?, bbox?, message_idx?}
  needs_info      text,                    -- non-null => clarification question

  -- review state
  decision        proposal_decision not null default 'pending',
  decided_by      uuid references users(id) on delete set null,
  decided_at      timestamptz,
  applied_change_log_id uuid,              -- backfilled when applied; FK below

  created_at      timestamptz not null default now()
);
create index pricing_intake_proposals_source_idx on pricing_intake_proposals(source_id, decision);

-- 3) audit log: every default-price or override mutation, with source ref
create table pricing_change_log (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  workspace_id    uuid     references workspaces(id) on delete cascade, -- null => default-price (org-scoped)
  template_id     uuid not null references pricing_templates(id) on delete cascade,
  line_item_id    uuid     references pricing_line_items(id) on delete set null,
  venue_id        uuid     references venues(id) on delete cascade,     -- null => default-price change

  target          change_target not null,
  old_value       jsonb,                   -- {unit_price, currency, included, notes, ...}
  new_value       jsonb,

  actor_kind      change_actor_kind not null,
  actor_user_id   uuid references users(id) on delete set null,
  source_id       uuid references pricing_intake_sources(id) on delete set null,
  proposal_id     uuid references pricing_intake_proposals(id) on delete set null,
  evidence        jsonb,                   -- copied from proposal at apply time
  note            text,                    -- free-text reason

  created_at      timestamptz not null default now()
);
create index pricing_change_log_line_item_idx on pricing_change_log(line_item_id, created_at desc);
create index pricing_change_log_venue_idx     on pricing_change_log(venue_id, line_item_id, created_at desc);
create index pricing_change_log_source_idx    on pricing_change_log(source_id);

alter table pricing_intake_proposals
  add constraint pricing_intake_proposals_change_log_fk
  foreign key (applied_change_log_id) references pricing_change_log(id) on delete set null;

-- updated_at trigger
create trigger pricing_intake_sources_updated_at before update on pricing_intake_sources
  for each row execute function set_updated_at();
```

Storage: reuse a new bucket `pricing-intake` (private — admin-only). Storage
policy in same migration: insert/select gated on `auth_is_admin()`.

### RLS additions (same migration)

All three tables: enable RLS. Admin-only writes; admin-only reads
(planner-internal). Pattern matches `pricing_templates_admin_write`
(`20260505000002_rls.sql:109`).

```sql
alter table pricing_intake_sources    enable row level security;
alter table pricing_intake_proposals  enable row level security;
alter table pricing_change_log        enable row level security;

create policy intake_sources_admin on pricing_intake_sources for all
  using (org_id = auth_org_id() and auth_is_admin())
  with check (org_id = auth_org_id() and auth_is_admin());

create policy intake_proposals_admin on pricing_intake_proposals for all
  using (exists (select 1 from pricing_intake_sources s
                 where s.id = source_id and s.org_id = auth_org_id())
         and auth_is_admin())
  with check (exists (select 1 from pricing_intake_sources s
                 where s.id = source_id and s.org_id = auth_org_id())
         and auth_is_admin());

-- change_log: admin write; couple read (so calculator popover works) but
-- only org-scoped rows; couples never see source_id payload contents
create policy change_log_read on pricing_change_log for select
  using (org_id = auth_org_id());
create policy change_log_admin_write on pricing_change_log for all
  using (org_id = auth_org_id() and auth_is_admin())
  with check (org_id = auth_org_id() and auth_is_admin());
```

Couples seeing change_log is intentional: the calculator-line popover
("where did this number come from?") is a couple-facing feature. We can
hide the raw `evidence` jsonb client-side or null it for non-admins via a
view if leak risk grows.

---

## 2. API surface (Next.js App Router route handlers)

All under `apps/web/app/api/pricing/...`. Server-side auth via
`createClient()` from `apps/web/lib/supabase/server.ts`. RLS enforced —
every handler runs as the user; no service-role key on these paths
unless explicitly noted.

### Pricing template / calculator (Sprint 3 core)

| Method | Path | Body / Query | Returns | RLS |
|---|---|---|---|---|
| GET  | `/api/pricing/template` | `?venue_id=` | `{ template, categories[], lineItems[], overrides }` | reads via `pricing_templates_read`, `pricing_categories_read`, `pricing_line_items_read`, `venue_pricing_read` |
| POST | `/api/pricing/scenarios` | `{ venue_id, name, inputs, calculated_total, currency }` | `{ id }` | `pricing_scenarios_write` (workspace) |
| GET  | `/api/pricing/scenarios` | `?venue_id=` | `{ scenarios[] }` | `pricing_scenarios_read` |
| PATCH | `/api/pricing/overrides` | `{ venue_id, line_item_id, unit_price?, included?, notes? }` | `{ overrides }` + writes `pricing_change_log` | `venue_pricing_admin_write` (admin only) |
| POST | `/api/pricing/template/import` | multipart `.xlsx` | `{ summary, validation_errors[], imported }` | `pricing_line_items_admin_write` |
| GET  | `/api/pricing/template/export` | `?include_overrides=true` | `.xlsx` stream | reads as above |
| GET  | `/api/pricing/changelog` | `?line_item_id=&venue_id=` | `{ entries[] }` | `change_log_read` |

`PATCH /overrides` is the choke point — it always inserts a
`pricing_change_log` row with `actor_kind='manual_admin'` so calculator
popovers stay accurate even without AI involvement.

### AI intake routes

| Method | Path | Body / Query | Returns | RLS |
|---|---|---|---|---|
| POST | `/api/pricing/intake/upload` | multipart: `file` or `text`, `venue_id?`, `source_label?`, `source_dated_at?` | `{ id, status:'uploaded' }` | admin (`intake_sources_admin`) |
| POST | `/api/pricing/intake/extract/[id]` | empty | `{ id, status, proposals[] }` | admin |
| POST | `/api/pricing/intake/apply` | `{ source_id, decisions: [{ proposal_id, decision, edits? }] }` | `{ applied:[{proposal_id, change_log_id}], skipped[] }` | admin; mutations gated by `pricing_line_items_admin_write` and `venue_pricing_admin_write` |
| GET  | `/api/pricing/intake` | `?status=` | `{ sources[] }` | admin |
| GET  | `/api/pricing/intake/[id]` | — | `{ source, proposals[] }` | admin |
| POST | `/api/pricing/intake/[id]/clarify` | `{ proposal_id, answer }` | `{ proposal }` (re-runs Claude with the answer) | admin |
| DELETE | `/api/pricing/intake/[id]` | — | `{ ok }` (soft → status='archived') | admin |

#### Wire shapes (TS)

```ts
// upload response
type IntakeUploadRes = { id: string; status: "uploaded" };

// extract response
type IntakeExtractRes = {
  id: string;
  status: "extracted" | "partial" | "failed";
  proposals: ProposalDTO[];
  cost_usd: number;
};

type ProposalDTO = {
  id: string;
  kind: "default_price" | "override" | "new_line_item";
  matched_line_item_id: string | null;
  proposed: {
    category?: string; label?: string; description?: string;
    unit?: PricingUnit; tier?: PricingTier;
    unit_price?: number; currency?: string;
    included?: boolean; notes?: string;
  };
  confidence: number;            // 0..1
  rationale: string;
  evidence: { quote: string; page?: number; message_idx?: number; bbox?: number[] };
  needs_info: string | null;
  decision: "pending" | "accepted" | "edited" | "rejected" | "needs_info";
};

// apply request
type IntakeApplyReq = {
  source_id: string;
  decisions: Array<{
    proposal_id: string;
    decision: "accepted" | "edited" | "rejected";
    edits?: Partial<ProposalDTO["proposed"]>;
  }>;
};
```

Apply handler is transactional: opens a Postgres tx, for each
`accepted|edited` proposal it (a) writes the mutation
(`pricing_line_items` UPDATE for default-price, `venue_pricing.overrides`
JSONB merge for override, `pricing_line_items` INSERT for new), (b)
inserts a `pricing_change_log` row with `actor_kind='ai_intake'`, source
+ proposal refs, and copied evidence, (c) updates the proposal's
`decision` and `applied_change_log_id`. If all proposals on a source are
non-pending → flip source `status='applied'`.

---

## 3. Claude API call shape

Server-side only — uses `@anthropic-ai/sdk` via `packages/lib`.
Follow the `claude-api` skill conventions: prompt caching for stable
context, structured tool output for the extraction.

- **Model**: `claude-sonnet-4-6` (sonnet tier; right cost/latency for
  intake; vision-capable for screenshots; matches skill recommendation
  for OCR + structured extraction).
- **Endpoint**: `messages.create` with `tool_choice: { type: "tool", name: "propose_pricing_changes" }` to force structured output.
- **System prompt** (sketch):
  > You are a wedding-pricing extractor for a planner ops tool. Input
  > is a planner's quote (image, PDF text, or chat). Output a list of
  > proposed line-item changes against the existing template. For each
  > proposed line you must (a) match to an existing line_item_id when
  > confidence ≥ 0.6, else propose a new one; (b) cite an exact verbatim
  > quote from the source; (c) emit a confidence in [0,1]; (d) if you're
  > under 0.6 confidence on a price+unit pair, set `needs_info` with one
  > targeted question instead of guessing.
- **Cached blocks** (`cache_control: { type: "ephemeral" }`):
  1. The full system prompt (rarely changes).
  2. The line-item catalog rendered as a compact JSON list:
     `[{id, category, label, unit, default_unit_price, currency, tier}]`
     — currently 28 items × ~120 bytes ≈ 3-4 KB; far above the 1024-token
     cache floor only when concatenated with the system prompt, so cache
     them as one combined block. Re-warm whenever the catalog mutates.
  3. (Per-venue intakes only) the venue's current overrides as a third
     cache breakpoint or as user-block input — overrides change too
     often to cache reliably; pass uncached.
- **User content** (uncached, per-request):
  - For images: `{ type: "image", source: { type: "base64", media_type, data } }` — multiple if WhatsApp thread.
  - For PDFs: PDF input via the `document` content type.
  - For text: `{ type: "text", text: rawText }`.
  - Plus: `{ type: "text", text: "Source label: ${label}; venue_id: ${venue_id ?? 'default'}; today: ${date}" }`.
- **Tool definition** (forces JSON Schema-validated output):

```json
{
  "name": "propose_pricing_changes",
  "input_schema": {
    "type": "object",
    "properties": {
      "proposals": { "type": "array", "items": {
        "type": "object",
        "required": ["kind","confidence","rationale","evidence"],
        "properties": {
          "kind": { "enum": ["default_price","override","new_line_item"] },
          "matched_line_item_id": { "type": ["string","null"] },
          "proposed": {
            "type": "object",
            "properties": {
              "category": {"type":"string"}, "label": {"type":"string"},
              "description": {"type":"string"},
              "unit": { "enum": ["per_guest","per_event","flat","per_hour","per_day"] },
              "tier": { "enum": ["basic","standard","premium"] },
              "unit_price": {"type":"number"}, "currency": {"type":"string"},
              "included": {"type":"boolean"}, "notes": {"type":"string"}
            }
          },
          "confidence": { "type":"number", "minimum":0, "maximum":1 },
          "rationale": {"type":"string"},
          "evidence": {
            "type":"object",
            "required":["quote"],
            "properties":{
              "quote":{"type":"string"},
              "page":{"type":"integer"},
              "message_idx":{"type":"integer"},
              "bbox":{"type":"array","items":{"type":"number"}}
            }
          },
          "needs_info": {"type":["string","null"]}
        }
      }}
    },
    "required": ["proposals"]
  }
}
```

- **Clarification round-trip** (`/intake/[id]/clarify`): replays the
  original request, appending an assistant turn with the prior tool call
  + a synthetic `tool_result` content block carrying the user's answer,
  then a fresh user turn `"Re-emit only the proposal(s) that depended on
  this answer, with updated confidence."` Cache hits on system + catalog
  blocks keep this cheap.
- **Auto-apply gate** (server-side): proposal is auto-applied without UI
  review iff `confidence ≥ 0.92`, `kind != 'new_line_item'`,
  `matched_line_item_id` is set, and `needs_info is null`. Everything
  else lands in the review screen. This threshold belongs in
  `packages/lib/src/pricing-intake.ts` so it's tunable in one place.

---

## 4. UI screens

### `/settings/pricing` (existing — `apps/web/app/(app)/settings/pricing/page.tsx:1`)

Sprint 3 turns this stub into the template editor:
- Categories accordion → line-item rows (label, unit, default price, tier, currency)
- Inline edit (admin) → PATCH default-price → writes `pricing_change_log` (`manual_admin`)
- Buttons: **Import .xlsx**, **Export .xlsx**, **Open AI intake**

### `/settings/pricing/intake` (new)

- Drop-zone (drag-drop or paste): images, PDFs, raw text. Optional
  fields: Venue (defaults to "Default template"), Source label, Source
  date.
- Past intakes table: source_label, kind icon, status badge
  (`uploaded` / `extracting` / `extracted` / `partial` / `applied` / `failed`),
  count of pending proposals, uploaded by, created_at. Row → detail page.

### `/settings/pricing/intake/[id]` (new)

Two-pane layout:
- **Left**: original source preview — image viewer (with bbox highlight
  on hover), PDF embed, or text view.
- **Right**: proposals grouped by category. Each row shows:
  - Match badge (existing line-item label, or "NEW")
  - Old value → New value diff
  - Confidence bar + rationale
  - Quote chip (clicking scrolls/highlights left pane)
  - Per-row actions: **Accept** / **Edit** (inline form) / **Reject** /
    **Ask Claude** (only when `needs_info` is set; opens a dialog,
    posts to `/clarify`)
- Sticky footer: "Apply N selected" → `POST /apply`.

### Calculator UI (Pricing tab on venue detail — Sprint 3 main deliverable per brief)

Lives at `apps/web/components/venues/tabs/pricing-tab.tsx` (new) wired
into the existing `VenueDetailTabs` (`apps/web/components/venues/venue-detail-tabs.tsx`).

Layout (matches brief §"Screens" #5 and §"Pricing Calculator Behavior"):
- **Left rail (sticky)** — Zustand store `usePricingInputs` holds
  `ScenarioInputs` from `packages/lib/src/pricing.ts:10-19`:
  - Guest count slider 50–300 (Radix slider)
  - Events checkboxes: Mehndi / Sangeet / Haldi / Ceremony / Reception
  - Dietary mix: 3 number inputs that sum to 100
  - Tier dropdowns: decor / photo / video / music
  - Transport toggle (Switch)
  - Currency display toggle: EUR / USD (FX rate is per-workspace setting)
  - "Save scenario" button (disabled when no changes since last save)
  - **Sensitivity slider**: `±20%` guest count knob (default 0)
- **Right pane** — line items grouped by category, computed via
  `calculateScenario` (`packages/lib/src/pricing.ts:57`). Each row:
  - label, unit chip, unit_price (admin → inline editable),
    quantity, subtotal
  - small **info icon** → Popover showing the change_log:
    last N entries, each: "EUR 220 → EUR 240 · 2026-04-18 · AI from
    Astha WhatsApp 2026-04-12 · 'menu now 240 pax'". Clicking the
    source chip jumps to the intake detail page.
  - Ghost line (lighter row) below subtotal showing the sensitivity
    range: `EUR 22,800 (–20%) … EUR 34,200 (+20%)` — computed
    client-side by re-running `calculateScenario` with
    `guest_count * 0.8` and `* 1.2`.
- **Footer**: grand total in chosen currency, "Save scenario" CTA,
  "Reset to defaults" link.

Recalc is pure client (no network) — `calculateScenario` is already
isomorphic. Inputs change → Zustand → memoized `CalcResult` → render.

### Calculator-line "source" popover (universal)

Component: `apps/web/components/pricing/source-popover.tsx`. Receives
`{ line_item_id, venue_id }`, hits `GET /api/pricing/changelog`, lazy
on first hover. Shown on every editable line in template editor AND in
calculator. The *same* component covers the brief's audit-trail
requirement and is the user-visible payoff of the AI intake.

---

## 5. Build order

1. **Calculator UI against current seed** — render Pricing tab on
   venue detail, wire Zustand inputs, use existing `calculateScenario`,
   no overrides editor yet. (Just defaults from `pricing_line_items` +
   empty `venue_pricing.overrides`.) Verifies the calc engine against
   the 28 seeded items end-to-end.
2. **Save scenario flow** — `POST /api/pricing/scenarios`,
   "My scenarios" sidebar dropdown to load. Touches `pricing_scenarios`
   only; no schema change.
3. **Per-venue override editor (admin inline edit)** — admin-only edit
   on each calculator row, `PATCH /api/pricing/overrides`, writes
   `venue_pricing.overrides` JSONB merge. Land
   `pricing_change_log` table + minimal RLS now (so this PATCH already
   audits) — first slice of intake migration. Source-popover component
   ships here, reading `pricing_change_log` directly.
4. **Sensitivity slider + ghost-line render** — purely client, no
   backend. Ships with #1 if time, otherwise here.
5. **Excel import/export** — `xlsx` is already in `apps/web/package.json`.
   Single sheet parser per brief §"Excel Template"; second sheet
   (per-venue overrides) optional. Imports go through the same
   `pricing_change_log` write path with `actor_kind='excel_import'`.
6. **Intake DDL + storage bucket + RLS** — full migration applies the
   rest of §1 (intake_sources, intake_proposals; change_log already
   landed in #3). Add `pricing-intake` private bucket.
7. **Intake pipeline — upload + extract** — `/upload` and
   `/extract/[id]` routes, Claude call wrapped in `packages/lib/src/
   pricing-intake.ts` with cached system+catalog blocks. Persist
   proposals; no apply yet. Includes the `/intake` list page +
   `/intake/[id]` review UI in read-only mode.
8. **Intake pipeline — review + apply + clarify** — wire per-proposal
   actions, `/apply` transactional handler, `/clarify` round-trip,
   auto-apply gate at confidence ≥ 0.92. Calculator-line popover now
   surfaces real AI-sourced entries end-to-end.

Reasonable cut-line if Sprint 3 runs hot: ship steps 1–5 + audit-log
plumbing from step 6, defer 7–8 to Sprint 3.5 or fold into Sprint 4.
The calculator + Excel + override editor + audit popover satisfy the
brief's literal Sprint 3 deliverables; AI intake is the strict-add.

---

## 6. Open questions for Hursh

1. **Auto-apply threshold** — confirm `confidence ≥ 0.92`, single match,
   non-new-item only. Too low risks silent bad edits; too high makes
   the feature feel like a labelling tool. OK to start at 0.92 and
   tune?
2. **Default vs override scope** — when Astha sends a price update with
   no venue context, should it touch `pricing_line_items.default_unit_price`
   (changes every venue's calculator), or land only as a per-venue
   `venue_pricing.overrides` row on a default/"reference" venue? My
   plan: require admin to pick a target venue (or "Apply to template
   defaults") at upload time.
3. **Currency normalization** — Astha quotes in EUR (per seed). If a
   future intake comes in INR/USD, do we (a) reject, (b) auto-convert
   at a stored FX rate, or (c) store native currency on the proposal
   and let admin convert at apply time? My plan: (c).
4. **Storage retention** — keep raw images/PDFs forever for audit, or
   purge after N days once `status='applied'`? Affects bucket sizing
   and whether the calculator-line popover can render the original
   source years later.
5. **Couples seeing AI provenance** — should the source-popover say
   "AI from Astha WhatsApp 2026-04-12" to couples, or just "Updated
   2026-04-18 by admin"? I.e. is the AI's role user-visible or
   internal-only? My default: visible. The whole point is provenance.
