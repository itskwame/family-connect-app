-- Milestone 5: Messaging System
-- Run after 005_milestone4_business_directory.sql

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  type text not null check (type in ('direct', 'group', 'family')),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  unique (conversation_id, person_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_person_id uuid not null references public.people(id) on delete cascade,
  content text not null default '',
  media_url text null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists conversations_family_id_idx on public.conversations (family_id);
create index if not exists conversation_participants_conversation_id_idx
  on public.conversation_participants (conversation_id);
create index if not exists messages_conversation_id_idx on public.messages (conversation_id);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select_for_family_members"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = conversations.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "conversations_insert_for_family_members"
on public.conversations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = conversations.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "participants_select_for_family_members"
on public.conversation_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.family_memberships fm on fm.family_id = c.family_id
    where c.id = conversation_participants.conversation_id
      and fm.user_id = auth.uid()
  )
);

create policy "participants_insert_for_family_members"
on public.conversation_participants
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    join public.family_memberships fm on fm.family_id = c.family_id
    where c.id = conversation_participants.conversation_id
      and fm.user_id = auth.uid()
  )
);

create policy "messages_select_for_family_members"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.family_memberships fm on fm.family_id = c.family_id
    where c.id = messages.conversation_id
      and fm.user_id = auth.uid()
  )
);

create policy "messages_insert_for_family_members"
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    join public.family_memberships fm on fm.family_id = c.family_id
    where c.id = messages.conversation_id
      and fm.user_id = auth.uid()
  )
);
