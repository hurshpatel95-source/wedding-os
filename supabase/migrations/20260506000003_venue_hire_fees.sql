-- Move venue hire fees out of the TS constants file and onto the venue row
-- so admins can edit them in-app and all scenarios re-cost automatically.

alter table venues
  add column hire_fee_weekend_eur numeric(12, 2),
  add column hire_fee_weekday_eur numeric(12, 2),
  add column hire_fee_sunday_eur numeric(12, 2),
  add column minimum_pax_weekend integer,
  add column minimum_pax_sunday integer,
  add column minimum_pax_weekday integer,
  add column shortfall_per_pax_eur numeric(12, 2),
  add column extra_hour_eur numeric(12, 2),
  -- Composite-priced venues like Mas de Sant Llei: array of { label, price_eur }
  -- Sum of all entries forms the "whole venue" hire when no scenario-level
  -- spaces override is supplied.
  add column spaces jsonb not null default '[]'::jsonb,
  add column hire_fee_notes text;

create index venues_minimum_pax_idx on venues(workspace_id) where minimum_pax_weekend is not null;
