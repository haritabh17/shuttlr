-- Fix: club_members select policy was self-referential causing infinite recursion.
-- Solution: use a security definer function to bypass RLS for the membership check.

drop policy if exists "Club members viewable by club members" on public.club_members;

-- Helper function to check club membership (bypasses RLS)
create or replace function public.is_club_member(p_club_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id
      and user_id = p_user_id
      and status = 'active'
  );
$$ language sql security definer stable;

-- Helper function to check if user is a manager
create or replace function public.is_club_manager(p_club_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id
      and user_id = p_user_id
      and role = 'manager'
      and status = 'active'
  );
$$ language sql security definer stable;

-- Users can see memberships for clubs they belong to
create policy "Club members viewable by members"
  on public.club_members for select using (
    user_id = auth.uid()
    or public.is_club_member(club_id, auth.uid())
  );

-- Also fix other policies that had the same recursion issue
drop policy if exists "Managers can insert club members" on public.club_members;
create policy "Managers can insert club members"
  on public.club_members for insert with check (
    public.is_club_manager(club_id, auth.uid())
  );

drop policy if exists "Managers can update club members" on public.club_members;
create policy "Managers can update club members"
  on public.club_members for update using (
    public.is_club_manager(club_id, auth.uid())
  );

-- Fix courts policy
drop policy if exists "Courts viewable by club members" on public.courts;
create policy "Courts viewable by club members"
  on public.courts for select using (
    public.is_club_member(club_id, auth.uid())
  );

drop policy if exists "Managers can manage courts" on public.courts;
create policy "Managers can manage courts"
  on public.courts for all using (
    public.is_club_manager(club_id, auth.uid())
  );

-- Fix sessions policies
drop policy if exists "Sessions viewable by club members" on public.sessions;
create policy "Sessions viewable by club members"
  on public.sessions for select using (
    public.is_club_member(club_id, auth.uid())
  );

drop policy if exists "Managers can manage sessions" on public.sessions;
create policy "Managers can manage sessions"
  on public.sessions for all using (
    public.is_club_manager(club_id, auth.uid())
  );

-- Fix session_players policies
drop policy if exists "Session players viewable by club members" on public.session_players;
create policy "Session players viewable by club members"
  on public.session_players for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_players.session_id
        and public.is_club_member(s.club_id, auth.uid())
    )
  );

drop policy if exists "Managers can manage session players" on public.session_players;
create policy "Managers can manage session players"
  on public.session_players for all using (
    exists (
      select 1 from public.sessions s
      where s.id = session_players.session_id
        and public.is_club_manager(s.club_id, auth.uid())
    )
  );

-- Fix court_assignments
drop policy if exists "Court assignments viewable by club members" on public.court_assignments;
create policy "Court assignments viewable by club members"
  on public.court_assignments for select using (
    exists (
      select 1 from public.sessions s
      where s.id = court_assignments.session_id
        and public.is_club_member(s.club_id, auth.uid())
    )
  );

-- Fix events policies
drop policy if exists "Events viewable by club members" on public.events;
create policy "Events viewable by club members"
  on public.events for select using (
    public.is_club_member(club_id, auth.uid())
  );

drop policy if exists "System and managers can insert events" on public.events;
create policy "Members can insert events"
  on public.events for insert with check (
    public.is_club_member(club_id, auth.uid())
  );
