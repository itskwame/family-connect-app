-- Milestone 3: Profile timeline + media
-- Run after 003_milestone3_profiles.sql

create table if not exists public.profile_timeline_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_type text not null,
  event_date date null,
  description text not null
);

create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  media_url text not null,
  caption text null
);

create index if not exists profile_timeline_events_person_id_idx
  on public.profile_timeline_events (person_id);
create index if not exists profile_media_person_id_idx
  on public.profile_media (person_id);

alter table public.profile_timeline_events enable row level security;
alter table public.profile_media enable row level security;

create policy "timeline_events_select_for_family_members"
on public.profile_timeline_events
for select
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = profile_timeline_events.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "timeline_events_insert_for_family_members"
on public.profile_timeline_events
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = profile_timeline_events.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "media_select_for_family_members"
on public.profile_media
for select
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = profile_media.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "media_insert_for_family_members"
on public.profile_media
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = profile_media.family_id
      and fm.user_id = auth.uid()
  )
);
