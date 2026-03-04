-- Add 'free' as valid subscription status
ALTER TABLE club_subscriptions DROP CONSTRAINT IF EXISTS club_subscriptions_status_check;
ALTER TABLE club_subscriptions ADD CONSTRAINT club_subscriptions_status_check
  CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'free'));

-- Remove trial: new clubs start as free, no trial period
CREATE OR REPLACE FUNCTION create_club_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO club_subscriptions (club_id, plan, status)
  VALUES (NEW.id, 'free', 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: downgrade trialing clubs that never paid (no stripe subscription)
UPDATE club_subscriptions
SET status = 'free', trial_ends_at = NULL, updated_at = now()
WHERE status = 'trialing' AND stripe_subscription_id IS NULL;
