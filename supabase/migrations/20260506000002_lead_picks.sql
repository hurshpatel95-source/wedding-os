-- Lead-pick flag so the dashboard surfaces Hursh's chosen 3 first.
-- Couple-only signal; admin toggles on the venue form.

alter table venues
  add column is_lead_pick boolean not null default false;

create index venues_lead_idx on venues(workspace_id, is_lead_pick) where is_lead_pick = true;
