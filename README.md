# wedding-os

Couple-side venue intelligence portal for the Barcelona Sept 2027 wedding. Two users (Hursh + Nisha) compare venues, view photos by visit, take notes, run an interactive pricing calculator, and save scenarios. One admin (the planner) maintains venues, uploads photos, and configures pricing.

Architected multi-tenant from day one (`org_id` + `workspace_id` on every workspace-scoped table) so we can lift to a multi-planner SaaS later without a rewrite.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + Storage + RLS)
- React Query for server state, Zustand for pricing inputs
- SheetJS (`xlsx`) for Excel import/export
- pnpm workspaces, Node 20+
- Hosting: Railway

## Layout

```
wedding-os/
├── apps/web/              Next.js app
├── packages/db/           Supabase generated types + client helpers
├── packages/lib/          Pricing engine + shared logic
└── supabase/
    ├── migrations/        SQL migrations (init schema, RLS, storage)
    └── seed/seed.ts       Demo workspace + venues + pricing template
```

## Setup

```sh
# 1. Install deps
pnpm install

# 2. Copy env template and fill in Supabase keys
cp .env.example apps/web/.env.local

# 3. Start local Supabase (Docker required) OR point env at remote project
pnpm db:start

# 4. Apply migrations
pnpm db:reset

# 5. Generate types from current schema
pnpm db:types

# 6. Seed demo workspace + venues
pnpm db:seed

# 7. (optional) Push the local venue photos in ~/Downloads/<venue folder>/
pnpm db:ingest-photos

# 8. Run the app
pnpm dev
```

The photo ingest script reads from these folders in `~/Downloads/`:

- `casa del mar/` → Casa Del Mar
- `xalet del nin/` → Xalet Del Nin
- `Mas de sant:sant esteve/` → Mas de Sant Llei
- `yacht marina/` → Yacht Charter — Marina Port Vell

Both photos (`.jpg/.jpeg/.png/.heic/.webp`) and videos (`.mov/.mp4`) are uploaded — they share the `venue_photos` table; the URL extension drives `<img>` vs `<video>` rendering in the gallery (Sprint 2). Files larger than 195 MB are skipped; the storage bucket itself is capped at 200 MiB in `supabase/config.toml`. **Note:** the 200 MiB limit applies when running `pnpm db:start` against the local Supabase stack. For the hosted project, raise the bucket file-size limit in the Supabase dashboard under Storage → venue-photos → Configuration.

Then open http://localhost:3000 and request a magic link.

## Roles

- `admin` — the planner. Full CRUD on venues, photos, and pricing.
- `couple` — Hursh + Nisha. Read-everything, write notes/comments/scenarios/favorites.

## Deploy (Railway)

The web app is a standard Next.js 14 build. On Railway:

- Root directory: `apps/web`
- Build command: `pnpm install --frozen-lockfile && pnpm --filter @wedding-os/web build`
- Start command: `pnpm --filter @wedding-os/web start`
- Env vars: copy from `.env.example`, point `NEXT_PUBLIC_SITE_URL` to the Railway URL

Supabase project lives separately at supabase.com — Railway only hosts the web app.

## Constraints

- Excel is import/export only. Postgres is the runtime.
- RLS is on for every workspace-scoped table, even with one workspace today.
- No planner-side console, lead pipeline, contracts, or AI co-pilot in this repo.
- Magic link auth only. No passwords.
- Use `<button onClick={...}>`, not `<form onSubmit={...}>`, for primary submission flows.
