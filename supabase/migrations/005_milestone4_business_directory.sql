-- Milestone 4: Business Directory
-- Run after 004_milestone3_profile_details.sql

alter table public.people
  add column if not exists business_logo_url text null;

-- Business directory reads directly from public.people, so no new table is required.
