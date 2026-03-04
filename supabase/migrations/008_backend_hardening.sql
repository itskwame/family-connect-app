-- Backend hardening pass
-- Run after 007_milestone6_home_feed.sql

-- Keep one family-wide chat thread per family.
create unique index if not exists conversations_family_type_unique_idx
  on public.conversations (family_id, type)
  where type = 'family';

create index if not exists messages_conversation_read_at_idx
  on public.messages (conversation_id, read_at);

-- Tighten participant inserts so added people must belong to the conversation family.
drop policy if exists "participants_insert_for_family_members" on public.conversation_participants;

create policy "participants_insert_for_family_members"
on public.conversation_participants
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    join public.family_memberships fm
      on fm.family_id = c.family_id
     and fm.user_id = auth.uid()
    join public.people p
      on p.id = conversation_participants.person_id
     and p.family_id = c.family_id
    where c.id = conversation_participants.conversation_id
  )
);

-- Tighten message inserts so sender must be the authenticated user's linked profile in that family.
drop policy if exists "messages_insert_for_family_members" on public.messages;

create policy "messages_insert_for_family_members"
on public.messages
for insert
to authenticated
with check (
  (
    coalesce(trim(messages.content), '') <> ''
    or messages.media_url is not null
  )
  and exists (
    select 1
    from public.conversations c
    join public.family_memberships fm
      on fm.family_id = c.family_id
     and fm.user_id = auth.uid()
    join public.people sender
      on sender.id = messages.sender_person_id
     and sender.family_id = c.family_id
    join public.user_person_links upl
      on upl.person_id = sender.id
     and upl.user_id = auth.uid()
    where c.id = messages.conversation_id
  )
);

-- Add update policy so read receipts can be written by family members with a linked profile.
drop policy if exists "messages_update_read_receipts_for_family_members" on public.messages;

create policy "messages_update_read_receipts_for_family_members"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.family_memberships fm
      on fm.family_id = c.family_id
     and fm.user_id = auth.uid()
    join public.user_person_links upl
      on upl.user_id = auth.uid()
    join public.people me
      on me.id = upl.person_id
     and me.family_id = c.family_id
    where c.id = messages.conversation_id
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    join public.family_memberships fm
      on fm.family_id = c.family_id
     and fm.user_id = auth.uid()
    join public.user_person_links upl
      on upl.user_id = auth.uid()
    join public.people me
      on me.id = upl.person_id
     and me.family_id = c.family_id
    where c.id = messages.conversation_id
  )
);

-- Guard message updates so clients can only set read_at.
create or replace function public.enforce_message_read_receipt_update()
returns trigger
language plpgsql
as $$
begin
  if new.conversation_id <> old.conversation_id then
    raise exception 'conversation_id is immutable';
  end if;

  if new.sender_person_id <> old.sender_person_id then
    raise exception 'sender_person_id is immutable';
  end if;

  if new.content <> old.content then
    raise exception 'content is immutable through this update path';
  end if;

  if coalesce(new.media_url, '') <> coalesce(old.media_url, '') then
    raise exception 'media_url is immutable through this update path';
  end if;

  if new.created_at <> old.created_at then
    raise exception 'created_at is immutable';
  end if;

  if new.read_at is null then
    raise exception 'read_at cannot be cleared';
  end if;

  if old.read_at is not null and new.read_at <> old.read_at then
    raise exception 'read_at can only be set once';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_read_receipt_guard on public.messages;

create trigger messages_read_receipt_guard
before update on public.messages
for each row
execute function public.enforce_message_read_receipt_update();

-- Support "unlike" action in feed.
drop policy if exists "post_likes_delete_for_family_members" on public.post_likes;

create policy "post_likes_delete_for_family_members"
on public.post_likes
for delete
to authenticated
using (
  exists (
    select 1
    from public.posts p
    join public.people pe
      on pe.id = post_likes.person_id
     and pe.family_id = p.family_id
    join public.user_person_links upl
      on upl.person_id = pe.id
     and upl.user_id = auth.uid()
    where p.id = post_likes.post_id
  )
);
