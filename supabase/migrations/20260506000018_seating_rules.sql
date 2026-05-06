-- Seating rules — per-guest "must sit with" + "can't sit with" lists.
-- Stored as uuid[] on the guest row for v1 simplicity (vs a separate
-- relation table). Rules are bidirectional in semantics but we store
-- them as the planner enters them; the seating board checks BOTH
-- directions when warning about conflicts.
--
-- Examples:
--   must_sit_with_guest_ids = parents of one side, lifelong friends
--   cant_sit_with_guest_ids = divorced parents who can't share a table,
--                              family feuds, exes invited from same friend group

alter table guests
  add column cant_sit_with_guest_ids uuid[] not null default '{}'::uuid[],
  add column must_sit_with_guest_ids uuid[] not null default '{}'::uuid[];

-- For lookup performance when checking "who has me on their list"
create index guests_cant_sit_with_idx on guests using gin (cant_sit_with_guest_ids);
create index guests_must_sit_with_idx on guests using gin (must_sit_with_guest_ids);
