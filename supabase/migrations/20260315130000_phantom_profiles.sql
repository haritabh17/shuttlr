-- Allow profiles to exist without an auth.users entry (for club-managed phantom players)
-- Drop the FK constraint so we can insert phantom profiles with gen_random_uuid()
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
-- Re-add as a softer relationship: keep cascade for real users but allow orphan phantoms
-- We don't re-add the FK — the handle_new_user trigger still creates profiles for real signups

-- Add is_placeholder flag to distinguish phantom profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false;

-- Make email nullable for phantom profiles (currently has NOT NULL default '')
-- We keep the default '' for backwards compat but allow explicit NULL
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
