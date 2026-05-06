-- Sprint 4 polish: Decision log per venue, Q&A threads, Pros/Cons.

-- Pros/cons live on the venue row — quick array, no separate table.
alter table venues
  add column pros text[] not null default '{}'::text[],
  add column cons text[] not null default '{}'::text[];

-- Decision log — every time someone changes status or commits to a venue we
-- write a row. Forms an auditable history beyond the bare current status.
create type venue_decision_kind as enum (
  'shortlisted', 'visited', 'quoted', 'decided', 'passed', 'note'
);

create table venue_decisions (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  kind venue_decision_kind not null,
  body text not null,                 -- "Going with this for Sangeet — Astha confirmed Sept 11."
  decided_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index venue_decisions_venue_idx on venue_decisions(venue_id, created_at desc);

-- Q&A — couple asks, planner (or anyone) answers. Status flips on first answer.
create type venue_question_status as enum ('open', 'answered', 'wont_answer');

create table venue_questions (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  asked_by uuid references users(id) on delete set null,
  body text not null,
  answer text,
  answered_by uuid references users(id) on delete set null,
  answered_at timestamptz,
  status venue_question_status not null default 'open',
  created_at timestamptz not null default now()
);

create index venue_questions_venue_idx on venue_questions(venue_id, status, created_at desc);

-- RLS — match existing venue-scoped policies
alter table venue_decisions enable row level security;
alter table venue_questions enable row level security;

create policy venue_decisions_read on venue_decisions for select
  using (exists (
    select 1 from venues v where v.id = venue_decisions.venue_id and v.workspace_id = auth_workspace_id()
  ));
create policy venue_decisions_write on venue_decisions for all
  using (exists (
    select 1 from venues v where v.id = venue_decisions.venue_id and v.workspace_id = auth_workspace_id()
  ))
  with check (exists (
    select 1 from venues v where v.id = venue_decisions.venue_id and v.workspace_id = auth_workspace_id()
  ));

create policy venue_questions_read on venue_questions for select
  using (exists (
    select 1 from venues v where v.id = venue_questions.venue_id and v.workspace_id = auth_workspace_id()
  ));
create policy venue_questions_write on venue_questions for all
  using (exists (
    select 1 from venues v where v.id = venue_questions.venue_id and v.workspace_id = auth_workspace_id()
  ))
  with check (exists (
    select 1 from venues v where v.id = venue_questions.venue_id and v.workspace_id = auth_workspace_id()
  ));
