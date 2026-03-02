# TODO — Pending Tasks

## 1. Per-User Club Creation Limits
**Priority:** High (abuse prevention)

- Max 3 clubs created/managed per user (free), 10 if any of their clubs is Pro
- Enforce in `create-club-button.tsx` API call and backend
- Query: `club_members WHERE user_id = X AND role = 'manager' AND status = 'active'`
- Show friendly error: "You've reached the maximum number of clubs"
- Consider rate limiting: max 1 club creation per hour (prevents scripted spam)

## 2. Per-Club Member Limits
**Priority:** High (DB protection)

- Free tier: 100 members
- Pro tier: 300 members
- Enforce in:
  - `add-member-button.tsx` / add member API
  - `add-player-modal.tsx` / add all members
  - Join-by-link flow (if added later)
  - Player self-join (pending approval flow)
- Show current count vs limit in subscription status card on club page
  - e.g. "Members: 47 / 100" with a progress bar
  - When near limit (>80%): amber warning
  - When at limit: "Upgrade to Pro for up to 300 members"
- Display in upgrade banner: "Free: 100 members · Pro: 300 members"

## 3. Session Limits
**Priority:** High (abuse prevention + edge function resource protection)

- Concurrent running sessions: 1 (free) / 3 (Pro)
- Total sessions per club (including soft-deleted): 100 (free) / 500 (Pro)
- **Remove** the existing 4 sessions/month limit (DB trigger `on_session_started` + `session_usage` table)
- Enforce in create-session and start-session flows
- Show count in subscription status card: "Total sessions: 12 / 100"

## 4. Subscription Banner Improvements
**Priority:** Medium (UX)

- Show plan comparison in upgrade banner:
  | Feature          | Free        | Pro          |
  |-----------------|-------------|--------------|
  | Total sessions   | 100         | 500          |
  | Members/club     | 100         | 300          |
  | Clubs managed    | 3           | 10           |
  | Concurrent games | 1           | 3            |
- Show current usage in subscription status card:
  - "Total sessions: 12 / 100"
  - "Members: 47 / 100"
  - "Concurrent games: 0 / 1"
- Collapsed state (free): show upgrade button alongside plan badge
- Managers-only visibility (already the case)
