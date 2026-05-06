-- Each venue can host one or more events. Sprint 2.5 — multi-event readiness
-- ahead of the first-class events table proposed in lucia-strategic-memo.md.

create type event_role as enum (
  'mehndi',     -- pre-wedding henna ceremony
  'sangeet',    -- pre-wedding music + dance night
  'welcome',    -- welcome / cocktail / pre-wedding party (non-Indian framing)
  'haldi',      -- pre-wedding turmeric ceremony
  'ceremony',   -- the wedding ceremony itself
  'reception',  -- post-ceremony dinner + dancing
  'wedding',    -- combined ceremony + reception (when held at one venue)
  'stay'        -- accommodation only, not an event-hosting venue
);

alter table venues
  add column event_roles event_role[] not null default '{}'::event_role[];

create index venues_event_roles_idx on venues using gin (event_roles);
