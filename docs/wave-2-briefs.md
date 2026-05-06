# Wave 2 — parallel agent briefs

Run after Wave 1 (foundation) lands and is merged to `main`. Each brief is
self-contained for an isolated agent in its own worktree. Files don't overlap
across briefs except for one merge file (`packages/db/src/types.gen.ts`) and
one nav file — flagged inline.

Order of dispatch: all 5 in parallel. Expected wall-clock: ~1 day if all run
clean. Conflicts only on: `types.gen.ts` (resolve by re-merging hand-rolled
additions), `nav.tsx` (no agent touches it; admin-only nav lives in `admin-nav.tsx`).

---

## Agent A — Library Venues

**Goal**: Build the planner's venue library — `/admin/library/venues` CRUD with drop-folder photo+video upload, optional AI brochure-intake.

**Owns** (read+write):
- `apps/web/app/(admin)/admin/library/page.tsx` (replace placeholder with venue list)
- `apps/web/app/(admin)/admin/library/venues/[id]/page.tsx` (new — detail/edit)
- `apps/web/app/(admin)/admin/library/venues/new/page.tsx` (new)
- `apps/web/components/admin-library/venues/*` (new)
- `apps/web/app/api/admin/library/venues/*` (new — POST/PATCH/DELETE)
- `apps/web/app/api/admin/library/venues/[id]/media/*` (new — upload/delete photo)
- `apps/web/app/api/admin/library/venues/intake/route.ts` (optional AI brochure intake — Sonnet 4.6, vision)
- `apps/web/lib/library-venue-types.ts` (new TS shapes)

**Schema (already laid by Wave 1)**:
- `library_venues` (org-scoped) — full row defined in `packages/db/src/types.gen.ts`
- `library_venue_media` — id, library_venue_id, kind ('photo'|'video'), storage_path, sort_order, alt
- Storage bucket `library-media`, RLS-locked to `org_admin`

**Required behaviors**:
- List page shows grid of all `library_venues` for current org, with hero photo (first media row) + name + capacity + city.
- "+ New venue" button → form: name, city, region, country, lat, lng, capacity_seated, capacity_standing, hire_fee_eur, hire_fee_notes, event_roles[] checkboxes, description, internal_notes.
- Detail page: edit form + photo/video manager (drag-to-reorder, delete, set as cover).
- Drop-folder upload: dropzone accepts multiple files at once, uploads to `library-media` bucket at path `{org_id}/{library_venue_id}/{filename}`, creates one `library_venue_media` row per file. Use the existing pattern from `apps/web/app/api/pricing/intake/upload/route.ts` for multipart handling.
- AI brochure intake (optional, can ship without): drop a venue PDF/screenshot → Claude Sonnet 4.6 extracts name/capacity/hire/description into a pre-filled form for human review before save. Use existing `lib/anthropic.ts` helpers + tool-use pattern from pricing intake.

**Files MUST NOT touch**:
- `apps/web/app/(app)/*` (couple shell)
- Other agents' admin paths (`/admin/clients`, `/admin/playbook`, `/admin/settings`)
- `apps/web/components/nav.tsx`
- `packages/db/src/types.gen.ts` (Wave 1 already added what you need)
- Existing migrations or seeds

**Smoke test**: Sign in as Astha, navigate to `/admin/library`, create a new venue, upload 3 photos, verify they appear in the gallery, edit hire fee, delete a photo. `pnpm typecheck` + `pnpm build` clean.

**Report back with**: branch name, files created, screenshots-via-description of the working flow, any deviations.

---

## Agent B — Library Vendors

**Goal**: Mirror Agent A's pattern for the planner's vendor library at `/admin/library/vendors`. No photo upload (vendors are simpler — name + category + contact + default rate).

**Owns** (read+write):
- `apps/web/app/(admin)/admin/library/vendors/page.tsx` (new)
- `apps/web/app/(admin)/admin/library/vendors/[id]/page.tsx` (new)
- `apps/web/app/(admin)/admin/library/vendors/new/page.tsx` (new)
- `apps/web/components/admin-library/vendors/*` (new)
- `apps/web/app/api/admin/library/vendors/*` (new)
- `apps/web/lib/library-vendor-types.ts` (new)

**Schema (already laid by Wave 1)**:
- `library_vendors` — id, org_id, name, category vendor_category, contact_name, contact_email, contact_phone, default_quoted_price_eur, notes

