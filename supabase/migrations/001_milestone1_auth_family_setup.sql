-- Milestone 1: Authentication + Family Setup
-- Apply this in Supabase after enabling Email auth in the dashboard.

create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'contributor' check (role in ('admin', 'contributor', 'viewer')),
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token text not null unique,
  type text not null check (type in ('join', 'claim', 'branch')),
  target_person_id uuid null,
  role_default text not null default 'contributor'
    check (role_default in ('contributor', 'viewer')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists family_memberships_user_id_idx on public.family_memberships (user_id);
create index if not exists invites_family_id_idx on public.invites (family_id);

alter table public.families enable row level security;
alter table public.family_memberships enable row level security;
alter table public.invites enable row level security;

create policy "families_select_for_members"
on public.families
for select
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = families.id
      and fm.user_id = auth.uid()
  )
);

create policy "families_insert_for_authenticated_users"
on public.families
for insert
to authenticated
with check (created_by = auth.uid());

create policy "families_update_for_admins"
on public.families
for update
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = families.id
      and fm.user_id = auth.uid()
      and fm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = families.id
      and fm.user_id = auth.uid()
      and fm.role = 'admin'
  )
);

create policy "memberships_select_own_or_same_family"
on public.family_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = family_memberships.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "memberships_insert_self"
on public.family_memberships
for insert
to authenticated
with check (user_id = auth.uid());

create policy "memberships_update_admins"
on public.family_memberships
for update
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = family_memberships.family_id
      and fm.user_id = auth.uid()
      and fm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = family_memberships.family_id
      and fm.user_id = auth.uid()
      and fm.role = 'admin'
  )
);

create policy "invites_select_for_authenticated_users"
on public.invites
for select
to authenticated
using (true);

create policy "invites_insert_for_members"
on public.invites
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = invites.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "invites_update_for_admins"
on public.invites
for update
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = invites.family_id
      and fm.user_id = auth.uid()
      and fm.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = invites.family_id
      and fm.user_id = auth.uid()
      and fm.role = 'admin'
  )
);
