# Patterns for Future Claude Sessions

**Audience:** Whichever Claude session resumes work on this codebase.
**Purpose:** Tactical lessons + patterns + gotchas learned May 5-11, so we don't re-discover them at cost.

---

## 0. The non-negotiable principles

These outrank tactical efficiency. If they conflict with what Hursh asks, name the conflict and ask.

1. **Foundation before features.** If `docs/STABILIZATION_SPRINT.md` has incomplete Tier 1 items, do NOT ship new features. Point at the docs.

2. **Don't improvise.** If Hursh asks for "X feature," check `docs/PRODUCT_ROADMAP.md` for whether X is in scope and what phase. If unclear, ask before building.

3. **Show what's already there before building.** Hursh once said the codebase felt like "nothing" — but had 30 working features. Insecurity + tired-eyes ≠ truth. Show the inventory first.

4. **Brigette pitch is deferred to Q3 2026.** Vertical 2 (Acquired Honeymoon), not Vertical 1. If Hursh starts spinning toward "let's pitch Brigette now," name it as the opportunistic-founder pattern (`acquired_planner_spec.md` §10).

5. **No equity to anyone before paying customers exist.**

---

## 1. Codebase quick-orient (read these in order)

```
docs/SESSION_HANDOFF_2026-05-11.md    ← Comprehensive — all context
docs/COMPACT-HANDOFF.md                ← Short punch list, current state
docs/STABILIZATION_SPRINT.md           ← Sprint plan + completion
docs/PRODUCT_ROADMAP.md                ← Post-stabilization 60-day plan
docs/STATE-OF-THE-BUILD.md             ← Architecture map + bug history
docs/acquired_planner_spec.md          ← Master product spec
docs/rachel_onboarding_brief.md        ← Rachel send when ready
docs/stabilization/T1.*_design.md     ← Per-item designs (T1.1-T1.5)
```

If you only read one: `SESSION_HANDOFF_2026-05-11.md`. It has TL;DR + everything else.

---

## 2. Architecture cheat-sheet

**Three user types, two routing shells:**
- `/(app)/` — couple shell (BOTH B2B planner-served AND B2C self-serve)
- `/(admin)/` — planner admin shell

**Mode resolution:**
```ts
workspace.skin ─→ resolveWorkspaceMode() ─→ WorkspaceMode
                                            ├─ "b2c" (acquired_planner)
                                            ├─ "b2c_acquired_style_collab"
                                            ├─ "b2b_co_branded"
                                            └─ "b2b_white_label"
```

Server components: `resolveWorkspaceMode(normalizeSkin(workspaceSkin))` from `@/lib/workspace-mode`
Client components: `useWorkspaceMode()` / `useIsB2B()` / `useIsB2C()` from `@/components/workspace/workspace-mode-provider`

**The fork-needed surface (per T1.5):**
- `/(app)/page.tsx` dashboard — `!isPlannerServed` gates WelcomeBanner + AutopilotTodayWidget
- `/(app)/autopilot/page.tsx` — B2B short-circuits with "your planner runs this" splash
- `/(app)/vendors/page.tsx` — empty state copy differs
- `task-edit-drawer.tsx` — Cost-link section hidden for B2B

Other pages share rendering across modes — same data shape, same actions.

**Already forked by data-shape (not mode):**
- `/(app)/estimator/page.tsx` — `budget_estimates` rows present → planner-seeded view; else `budget_lines` → drill-down view
- `/(app)/pricing/page.tsx` — venues with `event_roles` present → FullPricingPlanner; else admin → ScenarioStudio; else couple → redirect to /budget

### Multi-event scoping (shipped May 12)

