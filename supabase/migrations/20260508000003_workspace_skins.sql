-- White-label "skin" system for couple-side workspaces.
--
-- Goal: every couple workspace renders with one of four brand presets.
-- The default is `acquired_planner` (the founder's new B2C consumer brand).
-- Planner-served couples (Astia Events is the pilot) get `co_branded` —
-- the planner's brand stays prominent but with a "Powered by Acquired
-- Planner" attribution. `white_label` (planner brand only) is a future
-- premium tier; `acquired_style_collab` is reserved for the upcoming
-- Brigette / Acquired Style co-brand.
--
-- IMPORTANT — manual application required.
-- The local repo does not carry a Supabase DB URL, so this migration
-- cannot be applied automatically. Paste the contents of this file into
-- the Supabase SQL editor (Settings → SQL editor) and run it once. The
-- file is safe to re-run: type creation is guarded, the column add uses
-- `if not exists`, and the seed update is idempotent (it only changes
-- rows whose name still matches `%astia%` and whose skin would change).

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'workspace_skin_kind'
  ) then
    create type workspace_skin_kind as enum (
      'acquired_planner',
      'co_branded',
      'white_label',
      'acquired_style_collab'
    );
  end if;
end$$;

alter table workspaces
  add column if not exists skin workspace_skin_kind not null
    default 'acquired_planner';

-- Astia Events specifically gets co_branded — she's the OG planner
-- customer and the pilot for the planner-side experience. Match by name
-- because organization linkage varies per env.
update workspaces
   set skin = 'co_branded'
 where lower(name) like '%astia%'
   and skin <> 'co_branded';
