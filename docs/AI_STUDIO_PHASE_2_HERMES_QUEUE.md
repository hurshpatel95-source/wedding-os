# AI Studio Phase 2 — Hermes-style generation queue (DEFERRED)

**Date:** 2026-05-13
**Status:** DEFERRED — design captured. Build later, after Phase 1 direct-API tools are live + we hit the first long-running tool (dress-on-me / venue mockup / hair-makeup).
**Why this doc exists:** Hursh flagged the agent-in-the-loop architecture during the Studio Day 1+2 build and wants it remembered. This doc is the breadcrumb so future Claude sessions don't reinvent the conversation.

---

## The trigger to build this

We will need this infrastructure as soon as the FIRST long-running tool comes online. The shortlist:
- **Dress-on-me** — needs Higgsfield character training (3-10 min) + per-look generation (60-120s each)
- **Venue mockup** — img-to-img with style preservation (60-90s)
- **Hair/makeup try-on** — character + style transfer (90-120s)

When any of these is the next-up tool to build, the user can't sit at a "Generating..." spinner. We need to enqueue, run async, notify.

The fast direct-API tools (mood board, photo→pricing, florals, cake, color palette, save-the-date, day-of viz) should stay on the direct-API path forever — speed + cost + simplicity wins for those.

---

## Architecture (when we build it)

```
┌─────────────────┐
│   User clicks   │
│   "Generate"    │
│   on /studio    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  /api/studio/[tool]/    │
│  generate route handler │   (Phase 1 today: synchronous)
│  - If tool.async=true:  │
│    enqueue + return     │
│    {ticket_id, eta_s}   │
│  - Else: sync direct    │
└────────┬────────────────┘
         │ enqueue
         ▼
┌─────────────────────────┐
│  generation_tickets     │   ← new table (Phase 2 migration)
│  (status, tool, input,  │
│   answers, optimized_   │
│   prompt, result_urls,  │
│   created_at, etc.)     │
└────────┬────────────────┘
         │ poll/notify
         ▼
┌─────────────────────────┐
│  Hermes worker process  │   ← separate Railway service OR cron
│  (Node, using Claude    │
│   Agent SDK + Higgsfield│
│   MCP attached)         │
│  - Claim ticket         │
│  - Run multi-step agent │
│  - Store results        │
│  - Update ticket status │
│  - Fire notification    │
└────────┬────────────────┘
         │ in-app + push
         ▼
┌─────────────────────────┐
│  User sees notification │
│  "Your venue mockups    │
│  are ready"             │
│  → /studio/history      │
└─────────────────────────┘
```

---

## Schema for `generation_tickets`

```sql
create table generation_tickets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  tool_slug text not null,                      -- "dress-on-me" / "venue-mockup" / etc.
  status text not null default 'queued',        -- queued | running | succeeded | failed | cancelled
  priority integer not null default 0,          -- higher = sooner

  -- Input
  user_input text,
  answers jsonb,
  uploaded_image_path text,                     -- supabase storage key
  variant_count integer default 4,

  -- Pipeline outputs
  optimized_prompt text,                        -- written by the agent during run
  result_urls jsonb,                            -- array of image URLs
  cost_usd numeric,
  credits_spent integer,

  -- Lifecycle
  claimed_at timestamptz,                       -- when worker picked it up
  claimed_by text,                              -- worker instance id
  completed_at timestamptz,
  error text,                                   -- non-null when status=failed
  retry_count integer default 0,
  max_retries integer default 2,

  -- Notification
  notified_at timestamptz,
  notify_via text[] default '{"in_app"}',       -- in_app | email | push

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generation_tickets_workspace_idx
  on generation_tickets(workspace_id, created_at desc);
create index generation_tickets_queue_idx
  on generation_tickets(status, priority desc, created_at asc)
  where status in ('queued', 'running');
```

RLS: workspace members can read their own tickets; only service-role workers can write status transitions.

---

## Worker process options

Pick one when we build:

### Option A — Railway worker service
- New Railway service alongside the main Next.js app
- Long-running Node process with the Agent SDK
- Polls `generation_tickets where status='queued'` every 5s
- Or subscribes to Supabase Realtime channel for instant pickup
- Pros: simple, runs forever, cheap
- Cons: needs its own deploy pipeline + monitoring

