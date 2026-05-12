# Move 5 — Multi-event orchestration: design doc

**Date:** 2026-05-12
**Status:** DRAFT awaiting Hursh review per `STRATEGIC_PIVOT_2026-05-12.md`. No code shipped yet.
**Goal:** First-class multi-event support so couples can plan sangeet/mehndi/ceremony/reception (Indian) or rehearsal-dinner/welcome/wedding/brunch (Western multi-day) without finding a dead-end.
**Why this matters strategically:** the differentiator that Zola architecturally can't replicate, per the pivot doc.

---

## TL;DR

We already have an `event_role` enum and 4 tables that scope by it (`venues.event_roles`, `guest_event_invitations`, `timeline_items.event_role`, `floor_plans.event_role`). What's missing is **the event itself as a first-class entity** with date/time/venue/name metadata, and a couple-facing surface to manage them.

Recommend a **sidecar table approach (Option A below) for the first build** — additive, low-risk, fast to ship, gets us multi-event UX working in ~3 days. Migrate to a fuller events table (Option B) later only if real-user demand warrants it (e.g., a couple wants TWO welcome parties).

---

## Current state — what's already built

From a grep of `supabase/migrations/`:

| Element | Where | Purpose |
|---|---|---|
| `event_role` enum | `20260505000004_event_roles.sql` | 11 values: mehndi, sangeet, welcome, haldi, ceremony, reception, wedding, stay, rehearsal, after_party, brunch |
| `venues.event_roles event_role[]` | `20260505000004_event_roles.sql` | Each venue tagged with which events it hosts |
| `guest_event_invitations` table | `20260506000005_guests.sql` | Per-event RSVP per guest (one row per guest×event_role) |
| `timeline_items.event_role` | `20260506000006_run_of_show.sql` | Run-of-show items scoped per event |
| `floor_plans.event_role` | `20260506000017_seating.sql` | Per-event seating |
| `pricing_scenarios.inputs` JSON `events: EventSlot[]` | `apps/web/lib/scenario-types.ts` | Planner cost calc with per-event line items |
| `workspaces.wedding_date` | original schema | Single wedding date — does NOT distinguish multi-day weddings |

