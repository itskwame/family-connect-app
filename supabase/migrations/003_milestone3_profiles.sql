-- Milestone 3: Profiles + Business Info
-- Run after 002_milestone2_onboarding.sql

alter table public.people
  add column if not exists bio text null,
  add column if not exists contact_email text null,
  add column if not exists contact_phone text null,
  add column if not exists business_name text null,
  add column if not exists business_category text null,
  add column if not exists business_description text null,
  add column if not exists business_city text null,
  add column if not exists business_state text null,
  add column if not exists business_website text null,
  add column if not exists business_instagram text null,
  add column if not exists business_facebook text null;

-- Existing people RLS policies already cover these columns because updates remain row-based.
