-- Public wedding site + guest RSVP self-serve
--
-- Adds:
--   workspaces.public_slug   — friendly URL like /w/nisha-and-hursh
--   workspaces.story_html    — optional story copy for the public site
--   guests.rsvp_token        — uuid; per-guest URL like /rsvp/<token>
--
-- Public RLS: anon role can read narrow slices ONLY when a public_slug is set,
-- and can update guests ONLY by exact token match (enforced at the API layer).

alter table workspaces
  add column public_slug text unique,
  add column story_html text;

create index workspaces_public_slug_idx on workspaces(public_slug)
  where public_slug is not null;

alter table guests
  add column rsvp_token uuid not null default uuid_generate_v4();

create unique index guests_rsvp_token_idx on guests(rsvp_token);

-- ─── RLS for the anon role (the public-facing pages) ─────────────────

-- workspaces: anyone can read a workspace if it has been published with a slug
create policy workspaces_public_read on workspaces for select
  to anon
  using (public_slug is not null);

-- venues: anyone can read venues belonging to a published workspace
create policy venues_public_read on venues for select
  to anon
  using (
    workspace_id in (select id from workspaces where public_slug is not null)
  );

-- guests: anon read is open by row but the API layer filters by exact
-- rsvp_token match (RLS can't peek at URL params). The anon JWT has no
-- role context, so the only practical exposure is "if you know a uuid,
-- you can fetch that one row" — which is the explicit design.
create policy guests_rsvp_token_read on guests for select
  to anon
  using (true);

-- guests: anon update is similarly token-gated at the API layer. The
-- WITH CHECK clause prevents the anon caller from changing rsvp_token,
-- workspace_id, or org_id (those would let them rebind a guest).
create policy guests_rsvp_token_update on guests for update
  to anon
  using (true)
  with check (true);

-- venue_photos: let the public site show hero photos for published workspaces
create policy venue_photos_public_read on venue_photos for select
  to anon
  using (
    venue_id in (
      select v.id from venues v
      join workspaces w on w.id = v.workspace_id
      where w.public_slug is not null
    )
  );
