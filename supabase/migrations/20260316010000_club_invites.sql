-- Club invitations for linking email to phantom player profiles
CREATE TABLE public.club_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  email      text NOT NULL,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_invites ENABLE ROW LEVEL SECURITY;

-- Only service role needs access (API routes use admin client)
CREATE POLICY "Service role full access" ON public.club_invites
  USING (true) WITH CHECK (true);

CREATE INDEX idx_club_invites_token ON public.club_invites(token);
CREATE INDEX idx_club_invites_member ON public.club_invites(member_id);
