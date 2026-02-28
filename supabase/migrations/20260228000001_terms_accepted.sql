-- Add terms acceptance tracking to profiles
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