- Events are scoped via the `event_role` enum (11 values in `20260505000004_event_roles.sql` + extensions)
- `event_details` table (post-migration `20260512100000`) stores per-event metadata (display_name, start_at, end_at, venue_id, is_active, sort_order) keyed on (workspace_id, event_role)
- Existing per-event scoping tables: `guest_event_invitations`, `timeline_items`, `floor_plans`, `venues.event_roles` array
- `budget_lines.event_role` (nullable) — null means "shared / unallocated"
- UI surfaces: `/events` (entry, in More dropdown), `/guests?event=<role>`, `/timeline?event=<role>`, `/budget?group=event`
- API: `/api/events/[role]` PATCH (upsert) + DELETE (soft via is_active=false)
- Read helpers in `apps/web/lib/data/events.ts` — all tolerant of pre-migration state (try/catch wraps the table reads)
- Co-pilot context: `apps/web/app/api/ai/chat/route.ts` injects an `events_summary` section into the system prompt when active events exist; omitted entirely otherwise
- Onboarding: `apps/web/app/api/onboarding/complete/route.ts` scans the chat transcript for multi-event keywords (sangeet, mehndi, rehearsal dinner, brunch, after-party, indian/jewish wedding) and seeds the matching `event_details` rows
- Default behavior: B2C couples auto-enable `ceremony` + `reception` on first `/events` page load
- B2B planner-served couples see a calm "your planner is building this" splash on `/events` — they don't drive event creation themselves

---

## 3. Database operation patterns

### When writing mutations — ALWAYS use the write-guard

```ts
import { dbUpdate, dbInsert, dbDelete, dbWriteErrorResponse } from "@/lib/db-write-guard";

// PATCH endpoint pattern
try {
  await dbUpdate(
    "update workspace preferences",
    supabase
      .from("workspaces")
      .update(patch)
      .eq("id", profile.workspace_id)
      .select("id"),
  );
  return NextResponse.json({ ok: true });
} catch (err) {
  const { status, body } = dbWriteErrorResponse(err);
  return NextResponse.json(body, { status });
}
```

**Why:** prevents the May 8 silent-failure class. `dbUpdate` throws if 0 rows affected — usually RLS blocked the write.

### When RLS blocks a write that SHOULD succeed (e.g. couple updating their own workspace)

Use service-role bypass. Pattern from `/api/workspace/preferences/route.ts`:

```ts
import { createClient as createServiceClient } from "@supabase/supabase-js";

function buildServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Verify ownership BEFORE using service-role to bypass RLS
const { data: ownerCheck } = await service
  .from("users")
  .select("workspace_id")
  .eq("id", user.id)
  .maybeSingle();
if (!ownerCheck?.workspace_id || ownerCheck.workspace_id !== profile.workspace_id) {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// NOW it's safe to use service-role
await dbUpdate("update workspace", service.from("workspaces").update(patch).eq("id", ws_id).select("id"));
```

### When the column is missing from generated types

Until T1.2 phase 2 lands, use the defensive cast pattern:

```ts
const sb = supabase as unknown as {
  from: (t: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { skin?: string | null } | null }>;
      };
    };
  };
};
try {
  const { data } = await sb.from("workspaces").select("skin").eq("id", wsId).maybeSingle();
  // ... use data.skin
} catch {
  // pre-migration tolerant — fall back to default
}
```

Wrap in try/catch so missing columns don't crash the page. Default to a sensible value.

### When applying a new migration

```bash
# Add SQL file to supabase/migrations/YYYYMMDDhhmmss_descriptive_name.sql
# After T1.1 part 2 activation, deploy will auto-apply on push.
# Until then, paste into Supabase dashboard SQL editor manually.

# Locally regenerate types after Supabase CLI is set up:
pnpm gen:types
git add packages/db/src/types.gen.ts
```

---

## 4. Tactical gotchas

### Working dir branches drift

Sometimes after worker agents finish, the main checkout is on a feature branch (not main). Always check:

```bash
git branch --show-current
# If not main:
git checkout main
git merge --ff-only <other-branch>  # if compatible
git push
```

### Stale `.git/refs/stash` files

If `git stash list` or `git log --all` errors with "bad object refs/stash 2", remove the file:

```bash
rm -f ".git/refs/stash 2"
```

### Worker agents and worktree state

When dispatching parallel agents with `isolation: "worktree"`:
- Each agent gets its own branch named `worktree-agent-<id>`
- Working dir may show their uncommitted state visible (shared `.git/`)
- DO NOT commit those files in the main checkout — they're the agent's work-in-progress
- Once agent finishes, either merge its branch in OR copy specific files

### Railway deploy without env var

If you commit `railway.json` with `preDeployCommand` referencing an env var that isn't set in Railway, the deploy aborts. **Always use `.staged` suffix pattern for config that requires manual env-var setup first:**

```
railway.json.staged   ← committed but not picked up by Railway
railway.json          ← picked up; only rename when env is ready
```

`.gitignore` should include `railway.json.staged` so it's never picked up accidentally.

### Smoke tests in CI

