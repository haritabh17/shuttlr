// Centralized plan limits — single source of truth

export const LIMITS = {
  free: {
    clubs: 3,
    members: 100,
    totalSessions: 100,
    concurrentSessions: 1,
  },
  pro: {
    clubs: 10,
    members: 300,
    totalSessions: 500,
    concurrentSessions: 3,
  },
} as const;
