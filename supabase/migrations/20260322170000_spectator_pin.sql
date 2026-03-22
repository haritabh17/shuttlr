-- Add spectator PIN for public view-only session sharing
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS spectator_pin text;
