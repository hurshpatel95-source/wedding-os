-- Add Friday-specific hire rate. Up to now venues stored:
--   hire_fee_weekend_eur   (Saturday)
--   hire_fee_sunday_eur    (Sunday)
--   hire_fee_weekday_eur   (Mon-Fri lump)
-- Wedding venues frequently have a Friday rate that differs from Mon-Thu
-- ("near-weekend premium"). Astha's PDFs only quote Sat + Sun, so Friday
-- selections in the estimator builder fell back to the weekday rate which
-- silently mis-priced. Add an explicit `hire_fee_friday_eur` column.
-- Existing rows stay null; the estimator code falls back gracefully.

alter table venues
  add column hire_fee_friday_eur numeric(12, 2);