### Option B — Cloudflare worker / Vercel function on a cron
- Cron fires every minute → claims one ticket → runs it → writes back
- Pros: serverless, no persistent process
- Cons: max execution time per cron tick (~5-15 min)

### Option C — Supabase Edge Functions
- pg_cron triggers worker → Edge Function executes
- Pros: stays inside Supabase
- Cons: Agent SDK + Higgsfield setup in Deno is fiddly

**Recommended: Option A.** Simplest, most controllable. ~half-day to set up.

---

## Agent SDK pattern inside the worker

```ts
// worker/process-ticket.ts
import { query } from "@anthropic-ai/claude-agent-sdk";

async function processTicket(ticket: GenerationTicket) {
  await markRunning(ticket.id);

  try {
    const result = await query({
      prompt: buildWorkerPrompt(ticket),
      options: {
        model: "claude-sonnet-4-6",
        allowedTools: ["mcp__higgsfield__generate_image", "mcp__higgsfield__characters"],
        mcpServers: {
          higgsfield: {
            command: "npx",
            args: ["@higgsfield/mcp"],
            env: { HIGGSFIELD_API_KEY: process.env.HIGGSFIELD_API_KEY! },
          },
        },
        permissionMode: "acceptEdits", // auto-accept image-gen tool calls
      },
    });

    const resultUrls = extractImageUrls(result);
    await markSucceeded(ticket.id, resultUrls);
    await notifyUser(ticket, resultUrls);
  } catch (err) {
    await markFailed(ticket.id, err);
    if (ticket.retry_count < ticket.max_retries) {
      await requeue(ticket.id);
    }
  }
}
```

The worker prompt instructs the agent:
- "You are processing a generation ticket. Tool: <slug>. User input + clarification answers are below."
- "Run the tool's standard workflow: (1) if dress-on-me and no character_id stored for this workspace, train one first via Higgsfield characters. (2) Call generate_image with the right params. (3) If a variant looks malformed, regenerate it once. (4) Return the final URLs."

---

## Notification path

When ticket completes:
1. **In-app:** insert a row into `alerts` with `kind='studio_generation_ready'` + `metadata.ticket_id` — couple sees a notification dot on the bell, can click through to `/studio/<tool>?ticket=<id>` to see results
2. **Email** (optional): Resend transactional email with thumbnails
3. **Push** (future, optional): web push for installed PWA

---

## Migration to add when this is built

`supabase/migrations/<future-slot>_generation_tickets.sql` — the schema above + RLS + indexes.

Queue for whatever T1.1-equivalent activation is in place at the time.

---

## What changes in the existing Studio code

- Add `async: boolean` flag to `StudioTool` registry entry. True for dress-on-me, venue-mockup, hair-makeup. False for everything else.
- `/api/studio/[tool]/generate/route.ts` branches: if `tool.async`, enqueue + return ticket_id immediately; else run sync path (today's flow).
- New `/api/studio/tickets/[id]/route.ts` GET endpoint — polls ticket status from the client side. (Better: Supabase Realtime subscription on the studio page so it auto-updates without polling.)
- Studio tool pages show different UX states for async tools: "Generating in background, we'll notify you when ready. ETA 2 min."
- `/studio/history` becomes a real surface — ticket-grouped gallery.

---

## When to build this

The trigger is: **about to build the first long-running tool** (dress-on-me, venue-mockup, or hair-makeup). At that point:

1. Spend ~1 day on this infrastructure
2. Then the long-running tool itself becomes a thin layer on top of it
3. Subsequent long-running tools (the other 2 of 3) are cheap to add

Don't build this earlier — it's premature infra for the fast tools.

---

## End — see also

- `docs/STRATEGIC_PIVOT_2026-05-12.md` — the master operating plan
- `docs/AI_STUDIO_2026-05-13.md` — the Studio spec (Phase 1, direct-API)
- `project_geo_healthcare.md` in user memory — references Higgsfield via MCP in a different context (GEO project), useful reference for MCP integration patterns
