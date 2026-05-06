-- Public-site sections: registry, travel, hotel block, dress code, FAQ,
-- schedule. Couples + planners need to actually shape what guests see at
-- /w/<slug> beyond the auto-rendered hero + venues + RSVP.
--
-- All stored on the workspaces row (couple-scoped), so an existing public
-- RLS policy already lets anon read them once a public_slug is set.
--
-- Markdown-style strings (rendered through ReactMarkdown — no raw HTML
-- since the XSS audit). The schedule is a JSONB array for flexibility.
-- FAQ also JSONB for {q, a} pairs.

alter table workspaces
  add column registry_url text,
  add column registry_label text,
  add column travel_md text,
  add column hotel_block_md text,
  add column dress_code_md text,
  add column faq jsonb default '[]'::jsonb,
  add column schedule jsonb default '[]'::jsonb,
  add column public_hero_storage_path text,
  add column public_published_at timestamptz;

-- The `public_published_at` flag is set the first time a couple toggles
-- the public site to "Published" — so we know how long the link has been
-- live, and so a planner can stage edits before going live.
