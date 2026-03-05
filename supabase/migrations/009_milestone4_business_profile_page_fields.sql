-- Milestone 4 follow-up: richer business profile page fields
-- Run after 005_milestone4_business_directory.sql

alter table public.people
  add column if not exists business_about text null,
  add column if not exists business_images text[] null,
  add column if not exists business_videos text[] null,
  add column if not exists business_family_discount_code text null;