**The gap:** No central `event` entity. The enum gives us a *type* but no *instance metadata* (when it starts, where it is, what the couple calls it, whether it's active for this workspace). Couples currently can't:
- See a list of "their events"
- Set "sangeet is Friday Sept 11 at 7pm at Casa Del Mar"
- Allocate budget per event
- Get a per-event run sheet
- See per-event guest counts

---

## Option A — Sidecar `event_details` table (recommended for first build)

Keep the `event_role` enum as the scoping mechanism. Add one row per (workspace_id, event_role) that holds metadata.

### Schema

```sql
create table event_details (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_role event_role not null,

  -- Metadata
  display_name text,                    -- "Friday Sangeet at Casa Del Mar" (couple's custom name, optional)
  start_at timestamptz,                 -- when this event starts (null = TBD)
  end_at timestamptz,                   -- when it ends (null = open-ended)
  venue_id uuid references venues(id) on delete set null,
  description text,                     -- markdown / short description
  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, event_role)
);

create index event_details_workspace_idx
  on event_details(workspace_id, is_active, sort_order);

create trigger event_details_updated_at before update on event_details
  for each row execute function set_updated_at();
```

### RLS

```sql
alter table event_details enable row level security;

-- Couple/admin read on their own workspace
create policy event_details_read_own on event_details for select
  using (workspace_id in (select workspace_id from users where id = auth.uid()));

-- Write requires workspace membership
create policy event_details_write_own on event_details for insert
  with check (workspace_id in (select workspace_id from users where id = auth.uid()));

create policy event_details_update_own on event_details for update
  using (workspace_id in (select workspace_id from users where id = auth.uid()));

create policy event_details_delete_own on event_details for delete
  using (workspace_id in (select workspace_id from users where id = auth.uid()));

-- Planner admin (org-scoped) read + write
-- ... follows the standard pattern from other tables
```

### One more addition — per-event budget allocation

```sql
alter table budget_lines
  add column event_role event_role null;

create index budget_lines_event_role_idx on budget_lines(workspace_id, event_role);
```

Existing budget lines stay event_role=null (interpreted as "shared / unallocated"). New AI-generated baselines can tag categories with their dominant event (e.g., sangeet venue → event_role='sangeet').

### Pros

- **Additive.** Nothing existing breaks. All current tables still work the same way.
- **One row per event_role per workspace** — covers 99% of real weddings.
- **Cheap migration** (~30 lines of SQL). Can ship behind T1.1 part 2 with no risk to existing data.
- **UX gets everything we need:** list events, set when/where, see per-event guests via existing `guest_event_invitations`, see per-event timeline via existing `timeline_items`, see per-event seating via existing `floor_plans`, see per-event budget via new `budget_lines.event_role`.

### Cons

- **Caps at one of each event role per wedding.** Can't have two welcome parties on different nights. Hard limit but rare in practice.
- **Custom event types blocked by enum.** No way to add a "Mehndi Brunch" hybrid without an enum extension.

### Why this is the right first build

Most multi-event weddings fit cleanly within the existing enum (Indian: mehndi/sangeet/haldi/ceremony/reception; Jewish: bedeken/ceremony/reception; Western multi-day: rehearsal/welcome/wedding/brunch). The 11-value enum was thoughtfully scoped. Real customer demand for "two welcome parties" is a future-problem signal worth waiting for.

---

## Option B — Full `events` table (defer to phase 2)

A first-class `events` table where every event is an instance with its own UUID, free-form name, and event_role becomes just a categorization tag.

### Schema sketch

```sql
create table events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_role event_role not null,        -- type / category
  name text not null,                    -- "Friday Sangeet"
  start_at timestamptz,
  end_at timestamptz,
  venue_id uuid references venues(id),
  ...
);

-- Then migrate the scoping FKs:
alter table guest_event_invitations
  add column event_id uuid references events(id) on delete cascade;
-- Backfill: for each (guest, event_role), create the event_id from events table

alter table timeline_items
  add column event_id uuid references events(id);
-- Backfill similarly

alter table floor_plans
  add column event_id uuid references events(id);
-- Backfill similarly
```

### Pros

- Maximum flexibility — multiple of same role, custom names, future event types
- Cleaner mental model long-term

### Cons

- **Big migration.** Touches 4 existing tables. Risk of getting backfill wrong.
- **Doesn't unlock anything Option A doesn't.** For 99% of weddings, Option A is functionally equivalent.
- **Delays shipping.** ~2 more days of design + backfill + migration testing.

**Verdict:** ship Option A now. Re-evaluate after Astia + 5 real B2B couples use it. If real demand for "two of same role" emerges, migrate.

---

## UX design — couple-facing

### New page: `/events`

A new pill in the main nav (replaces or sits alongside `/timeline` — see "Integration with existing surfaces" below for the nav decision).

**Empty state:**
> "What events are you having?"
> 
> Below: a checklist of all 11 event_roles with toggle switches (default OFF for all except "wedding" or "ceremony+reception"). User toggles on what's relevant.

**Loaded state:**
Card grid, one card per event the couple has turned on:

```
┌─────────────────────────────────────────┐
│ 🌸 SANGEET                              │
│ Friday, September 11, 2026 · 7:00pm     │
│ Casa Del Mar (linked)                   │
│ 80 of 80 guests invited · 65 yes        │
│ 12 timeline items · $X budget allocated │
│ [Edit] [View guests] [View timeline]    │
└─────────────────────────────────────────┘
```

Per-card actions:
- **Edit** — opens a drawer with display_name, start_at, end_at, venue_id, description fields
- **View guests** — links to `/guests?event=sangeet` (filter)
- **View timeline** — links to `/timeline?event=sangeet` (filter)

Add-event button at the bottom: opens a popover with the remaining event_roles to toggle on.

### Integration with existing surfaces

| Surface | Current behavior | New behavior with multi-event |
|---|---|---|
| **Dashboard** | Single "X days to wedding" tile based on `wedding_date` | Shows the FIRST upcoming event with its date; "X days to Sangeet (then 1 day later: Ceremony)" treatment for multi-day |
| **/guests** | Single list with overall RSVPs | Filter tabs at top: "All events" / "Sangeet" / "Ceremony" / "Reception" — each shows per-event RSVPs |
| **/timeline** | Filter exists by event_role but UX may be sparse | Each event has its own collapsible section with its run-of-show items |
| **/budget** | Single tree | Budget tree retains shared lines; new optional grouping by event (toggle "Group by event") |
| **/venues** | Cards show event_roles tags | Cards highlight which event THIS venue is anchored to (start_at + event_role from event_details) |
| **/payments** | Vendor calendar | Unchanged |
| **/(app)/page.tsx dashboard widgets** | Generic counts | Per-event "X days until Sangeet" widget when multi-event mode is on |
| **AI Co-pilot** | Workspace-aware Q&A | Can answer per-event Q's ("how many people are coming to the sangeet?", "what's left for the mehndi?") |

### Nav placement decision

The pivot doc trimmed nav to 8 primaries: Dashboard / Plan / Venues / Vendors / Guests / Budget / Payments / Public site. **Adding `/events` would push it to 9.** Two options:

- **Option X:** Replace `/timeline` (currently under "More") with `/events` as a primary nav item. Each event has its own timeline embedded inside `/events/<role>`.
- **Option Y:** Keep `/events` as a primary nav item (9 primaries; mobile still fits) and `/timeline` becomes a per-event drill-down.

**Recommend X.** `/timeline` becomes a sub-view of `/events/<role>`. The user mental model: "I plan EVENTS, each event has a timeline / guests / vendors / budget." This is the cleaner IA for multi-event weddings.

---

## Integration with existing AI surfaces

### AI Co-pilot

Context build (in `apps/web/app/api/ai/chat/route.ts`) gets a new `events_summary` section:

```ts
const eventsContext = await sb
  .from("event_details")
  .select("event_role, display_name, start_at, venue_id, description")
  .eq("workspace_id", wsId)
  .eq("is_active", true)
  .order("start_at");

// Inject into prompt:
// "The user has [N] events: [Sangeet on Fri 9/11], [Ceremony on Sat 9/12], [Reception same evening]."
```

This unblocks deep-audit finding #36 — Co-pilot will be able to answer multi-event questions.

### Onboarding chat

When the user mentions multi-day or culturally-specific words ("Indian wedding," "sangeet," "rehearsal dinner"), the AI extractor proposes activating those events in `event_details`. The completion handler writes them.

### Photo → pricing (Move 2)

Photo analysis can suggest "this looks like a sangeet setup" — links into the relevant event for vendor matching.

---

## Build sequence (post-review)

Assuming Option A approved:

### Day 1 — Schema + read paths
- Migration file (`supabase/migrations/YYYYMMDDhhmmss_event_details.sql`)
- Queued for T1.1 part 2 activation; pre-activation we paste manually OR build the UI behind a feature flag until migration applies
- New types in `apps/web/lib/event-types.ts`
- Server-side read helpers (`apps/web/lib/data/events.ts`)
- `/events/page.tsx` server component reads + renders the event grid

### Day 2 — Write paths + integration
- `/api/events/[role]` PATCH endpoint (using write-guard pattern)
- Edit drawer (`apps/web/components/events/event-edit-drawer.tsx`)
- Activate/deactivate event toggle
- `/guests` + `/timeline` + `/budget` integrations (filter tabs, per-event grouping)
- Update dashboard widgets to show first upcoming event

### Day 3 — AI integration + tests
- Co-pilot context build expansion (events_summary section)
- Onboarding extractor — detect multi-event signals + propose
- 3 new smoke tests: events page render, edit drawer reachable, per-event guest filter works
- Update CLAUDE_PATTERNS.md with the events table location

---

## Open questions for Hursh

Decide before build starts:

1. **Option A or B?** Recommend A. Confirm or push back.
2. **Nav decision** — Option X (replace timeline with events) or Option Y (events alongside)? Recommend X.
3. **Default events on activation** — should new B2C workspaces auto-enable "ceremony" + "reception" (the most common 2-event setup) or start completely empty?
4. **Wedding_date semantics** — when a workspace has multi-event mode active, does `workspaces.wedding_date` mean (a) the ceremony date, (b) the earliest event's date, (c) deprecated? Recommend (a) — ceremony date stays canonical, multi-event dates live in event_details.
5. **Budget allocation UX** — when a budget line has event_role=null, surface it as "shared across events" or as "main wedding"? Recommend "shared."
6. **B2B integration** — should Astia see a planner view of "all multi-event timelines across all my couples"? Defer to phase 2.

---

## What this DOESN'T do (intentionally)

- **Doesn't support multiple events of the same role.** No two welcome parties.
- **Doesn't add new event types beyond the existing enum.** No custom "Boat Party" event.
- **Doesn't restructure venues.** A venue can host multiple events (already supported via the array column).
- **Doesn't introduce per-event vendor assignments.** Vendors still bill at the workspace level. Per-event vendor tagging can be added later if Astia asks.

---

## End of design — awaiting Hursh review

When you sign off, I'll start Day 1 build. If T1.1 part 2 isn't active yet, I'll write the migration + scaffold the code behind a feature flag so we don't ship a broken page.
