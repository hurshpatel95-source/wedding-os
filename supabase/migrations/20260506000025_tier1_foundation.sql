-- ─── Tier 1 foundation — schema for 9 parallel feature streams ───────
--
-- One big migration that lays down every table the Tier-1 features need.
-- We bundle them so the parallel feature-build agents don't fight over
-- migration numbering. Each agent owns its own table cluster.
--
-- Tables added:
--   email_messages          (Comms hub — Resend send log, threads)
--   contracts               (Click-to-sign contracts)
--   proposals               (Branded proposal docs)
--   guest_messages          (Mass guest comms log)
--   stripe_customers        (couple ↔ stripe linkage per workspace)
--   payment_links           (per-invoice payment links + status)
--   subscriptions           (planner SaaS billing — future, schema only)
--
-- Columns added:
--   workspaces.public_theme_slug  — which /w/<slug> theme to render
--   guests.is_plus_one            — set by host or by primary guest self-serve
--   guests.plus_one_of_guest_id   — links a +1 to its primary guest
--   guests.plus_one_max           — primary guest can add up to N +1s

-- ─── 1. EMAIL MESSAGES (Comms hub) ───────────────────────────────────

create table email_messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  -- Direction + type
  direction text not null check (direction in ('outbound', 'inbound')),
  kind text,                                 -- 'vendor_rfp', 'guest_save_the_date', 'lead_followup', 'contract_sent', etc.
  -- Threading
  thread_key text,                           -- shared key across messages in a thread (provider-supplied or hash of subject+to)
  in_reply_to_message_id uuid references email_messages(id) on delete set null,
  provider text default 'resend',            -- 'resend', 'manual', 'gmail-pasted'
  provider_message_id text,                  -- Resend message id for tracking
  -- Body
  to_email text not null,
  to_name text,
  from_email text,
  from_name text,
  cc text[],
  bcc text[],
  subject text not null,
  body_text text,
  body_html text,
  -- Linkage to other rows so we can render threads on lead/vendor/guest pages
  related_lead_id uuid references leads(id) on delete set null,
  related_vendor_id uuid references vendors(id) on delete set null,
  related_guest_id uuid references guests(id) on delete set null,
  related_contract_id uuid,                  -- FK added below after contracts table
  -- Lifecycle
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'received')),
  status_detail text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  -- Authoring
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_messages_org_idx on email_messages(org_id, created_at desc);
create index email_messages_workspace_idx on email_messages(workspace_id, created_at desc);
create index email_messages_lead_idx on email_messages(related_lead_id) where related_lead_id is not null;
create index email_messages_vendor_idx on email_messages(related_vendor_id) where related_vendor_id is not null;
create index email_messages_guest_idx on email_messages(related_guest_id) where related_guest_id is not null;
create index email_messages_thread_idx on email_messages(thread_key) where thread_key is not null;

create trigger email_messages_updated_at before update on email_messages
  for each row execute function set_updated_at();

alter table email_messages enable row level security;

-- Org_admins manage all email rows in their org
create policy email_messages_org_admin on email_messages for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Workspace members can READ emails tied to their workspace (couple-side
-- view of guest messages, vendor exchanges, etc. — read-only for couples)
create policy email_messages_member_read on email_messages for select
  using (workspace_id is not null and workspace_id = auth_workspace_id());

-- ─── 2. CONTRACTS (e-sign) ──────────────────────────────────────────

create type contract_status as enum (
  'draft', 'sent', 'viewed', 'signed', 'declined', 'voided'
);

