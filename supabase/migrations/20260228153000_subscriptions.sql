-- Subscription tracking for clubs
CREATE TABLE IF NOT EXISTS club_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id)
);

-- Track monthly session usage
CREATE TABLE IF NOT EXISTS session_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  month text NOT NULL, -- format: '2026-02'
  session_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, month)
);

-- Auto-create subscription row when club is created (3-month trial)
CREATE OR REPLACE FUNCTION create_club_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO club_subscriptions (club_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'trialing', NEW.created_at + INTERVAL '3 months');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_club_created_subscription ON clubs;
CREATE TRIGGER on_club_created_subscription
  AFTER INSERT ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION create_club_subscription();

-- Backfill existing clubs with subscriptions
INSERT INTO club_subscriptions (club_id, plan, status, trial_ends_at)
SELECT id, 'free', 'trialing', created_at + INTERVAL '3 months'
FROM clubs
WHERE id NOT IN (SELECT club_id FROM club_subscriptions)
ON CONFLICT (club_id) DO NOTHING;

-- Increment session count when a session starts (status changes to 'running' for the first time)
CREATE OR REPLACE FUNCTION track_session_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'running' AND OLD.status = 'initiated' THEN
    INSERT INTO session_usage (club_id, month, session_count)
    VALUES (NEW.club_id, to_char(now(), 'YYYY-MM'), 1)
    ON CONFLICT (club_id, month)
    DO UPDATE SET session_count = session_usage.session_count + 1, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_session_started ON sessions;
CREATE TRIGGER on_session_started
  AFTER UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION track_session_usage();

-- RLS
ALTER TABLE club_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_usage ENABLE ROW LEVEL SECURITY;

-- Members can read their club's subscription
CREATE POLICY "Members can view club subscription" ON club_subscriptions
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Members can read their club's usage
CREATE POLICY "Members can view club usage" ON session_usage
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );
