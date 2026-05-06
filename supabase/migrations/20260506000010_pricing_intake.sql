-- AI Pricing Intake — drop a planner WhatsApp screenshot / PDF / pasted text;
-- Claude extracts proposed price changes; admin reviews + applies.
-- Per Sprint 3 design doc at docs/sprint-3-design.md.

create type intake_source_kind as enum ('image', 'pdf', 'text', 'whatsapp_export');
create type intake_status as enum (
  'uploaded', 'extracting', 'extracted', 'partial', 'failed', 'applied', 'archived'
);
create type intake_proposal_kind as enum ('default_price', 'override', 'new_line_item');
create type proposal_decision as enum ('pending', 'accepted', 'edited', 'rejected', 'needs_info');
create type change_actor_kind as enum ('user', 'ai_intake', 'excel_import', 'seed', 'manual_admin');
create type change_target as enum (
  'default_price', 'override_price', 'override_included', 'override_notes', 'new_line_item'
);

-- One row per upload / paste — the audit anchor.
create table pricing_intake_sources (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  template_id uuid not null references pricing_templates(id) on delete cascade,
  venue_id uuid references venues(id) on delete set null,
  uploaded_by uuid not null references users(id) on delete restrict,

  kind intake_source_kind not null,
  status intake_status not null default 'uploaded',
  storage_path text,
  mime_type text,
  byte_size integer,
  raw_text text,
  source_label text,
  source_dated_at date,

  model text,
  claude_response jsonb,
  prompt_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 4),
  error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pricing_intake_sources_workspace_idx
  on pricing_intake_sources(workspace_id, status, created_at desc);

create trigger pricing_intake_sources_updated_at before update on pricing_intake_sources
  for each row execute function set_updated_at();

-- One row per Claude-extracted candidate change.
create table pricing_intake_proposals (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references pricing_intake_sources(id) on delete cascade,
  kind intake_proposal_kind not null,

  matched_line_item_id uuid references pricing_line_items(id) on delete set null,
  proposed_category text,
  proposed_label text,
  proposed_description text,
  proposed_unit pricing_unit,
  proposed_tier pricing_tier,
  proposed_unit_price numeric(12, 2),
  proposed_currency text,
  proposed_included boolean,
  proposed_notes text,

  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  rationale text,
  evidence jsonb,
  needs_info text,

  decision proposal_decision not null default 'pending',
  decided_by uuid references users(id) on delete set null,
  decided_at timestamptz,
  applied_change_log_id uuid,

  created_at timestamptz not null default now()
);
create index pricing_intake_proposals_source_idx
  on pricing_intake_proposals(source_id, decision);

-- Audit log for every default-price or override mutation, with source ref.
create table pricing_change_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  template_id uuid not null references pricing_templates(id) on delete cascade,
  line_item_id uuid references pricing_line_items(id) on delete set null,
  venue_id uuid references venues(id) on delete cascade,

  target change_target not null,
  old_value jsonb,
  new_value jsonb,

  actor_kind change_actor_kind not null,
  actor_user_id uuid references users(id) on delete set null,
  source_id uuid references pricing_intake_sources(id) on delete set null,
  proposal_id uuid references pricing_intake_proposals(id) on delete set null,
  evidence jsonb,
  note text,

  created_at timestamptz not null default now()
);
create index pricing_change_log_line_item_idx
  on pricing_change_log(line_item_id, created_at desc);
create index pricing_change_log_venue_idx
  on pricing_change_log(venue_id, line_item_id, created_at desc);

alter table pricing_intake_proposals
  add constraint pricing_intake_proposals_change_log_fk
  foreign key (applied_change_log_id) references pricing_change_log(id) on delete set null;

-- RLS — admin only (planner-internal)
alter table pricing_intake_sources enable row level security;
alter table pricing_intake_proposals enable row level security;
alter table pricing_change_log enable row level security;

create policy intake_sources_admin on pricing_intake_sources for all
  using (org_id = auth_org_id() and auth_is_admin())
  with check (org_id = auth_org_id() and auth_is_admin());

create policy intake_proposals_admin on pricing_intake_proposals for all
  using (exists (
    select 1 from pricing_intake_sources s
    where s.id = source_id and s.org_id = auth_org_id()
  ) and auth_is_admin())
  with check (exists (
    select 1 from pricing_intake_sources s
    where s.id = source_id and s.org_id = auth_org_id()
  ) and auth_is_admin());

-- Couples can READ change_log so the calculator-line popover can show
-- "where this number came from" — admin writes only.
create policy change_log_read on pricing_change_log for select
  using (org_id = auth_org_id());
create policy change_log_admin_write on pricing_change_log for all
  using (org_id = auth_org_id() and auth_is_admin())
  with check (org_id = auth_org_id() and auth_is_admin());

-- Storage bucket for uploaded planner artifacts
insert into storage.buckets (id, name, public) values ('pricing-intake', 'pricing-intake', false)
  on conflict (id) do nothing;

create policy "pricing-intake admin read"
  on storage.objects for select
  using (bucket_id = 'pricing-intake' and auth_is_admin());

create policy "pricing-intake admin insert"
  on storage.objects for insert
  with check (bucket_id = 'pricing-intake' and auth_is_admin());

create policy "pricing-intake admin delete"
  on storage.objects for delete
  using (bucket_id = 'pricing-intake' and auth_is_admin());
