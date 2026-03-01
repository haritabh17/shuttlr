-- Add strict_gender flag to sessions (default true)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS strict_gender boolean NOT NULL DEFAULT true;
