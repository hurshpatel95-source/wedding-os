-- AI Co-pilot — workspace-aware chat using Claude Haiku 4.5 with prompt
-- caching + per-user daily caps. Couples + planner can ask anything; the
-- system prompt injects live workspace data so answers are grounded.

create table ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on ai_conversations(user_id, updated_at desc);

create trigger ai_conversations_updated_at before update on ai_conversations
  for each row execute function set_updated_at();

create table ai_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Claude metadata (assistant-only rows)
  model text,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cache_creation_tokens integer,
  cost_usd numeric(10, 5),
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on ai_messages(conversation_id, created_at);

-- Daily usage roll-up for rate limiting. Insert-or-increment per turn.
create table ai_usage_daily (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  message_count integer not null default 0,
  total_cost_usd numeric(10, 5) not null default 0,
  primary key (workspace_id, user_id, day)
);
create index ai_usage_daily_day_idx on ai_usage_daily(day);

-- RLS — users see their own conversations + everyone in the workspace's
-- aggregate usage (so admins can see whose chatting heavily). Writes
-- locked to the conversation owner.

alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_usage_daily enable row level security;

create policy ai_conversations_own on ai_conversations for all
  using (workspace_id = auth_workspace_id() and user_id = auth.uid())
  with check (workspace_id = auth_workspace_id() and user_id = auth.uid());

create policy ai_messages_own on ai_messages for all
  using (exists (
    select 1 from ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.workspace_id = auth_workspace_id()
      and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.workspace_id = auth_workspace_id()
      and c.user_id = auth.uid()
  ));

-- Read all usage in workspace (admin-style view), write only own
create policy ai_usage_read on ai_usage_daily for select
  using (workspace_id = auth_workspace_id());
create policy ai_usage_write on ai_usage_daily for all
  using (workspace_id = auth_workspace_id() and user_id = auth.uid())
  with check (workspace_id = auth_workspace_id() and user_id = auth.uid());
