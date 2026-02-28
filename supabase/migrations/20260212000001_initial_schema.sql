-- ============================================================
-- Shuttlr – Initial Schema
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profiles (extends Supabase auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  gender      text check (gender in ('M', 'F')),
  level       int check (level between 1 and 10),
  telegram_id text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. Clubs
-- ------------------------------------------------------------
create table public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text default '',
  visibility  text not null default 'public' check (visibility in ('public', 'private', 'invite-only')),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_clubs_slug on public.clubs(slug);
create index idx_clubs_created_by on public.clubs(created_by);

-- ------------------------------------------------------------
-- 3. Club Members
-- ------------------------------------------------------------
create table public.club_members (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  role          text not null default 'player' check (role in ('manager', 'player')),
  invited_email text,
  invited_name  text,
  invited_gender text check (invited_gender in ('M', 'F')),
  invited_level  int check (invited_level between 1 and 10),
  status        text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (club_id, user_id)
);

create index idx_club_members_club on public.club_members(club_id);
create index idx_club_members_user on public.club_members(user_id);

-- ------------------------------------------------------------
-- 4. Courts
-- ------------------------------------------------------------
create table public.courts (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,
  locked     boolean not null default false,
  extra_info text default '',
  created_at timestamptz not null default now()
);

create index idx_courts_club on public.courts(club_id);

-- ------------------------------------------------------------
-- 5. Sessions
-- ------------------------------------------------------------
create table public.sessions (
  id                         uuid primary key default gen_random_uuid(),
  club_id                    uuid not null references public.clubs(id) on delete cascade,
  name                       text not null default 'Session',
  play_time_minutes          int not null default 15,
  rest_time_minutes          int not null default 5,
  selection_interval_minutes int not null default 12,
  number_of_courts           int not null default 2,
  status                     text not null default 'draft'
                             check (status in ('draft', 'initiated', 'running', 'paused', 'ended')),
  initiated_at               timestamptz,
  started_at                 timestamptz,
  ended_at                   timestamptz,
  deleted_at                 timestamptz,  -- soft delete
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index idx_sessions_club on public.sessions(club_id);
create index idx_sessions_status on public.sessions(status);

-- ------------------------------------------------------------
-- 6. Session Players
-- ------------------------------------------------------------
create table public.session_players (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id),
  status         text not null default 'available'
                 check (status in ('available', 'selected', 'playing', 'resting', 'removed')),
  play_count     int not null default 0,
  last_played_at timestamptz,
  created_at     timestamptz not null default now(),
  unique (session_id, user_id)
);

create index idx_session_players_session on public.session_players(session_id);

-- ------------------------------------------------------------
-- 7. Court Assignments (tracks who is on which court per round)
-- ------------------------------------------------------------
create table public.court_assignments (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  court_id   uuid not null references public.courts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  round      int not null default 1,
  created_at timestamptz not null default now()
);

create index idx_court_assignments_session on public.court_assignments(session_id);
create index idx_court_assignments_round on public.court_assignments(session_id, round);

-- ------------------------------------------------------------
-- 8. Events (club activity log)
-- ------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  session_id  uuid references public.sessions(id) on delete set null,
  actor_id    uuid references public.profiles(id),
  actor_type  text not null default 'system' check (actor_type in ('human', 'system')),
  event_type  text not null,
  payload     jsonb default '{}',
  created_at  timestamptz not null default now()
);

create index idx_events_club on public.events(club_id);
create index idx_events_session on public.events(session_id);
create index idx_events_created on public.events(created_at desc);

-- ------------------------------------------------------------
-- 9. RLS Policies
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.courts enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.court_assignments enable row level security;
alter table public.events enable row level security;

-- Profiles: users can read all, update own
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Clubs: readable by all authenticated, writable by creator
create policy "Clubs are viewable by authenticated users"
  on public.clubs for select using (auth.role() = 'authenticated');
create policy "Users can create clubs"
  on public.clubs for insert with check (auth.uid() = created_by);
create policy "Club creator can update"
  on public.clubs for update using (auth.uid() = created_by);

-- Club Members: readable by club members, managed by managers
create policy "Club members viewable by club members"
  on public.club_members for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_members.club_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );
create policy "Managers can insert club members"
  on public.club_members for insert with check (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_members.club_id
        and cm.user_id = auth.uid()
        and cm.role = 'manager'
        and cm.status = 'active'
    )
  );
create policy "Managers can update club members"
  on public.club_members for update using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_members.club_id
        and cm.user_id = auth.uid()
        and cm.role = 'manager'
        and cm.status = 'active'
    )
  );

-- Courts: same as club members access
create policy "Courts viewable by club members"
  on public.courts for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = courts.club_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );
create policy "Managers can manage courts"
  on public.courts for all using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = courts.club_id
        and cm.user_id = auth.uid()
        and cm.role = 'manager'
        and cm.status = 'active'
    )
  );

-- Sessions: viewable by club members, managed by managers
create policy "Sessions viewable by club members"
  on public.sessions for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = sessions.club_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );
create policy "Managers can manage sessions"
  on public.sessions for all using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = sessions.club_id
        and cm.user_id = auth.uid()
        and cm.role = 'manager'
        and cm.status = 'active'
    )
  );

-- Session Players: viewable by club members of that session's club
create policy "Session players viewable by club members"
  on public.session_players for select using (
    exists (
      select 1 from public.sessions s
      join public.club_members cm on cm.club_id = s.club_id
      where s.id = session_players.session_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );
create policy "Managers can manage session players"
  on public.session_players for all using (
    exists (
      select 1 from public.sessions s
      join public.club_members cm on cm.club_id = s.club_id
      where s.id = session_players.session_id
        and cm.user_id = auth.uid()
        and cm.role = 'manager'
        and cm.status = 'active'
    )
  );

-- Court Assignments: same as session players
create policy "Court assignments viewable by club members"
  on public.court_assignments for select using (
    exists (
      select 1 from public.sessions s
      join public.club_members cm on cm.club_id = s.club_id
      where s.id = court_assignments.session_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

-- Events: viewable by club members
create policy "Events viewable by club members"
  on public.events for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = events.club_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );
create policy "System and managers can insert events"
  on public.events for insert with check (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = events.club_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

-- ------------------------------------------------------------
-- 10. Updated_at trigger
-- ------------------------------------------------------------
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.clubs
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.club_members
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.sessions
  for each row execute function public.update_updated_at();