When wiring CI, remember Railway hobby plan has cold-start latency. The Playwright config already has generous timeouts (30s test, 15s action). If CI is faster than hobby plan, the timeouts are still safe.

### Generated Supabase types lag the DB

`packages/db/src/types.gen.ts` is hand-edited in places (e.g. `event_role` enum). Don't assume types match prod. The cast pattern exists because of this drift. T1.2 phase 2 will regen the file properly via `pnpm gen:types` once Supabase CLI is authed.

### Production DB connection

- The `SUPABASE_DB_URL` is NOT in `.env.local`
- Local scripts that need DB access use `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` via the JS client
- For raw SQL (migrations, backfills), the DB URL must be provided via env at script invocation:
  ```bash
  SUPABASE_DB_URL='postgres://...' pnpm tsx supabase/seed/_migrate.ts
  ```

---

## 5. Talking to Hursh — communication patterns

Things Hursh values:
- **Honesty over confidence theater** — say what's broken, what's pending, what's risky
- **Specific files + line numbers + commit hashes** — not abstract descriptions
- **Push back when he's about to do something opportunistic** — e.g. "scrape Zola" was the right pushback
- **Brief acknowledgments** — don't restate his point at length

Things to avoid:
- "Continuing" or "moving forward" or "I'll get back to this" — these read as autonomous-running language but Claude only runs per-turn. Just do the work in the current turn or say "doing X next turn when you say go."
- Long preambles when he says "BUILD" or "go" — match the energy, get to the work
- Reverting work without explicit permission — even if it seems necessary
- Pretending you remember things between sessions — read the docs, then act

Specific lessons:
- He's running 6 businesses. Don't assume he has 8 focused hours/day.
- He's a competent engineer who can read code. Don't over-explain implementation.
- He's tired by hour 12 of a session. Match his cadence — at hour 12 his pattern is to want fewer choices, faster decisions, more "ship vs not."
- When he gets frustrated ("this is all shit"), it's usually true that something is broken AND it's usually a smaller problem than he thinks. Diagnose first.

---

## 6. Strategic posture for next session

If next session starts cold and Hursh hasn't said what to work on:

**Default offer:**
> "I've read SESSION_HANDOFF_2026-05-11.md. We're at the post-stabilization fork — Tier 1 foundation is shipped. Before I do anything: do you want to (a) activate T1.1 part 2 (add SUPABASE_DB_URL to Railway env + run backfill + flip railway.json.staged), (b) send Rachel her brief (docs/rachel_onboarding_brief.md is ready), (c) start B2B planner portal Phase 1 (charge Astia — needs Stripe key in Railway env), or (d) something else? I will not improvise new features without your direction."

**Don't:**
- Immediately start writing code
- Pick a sprint item without asking
- Pitch Brigette
- Add new features outside `docs/PRODUCT_ROADMAP.md`

---

## 7. Test accounts cheatsheet

All passwords: `Wedding2027!`. Sign-in: https://wedding-os-production.up.railway.app/login

```
B2C self-serve:        rodnj.ops@gmail.com, kcdevine96@gmail.com, j.salicandro@gmail.com, raachmc@aol.com
B2B planner-served:    hurshpatel95@gmail.com, nishadesai98@gmail.com  (workspace inside Astia org)
Planner admins:        hurshpatel@greenskynj.com, astha@astiaevents.com
```

---

## 8. The 12 May 8 regressions — preserved for the lesson

Documented in `STATE-OF-THE-BUILD.md` §11. The pattern recognition that came from them:

1. Silent successes are worse than visible failures
2. Typecheck ≠ tested
3. RLS blocks writes silently
4. Worker agents need scope guards
5. Migrations don't apply themselves
6. Layouts that serve multiple user types need fork points
7. Hardcoded user-specific details leak across users

T1.1-T1.5 each map to one of these patterns. The sprint isn't theoretical.

---

## 9. When you're unsure

**Default behavior: ask, don't assume.**

Specifically:
- New feature request mid-stabilization → ask about T1.1 part 2 activation status first
- Migration to apply → check `pnpm migrate:status` (after T1.1 part 2) OR ask Hursh
- "Where does X live?" → grep first, then read the doc, then ask
- "Should this fork on mode?" → check `T1.5_design.md` table of forked pages, then ask
- Touching `(admin)/` files → confirm it's planner work, not couple work

---

## End of patterns doc
