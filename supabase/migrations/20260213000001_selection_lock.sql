-- Add optimistic lock flag for selection to prevent race conditions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS selecting boolean NOT NULL DEFAULT false;