**Required behaviors**:
- List grouped by `category` enum (same 28 categories as the existing `vendors` table — `vendor_category` enum is shared).
- "+ New vendor" form: name, category dropdown (enum values), contact_name, contact_email, contact_phone, default_quoted_price_eur, notes.
- Edit/delete inline.
- Bulk import via CSV (optional — defer if time-tight).

**Files MUST NOT touch**:
- Anything outside `apps/web/app/(admin)/admin/library/vendors/`, `apps/web/app/api/admin/library/vendors/`, `apps/web/components/admin-library/vendors/`, and your own `lib/library-vendor-types.ts`
- Agent A's library/venues paths
- `apps/web/app/(app)/vendors/*` — that's the workspace-level vendor list, untouched
- `apps/web/components/nav.tsx`, `packages/db/src/types.gen.ts`

**Smoke test**: Create 3 vendors across 3 categories, edit one, delete one, verify list groups correctly. `pnpm typecheck` + `pnpm build` clean.

---

## Agent C — Playbook + /plan customization

**Goal**: (1) Build the planner's playbook editor at `/admin/playbook` (master task templates). (2) Wire per-couple plan customization at `/plan` so couples can rename phases, add tasks, reorder.

**Owns**:
- `apps/web/app/(admin)/admin/playbook/page.tsx` (replace placeholder)
- `apps/web/app/(admin)/admin/playbook/phases/[id]/page.tsx` (new)
- `apps/web/components/admin-playbook/*` (new)
- `apps/web/app/api/admin/playbook/*` (new)
- **Modifications** to existing `/plan` UI for inline phase rename + add-task — see "shared-file rules" below
- `apps/web/lib/playbook-types.ts` (new)
- New migration `supabase/migrations/20260506000013_plan_customization.sql` to add `planning_tasks.phase_id` (FK to playbook_phases, nullable for legacy rows) and `planning_tasks.is_user_added` boolean default false

**Schema (already laid by Wave 1)**:
- `playbook_phases` — id, org_id, label, sort_order, anchor_kind, anchor_value_int
- `playbook_tasks` — id, playbook_phase_id, title, description, owner_default, category, sort_order, auto_derive_kind

**Required behaviors**:
- Playbook editor: list phases with sort handles, edit label/anchor, "+ Add phase". Inside each phase, list tasks, edit/delete, "+ Add task" with title + description + owner_default + auto_derive_kind dropdown.
- "Apply playbook to client" action (or auto on workspace creation — coordinate with Agent E): copies playbook_phases + playbook_tasks into `planning_tasks` for that workspace.
- /plan changes: existing `auto_derive_kind` lines stay computed; user-added tasks (`is_user_added=true`) get a manual checkbox. Rename phase → updates `planning_tasks.phase_label` (per-workspace override stored on the row, not on the playbook).

**Shared-file caution**:
- `apps/web/app/(app)/plan/page.tsx` and `apps/web/components/plan/*` will be modified. Other agents are NOT touching these — you have exclusive lock on plan-side files.
- `packages/db/src/types.gen.ts` — DO NOT modify by hand; the planning_tasks shape changes via your migration. Run `tsc --noEmit` to verify, and report the schema diff so the merge step can update types.gen.ts as part of merging your branch.

**Files MUST NOT touch**:
- Other admin sections (library, clients, settings)
- `apps/web/components/nav.tsx`
- Other migrations, other seeds

**Smoke test**: As org_admin, edit playbook (rename a phase, add a task). As couple, navigate to /plan, see existing tasks unchanged, add a custom task ("Marriage license appointment"), verify it persists with `is_user_added=true`. `pnpm typecheck` + `pnpm build` clean.

---

## Agent D — Client roster + branding

