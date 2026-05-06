-- Library vendors MVP+ — capture the data that makes a planner library
-- actually competitive vs Aisle Planner / Honeybook.
--
-- Was: name, category, contact, default price, notes (basically an
-- address book).
-- Now: + website, instagram, planner_rating, default_contract_path
-- (file in library-media bucket), tags[], lead_time_days, price_band.

alter table library_vendors
  add column website text,
  add column instagram text,
  add column planner_rating integer check (planner_rating between 1 and 5),
  add column default_contract_path text,
  add column tags text[] not null default '{}'::text[],
  add column lead_time_days integer,
  add column price_band text check (
    price_band in ('budget', 'mid', 'premium', 'luxe', 'unset')
  );

create index library_vendors_tags_idx on library_vendors using gin (tags);
