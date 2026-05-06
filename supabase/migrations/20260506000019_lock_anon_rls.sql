-- SECURITY HARDENING — Sprint A
--
-- The Wave 0015 public-site migration left anon SELECT and UPDATE on the
-- guests table as `using (true)` with the comment "the API layer is the
-- actual gate." That was wrong: the anon key is in every browser bundle,
-- so any visitor could hit Supabase REST directly with
--   /rest/v1/guests?select=* | PATCH /rest/v1/guests?id=eq.<id>
-- and either scrape every published wedding's full guest list (PII —
-- names, dietary, allergies, notes) or rewrite their RSVP rows.
--
-- Fix: drop both anon policies. Re-route /rsvp/<token> traffic through
-- a server-side handler that uses the service-role key (which the API
-- already has access to via SUPABASE_SERVICE_ROLE_KEY) and enforces the
-- token match in code.
--
-- The other public-read policies (workspaces_public_read,
-- venues_public_read, venue_photos_public_read) are SELECT-only on
-- non-PII data and stay — they're only readable when a public_slug is
-- set on the workspace.

drop policy if exists guests_rsvp_token_read on guests;
drop policy if exists guests_rsvp_token_update on guests;

-- Belt + suspenders: ensure anon has no rights at the table grant level.
revoke all on guests from anon;
