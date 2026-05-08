-- Extend event_role enum so onboarding can capture every standalone event
-- a couple might have (especially US weddings). Without these, the
-- onboarding chat had to lossily map "rehearsal dinner" → welcome and
-- couples lost track of separately-booked venues.

alter type event_role add value if not exists 'rehearsal';
alter type event_role add value if not exists 'after_party';
alter type event_role add value if not exists 'brunch';