create table contracts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- Either a converted client workspace OR a pre-conversion lead
  workspace_id uuid references workspaces(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  title text not null,
  body_md text not null,                     -- Markdown contract body
  terms_summary text,                        -- One-liner shown next to title
  total_eur numeric(12, 2),
  retainer_eur numeric(12, 2),
  retainer_due_date date,
  status contract_status not null default 'draft',
  -- Public access via unguessable token
  public_token uuid not null default uuid_generate_v4(),
  -- Client signing fields
  signer_name text,                          -- pre-filled with couple_names
  signer_email text,
  signed_full_name text,                     -- typed signature
  signed_at timestamptz,
  signed_ip text,
  signed_user_agent text,
  declined_at timestamptz,
  declined_reason text,
  voided_at timestamptz,
  -- Audit
  sent_at timestamptz,
  viewed_at timestamptz,
  pdf_storage_path text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index contracts_public_token_idx on contracts(public_token);
create index contracts_org_status_idx on contracts(org_id, status, created_at desc);
create index contracts_workspace_idx on contracts(workspace_id) where workspace_id is not null;

create trigger contracts_updated_at before update on contracts
  for each row execute function set_updated_at();

-- Now wire the email_messages → contracts FK
alter table email_messages
  add constraint email_messages_related_contract_id_fkey
  foreign key (related_contract_id) references contracts(id) on delete set null;

alter table contracts enable row level security;

-- Org_admins manage all contracts in their org
create policy contracts_org_admin on contracts for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Workspace members READ contracts tied to their workspace (couples can
-- see what they signed)
create policy contracts_member_read on contracts for select
  using (workspace_id is not null and workspace_id = auth_workspace_id());

-- Anon read by token — RLS lets the row through; the API layer (using
-- service-role) actually enforces the token match in WHERE.
create policy contracts_anon_token_read on contracts for select
  to anon
  using (true);

-- ─── 3. PROPOSALS ────────────────────────────────────────────────────

create type proposal_status as enum (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
);

create table proposals (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  title text not null,
  intro_md text,                             -- "Dear couple, here's what we propose…"
  -- sections is a jsonb array: [{ title, body_md, items: [{label, qty, unit_price_eur, total_eur, optional}] }]
  sections jsonb not null default '[]'::jsonb,
  total_eur numeric(12, 2),
  status proposal_status not null default 'draft',
  public_token uuid not null default uuid_generate_v4(),
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index proposals_public_token_idx on proposals(public_token);
create index proposals_org_status_idx on proposals(org_id, status, created_at desc);

create trigger proposals_updated_at before update on proposals
  for each row execute function set_updated_at();

alter table proposals enable row level security;

create policy proposals_org_admin on proposals for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

create policy proposals_member_read on proposals for select
  using (workspace_id is not null and workspace_id = auth_workspace_id());

create policy proposals_anon_token_read on proposals for select
  to anon
  using (true);

-- ─── 4. GUEST MESSAGES (mass-comms log) ──────────────────────────────

create table guest_messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  -- "save_the_date", "rsvp_nudge", "hotel_reminder", "thank_you"
  kind text not null,
  subject text,
  body text not null,
  -- segment_filter is a jsonb of filter criteria the user picked:
  -- { rsvp: ['pending'], side: 'both', tags: [...] }
  segment_filter jsonb default '{}'::jsonb,
  recipient_count integer not null default 0,
  delivered_count integer not null default 0,
  bounced_count integer not null default 0,
  -- One row per guest_message; the actual emails are in email_messages
  -- with related_guest_id set, joined by created_at proximity. We keep
  -- this row as the "campaign" record.
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guest_messages_workspace_idx
  on guest_messages(workspace_id, created_at desc);

create trigger guest_messages_updated_at before update on guest_messages
  for each row execute function set_updated_at();

alter table guest_messages enable row level security;

-- Workspace members manage their own guest messaging
create policy guest_messages_member_all on guest_messages for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- ─── 5. STRIPE BILLING (couple-side payment links) ───────────────────

-- Stripe customer per workspace (couples). Created lazily when first
-- payment link is generated. Stripe customer email = workspace primary
-- couple email; metadata.workspace_id pinned so webhook can route.
create table stripe_customers (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

alter table stripe_customers enable row level security;
create policy stripe_customers_org_admin on stripe_customers for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');
create policy stripe_customers_member_read on stripe_customers for select
  using (workspace_id = auth_workspace_id());

-- One row per planner_invoice that's been "send for online payment"d.
-- Webhook updates status + paid_at when the payment succeeds.
create table payment_links (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  planner_invoice_id uuid not null references planner_invoices(id) on delete cascade,
  stripe_payment_link_id text not null unique,
  stripe_payment_link_url text not null,
  amount_eur numeric(12, 2) not null,
  status text not null default 'open'
    check (status in ('open', 'paid', 'void', 'expired', 'failed')),
  paid_at timestamptz,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  receipt_url text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_links_invoice_idx on payment_links(planner_invoice_id);
create index payment_links_org_idx on payment_links(org_id, created_at desc);

create trigger payment_links_updated_at before update on payment_links
  for each row execute function set_updated_at();

alter table payment_links enable row level security;

create policy payment_links_org_admin on payment_links for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- Workspace members READ payment links for their invoices (couple sees
-- "Pay now" on /payments)
create policy payment_links_member_read on payment_links for select
  using (
    planner_invoice_id in (
      select id from planner_invoices where workspace_id = auth_workspace_id()
    )
  );

-- ─── 6. SUBSCRIPTIONS (planner-side SaaS billing — schema only) ───────

create table subscriptions (
  org_id uuid primary key references organizations(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  plan text not null default 'free'
    check (plan in ('free', 'studio', 'atelier')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'cancelled', 'paused')),
  trial_end timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();

alter table subscriptions enable row level security;
create policy subscriptions_org_read on subscriptions for select
  using (org_id = auth_org_id());
create policy subscriptions_org_admin_write on subscriptions for all
  using (org_id = auth_org_id() and auth_org_role() = 'org_admin')
  with check (org_id = auth_org_id() and auth_org_role() = 'org_admin');

-- ─── 7. WORKSPACE THEME (couple wedding site) ────────────────────────

alter table workspaces
  add column public_theme_slug text not null default 'classic';

-- ─── 8. GUEST PLUS-ONE SUPPORT ───────────────────────────────────────

alter table guests
  add column is_plus_one boolean not null default false,
  add column plus_one_of_guest_id uuid references guests(id) on delete set null,
  add column plus_one_max integer not null default 0;

create index guests_plus_one_idx on guests(plus_one_of_guest_id)
  where plus_one_of_guest_id is not null;
