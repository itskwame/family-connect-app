-- Milestone 2: Onboarding + Profile Creation
-- Run after 001_milestone1_auth_family_setup.sql

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  gender text not null,
  birth_date date null,
  city text null,
  state text null,
  zip text null,
  profile_photo_url text null
);

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  person_a_id uuid not null references public.people(id) on delete cascade,
  person_b_id uuid not null references public.people(id) on delete cascade,
  relationship_type text not null check (
    relationship_type in ('parent', 'child', 'spouse', 'sibling', 'step_parent', 'adopted_parent')
  ),
  locked boolean not null default true,
  check (person_a_id <> person_b_id)
);

create table if not exists public.user_person_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists people_family_id_idx on public.people (family_id);
create index if not exists relationships_family_id_idx on public.relationships (family_id);
create index if not exists user_person_links_person_id_idx on public.user_person_links (person_id);

alter table public.people enable row level security;
alter table public.relationships enable row level security;
alter table public.user_person_links enable row level security;

create policy "people_select_for_family_members"
on public.people
for select
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = people.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "people_insert_for_family_members"
on public.people
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = people.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "people_update_for_family_members"
on public.people
for update
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = people.family_id
      and fm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = people.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "relationships_select_for_family_members"
on public.relationships
for select
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = relationships.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "relationships_insert_for_family_members"
on public.relationships
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = relationships.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "user_person_links_select_for_self"
on public.user_person_links
for select
to authenticated
using (user_id = auth.uid());

create policy "user_person_links_insert_for_self"
on public.user_person_links
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = user_person_links.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "user_person_links_update_for_self"
on public.user_person_links
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
