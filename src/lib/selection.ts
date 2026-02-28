/**
 * Court Selection Algorithm
 *
 * Modular interface: selectPlayers(availablePool, nCourts, options) → assignments
 *
 * Goals (in priority order):
 * 1. Fairness — equal-ish play counts (play_count asc, last_played_at asc)
 * 2. Variety — minimise repeated teammates
 * 3. Skill grouping — minimise level variance within each court
 *
 * Gender compositions per court: 4M, 4F, or 2M+2F
 */

export interface Player {
  id: string;
  full_name: string;
  gender: "M" | "F";
  level: number;
  play_count: number;
  last_played_at: string | null;
  teammate_history?: Record<string, number>; // player_id -> times played together
}

export interface CourtAssignment {
  courtIndex: number;
  players: Player[];
}

export interface SelectionOptions {
  preferMixed?: boolean; // prefer 2M+2F over same-gender courts
  weights?: {
    teammate_repeat: number; // penalty for repeated teammates (default: 5)
    level_distance: number;  // penalty for level variance (default: 3)
    play_count: number;      // penalty for play count imbalance (default: 1)
  };
}

const DEFAULT_WEIGHTS = {
  teammate_repeat: 5,
  level_distance: 3,
  play_count: 1,
};

/**
 * Select players for courts using round-robin + greedy heuristic
 */
export function selectPlayers(
  availablePool: Player[],
  nCourts: number,
  options: SelectionOptions = {}
): CourtAssignment[] {
  const playersNeeded = nCourts * 4;

  if (availablePool.length < playersNeeded) {
    // Not enough players — fill as many courts as possible
    const actualCourts = Math.floor(availablePool.length / 4);
    if (actualCourts === 0) return [];
    return selectPlayers(availablePool, actualCourts, options);
  }

  // Step 1: Sort by fairness (least play_count first, then earliest last_played)
  const sorted = [...availablePool].sort((a, b) => {
    if (a.play_count !== b.play_count) return a.play_count - b.play_count;
    const aTime = a.last_played_at ? new Date(a.last_played_at).getTime() : 0;
    const bTime = b.last_played_at ? new Date(b.last_played_at).getTime() : 0;
    return aTime - bTime;
  });

  // Step 2: Pick top candidates
  const candidates = sorted.slice(0, playersNeeded);
  const males = candidates.filter((p) => p.gender === "M");
  const females = candidates.filter((p) => p.gender === "F");

  // Step 3: Form courts with gender composition rules
  const courts = formCourts(males, females, nCourts, options);

  // Step 4: Optimize within courts for variety + skill
  return optimizeCourts(courts, options);
}

/**
 * Form courts respecting gender composition: 2M+2F, 4M, or 4F
 */
function formCourts(
  males: Player[],
  females: Player[],
  nCourts: number,
  options: SelectionOptions
): CourtAssignment[] {
  const preferMixed = options.preferMixed !== false; // default true
  const courts: CourtAssignment[] = [];

  const availM = [...males];
  const availF = [...females];

  for (let i = 0; i < nCourts; i++) {
    const court: Player[] = [];

    if (preferMixed && availM.length >= 2 && availF.length >= 2) {
      // 2M + 2F
      court.push(availM.shift()!, availM.shift()!);
      court.push(availF.shift()!, availF.shift()!);
    } else if (availM.length >= 4) {
      // 4M
      court.push(availM.shift()!, availM.shift()!, availM.shift()!, availM.shift()!);
    } else if (availF.length >= 4) {
      // 4F
      court.push(availF.shift()!, availF.shift()!, availF.shift()!, availF.shift()!);
    } else {
      // Fill with whatever's left
      const remaining = [...availM, ...availF];
      while (court.length < 4 && remaining.length > 0) {
        court.push(remaining.shift()!);
      }
      // Clear used players from avail arrays
      availM.length = 0;
      availF.length = 0;
    }

    courts.push({ courtIndex: i, players: court });
  }

  return courts;
}

/**
 * Optimize player arrangement within courts to minimize:
 * - Repeated teammates (high weight)
 * - Level variance (medium weight)
 */
function optimizeCourts(
  courts: CourtAssignment[],
  options: SelectionOptions
): CourtAssignment[] {
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };

  // Simple optimization: try swapping players between courts
  // to reduce the total penalty score
  let bestScore = totalScore(courts, weights);
  let improved = true;
  let iterations = 0;
  const maxIterations = 100;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < courts.length; i++) {
      for (let j = i + 1; j < courts.length; j++) {
        for (let pi = 0; pi < courts[i].players.length; pi++) {
          for (let pj = 0; pj < courts[j].players.length; pj++) {
            const playerI = courts[i].players[pi];
            const playerJ = courts[j].players[pj];

            // Only swap same gender to maintain composition
            if (playerI.gender !== playerJ.gender) continue;

            // Try swap
            courts[i].players[pi] = playerJ;
            courts[j].players[pj] = playerI;

            const newScore = totalScore(courts, weights);
            if (newScore < bestScore) {
              bestScore = newScore;
              improved = true;
            } else {
              // Revert
              courts[i].players[pi] = playerI;
              courts[j].players[pj] = playerJ;
            }
          }
        }
      }
    }
  }

  return courts;
}

/**
 * Calculate total penalty score for a set of court assignments
 */
function totalScore(
  courts: CourtAssignment[],
  weights: typeof DEFAULT_WEIGHTS
): number {
  let score = 0;

  for (const court of courts) {
    const players = court.players;

    // Level variance penalty
    if (players.length > 0) {
      const levels = players.map((p) => p.level);
      const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
      const variance =
        levels.reduce((sum, l) => sum + (l - mean) ** 2, 0) / levels.length;
      score += variance * weights.level_distance;
    }

    // Teammate repeat penalty
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const history = players[i].teammate_history;
        if (history && history[players[j].id]) {
          score += history[players[j].id] * weights.teammate_repeat;
        }
      }
    }

    // Play count imbalance penalty (within court)
    if (players.length > 0) {
      const counts = players.map((p) => p.play_count);
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts);
      score += (maxCount - minCount) * weights.play_count;
    }
  }

  return score;
}
