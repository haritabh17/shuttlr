# TODO — Pending Tasks

## 1. Per-User Club Creation Limits
**Priority:** High (abuse prevention)

- Max 3 clubs created per user (free), 10 if any of their clubs is Pro
- Max 5 clubs managed total (creator + promoted manager)
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

## 3. Anti-Abuse: Club Creation Rate Limiting
**Priority:** Medium (scripted attack prevention)

- Server-side rate limit: max 1 club per hour per user, max 3 per day
- Options:
  - Simple: timestamp column `last_club_created_at` on profiles
  - Better: lightweight `rate_limits` table (user_id, action, timestamp)
  - Cheapest: just count clubs created in last 24h from `clubs.created_at`
- Return 429 Too Many Requests with retry-after header
- No UI needed — legitimate users won't hit this

## 4. Subscription Banner Improvements
**Priority:** Medium (UX)

- Show plan comparison in upgrade banner:
  | Feature        | Free        | Pro          |
  |---------------|-------------|--------------|
  | Sessions/month | 4           | Unlimited    |
  | Members/club   | 100         | 300          |
  | Clubs created  | 3           | 10           |
- Show current usage in subscription status card:
  - "Sessions this month: 2 / 4"
  - "Members: 47 / 100"
- Managers-only visibility (already the case)
