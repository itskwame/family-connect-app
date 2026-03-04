-- Milestone 6: Family Home (Feed + Hub)
-- Run after 006_milestone5_messaging.sql

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_person_id uuid not null references public.people(id) on delete cascade,
  content text not null,
  media_url text null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, person_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_family_id_idx on public.posts (family_id);
create index if not exists post_likes_post_id_idx on public.post_likes (post_id);
create index if not exists post_comments_post_id_idx on public.post_comments (post_id);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

create policy "posts_select_for_family_members"
on public.posts
for select
to authenticated
using (
  exists (
    select 1
    from public.family_memberships fm
    where fm.family_id = posts.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "posts_insert_for_family_members"
on public.posts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.people p
    join public.user_person_links upl on upl.person_id = p.id
    where p.id = posts.author_person_id
      and p.family_id = posts.family_id
      and upl.user_id = auth.uid()
  )
);

create policy "post_likes_select_for_family_members"
on public.post_likes
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    join public.family_memberships fm on fm.family_id = p.family_id
    where p.id = post_likes.post_id
      and fm.user_id = auth.uid()
  )
);

create policy "post_likes_insert_for_family_members"
on public.post_likes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.posts p
    join public.people pe on pe.id = post_likes.person_id
    join public.user_person_links upl on upl.person_id = pe.id
    where p.id = post_likes.post_id
      and pe.family_id = p.family_id
      and upl.user_id = auth.uid()
  )
);

create policy "post_comments_select_for_family_members"
on public.post_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    join public.family_memberships fm on fm.family_id = p.family_id
    where p.id = post_comments.post_id
      and fm.user_id = auth.uid()
  )
);

create policy "post_comments_insert_for_family_members"
on public.post_comments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.posts p
    join public.people pe on pe.id = post_comments.person_id
    join public.user_person_links upl on upl.person_id = pe.id
    where p.id = post_comments.post_id
      and pe.family_id = p.family_id
      and upl.user_id = auth.uid()
  )
);