**Goal**: Build `/admin/clients` (the planner's CRM-style view of all couple workspaces) and `/admin/clients/[id]/branding` (per-workspace branding editor — logo + accent color + planner display name).

**Owns**:
- `apps/web/app/(admin)/admin/clients/page.tsx` (replace placeholder)
- `apps/web/app/(admin)/admin/clients/[id]/page.tsx` (new — drill-in)
- `apps/web/app/(admin)/admin/clients/[id]/branding/page.tsx` (new)
- `apps/web/components/admin-clients/*` (new)
- `apps/web/app/api/admin/clients/*` (new — branding update, logo upload)
- `apps/web/lib/admin-client-types.ts` (new)

**Schema (already laid by Wave 1)**:
- `workspace_branding` — workspace_id PK, accent_hex, logo_storage_path, planner_display_name

**Required behaviors**:
- Roster: list of all `workspaces` rows for the current org (org_id from session). For each: name, wedding_date, # venues marked-of-interest, # vendors active, last activity timestamp, status (planning/booked/done — derive from workspace stats for now).
- Drill-in: tabs for Overview / Branding / Activity / Settings. Overview shows the same stats as the existing dashboard but for the OTHER couple. Activity is a placeholder.
- Branding editor: color picker (`accent_hex`), logo upload (to `library-media` bucket at `{org_id}/branding/{workspace_id}.png`), planner_display_name text input. Saves to `workspace_branding` (UPSERT pattern).

**Files MUST NOT touch**:
- Other admin sections, the couple shell, nav, types.gen.ts, migrations.
- `apps/web/app/(app)/page.tsx` (existing couple dashboard) — Agent E may wire the per-couple branding into the couple shell as a follow-up.

**Smoke test**: As org_admin, view client roster, drill into the existing workspace, change accent_hex to `#0ea5e9`, upload a logo, save. Refresh the couple shell on a separate session — branding doesn't have to apply to the couple shell yet (that's Agent E or later).

---

## Agent E — "Push to workspace" + new client onboarding

**Goal**: Wire the actual ACTIONS that move data from the planner's library/playbook into a couple's workspace. Plus build "+ New client" flow.

**Owns**:
- `apps/web/app/api/admin/push/library-venue/route.ts` (clones a library_venue + its media into the target workspace's `venues` + Storage)
- `apps/web/app/api/admin/push/library-vendor/route.ts` (clones library_vendor → workspace vendors)
- `apps/web/app/api/admin/push/playbook/route.ts` (clones playbook_phases+tasks → planning_tasks for a workspace)
- `apps/web/app/api/admin/clients/new/route.ts` (creates workspace + couple user + sends magic link)
- `apps/web/app/(admin)/admin/clients/new/page.tsx` (form)
- `apps/web/components/admin-push/*` (the action buttons used INSIDE Agent A and Agent D's pages — they'll import from here)

**Required behaviors**:
- "Push to workspace" buttons on library_venue and library_vendor detail pages: select target workspace from a dropdown (must be in same org), POST clone, return success.
- Clone semantics: each push CREATES a fresh row in the workspace-scoped table. No reference back to the library — the library row could be edited or deleted without affecting the cloned copy. Photos: re-upload from `library-media` to the existing `venue-photos` bucket so the workspace's RLS still works.
- "+ New client" flow: form takes couple_email + workspace_name + wedding_date + (optional) playbook to apply. Server: creates workspace, creates user record, sends magic link via Supabase admin API (use the existing `gen_magic_link.ts` pattern).

**Files MUST NOT touch**:
- The OTHER admin sections directly — only IMPORT components from your `admin-push/*` directory which Agent A and Agent D will import. Coordinate via README in that dir.
- `apps/web/components/nav.tsx`, `packages/db/src/types.gen.ts`, migrations.

**Smoke test**: From `/admin/library/venues/[id]`, click "Push to workspace" → pick existing workspace → push → verify a new `venues` row appears for that workspace with photos. From `/admin/clients/new`, create a test client, verify magic link is generated.

---

## Coordination protocol (orchestrator notes)

1. **Spawn order**: A, B, C, D, E in parallel — each in its own worktree. Briefs are intentionally non-overlapping in file paths.
2. **Shared file**: Only `apps/web/components/admin-push/*` is shared, and only Agent E writes to it. A and D import from it (read-only — they don't touch the files).
3. **Merge order** (after all 5 return):
   - C first (it has a migration — apply that to Supabase before merging others)
   - A, B, D, E can merge in any order (no migrations)
4. **Conflict resolution on `packages/db/src/types.gen.ts`**: only Agent C's migration changes the schema; orchestrator hand-applies the type updates after C's migration lands.
5. **Verification per agent**: every agent must run `pnpm typecheck` + `pnpm build` clean before reporting done. If any fails, the orchestrator does NOT merge — sends back for rework.
6. **Snapshot update**: orchestrator updates `docs/SESSION-SNAPSHOT.md` after all 5 merge.

## Deferred to Phase 8

- Real planner self-signup (`/signup`)
- Stripe billing
- Domain + marketing site
- Resend email integration (today still uses Supabase magic link)
- WhatsApp integration

These are explicitly out of scope for Wave 2.
