/**
 * Selection Engine — scores and assigns players to courts
 *
 * Factors (all configurable 0-100):
 *   - Fairness: least games played gets priority
 *   - Mixed ratio: target % of mixed-gender courts
 *   - Skill balance: spread levels evenly across courts
 *   - Partner variety: avoid repeat pairings
 */

export interface Player {
  id: string;
  gender: "male" | "female" | null;
  level: number; // 1-5
  games_played: number;
  is_on_court: boolean; // currently playing
}

export interface PartnerPair {
  player1_id: string; // smaller UUID
  player2_id: string; // larger UUID
  times_paired: number;
}

export interface AlgorithmConfig {
  mixed_ratio: number;    // 0-100
  skill_balance: number;  // 0-100
  partner_variety: number; // 0-100
  strict_gender: boolean; // when true, doubles must be same-gender; 3:1 combos never happen
}

export interface CourtAssignment {
  court_index: number;
  game_type: "mixed" | "doubles";
  team_a: [Player, Player];
  team_b: [Player, Player];
}

/**
 * Main entry: select players for N courts
 */
export function selectPlayers(
  players: Player[],
  numCourts: number,
  config: AlgorithmConfig,
  partnerHistory: PartnerPair[],
): CourtAssignment[] {
  const available = players.filter((p) => true); // all players are candidates
  const needed = numCourts * 4;

  if (available.length < 4) return []; // need at least 4 for one court

  // Adjust games_played for currently-on-court players (+1 virtual game)
  const adjusted = available.map((p) => ({
    ...p,
    effective_games: p.games_played + (p.is_on_court ? 1 : 0),
  }));

  // Sort by effective games (ascending = priority), shuffle ties randomly
  adjusted.sort((a, b) => {
    const diff = a.effective_games - b.effective_games;
    if (diff !== 0) return diff;
    return Math.random() - 0.5; // break ties randomly
  });

  // Take top N players (may be fewer than needed)
  const actualCourts = Math.min(numCourts, Math.floor(adjusted.length / 4));
  if (actualCourts === 0) return [];

  const selected = adjusted.slice(0, actualCourts * 4);

  // Decide game types for each court based on mixed_ratio
  const gameTypes = decideGameTypes(actualCourts, config.mixed_ratio, selected);

  // Build partner lookup for variety scoring
  const pairLookup = buildPairLookup(partnerHistory);

  // Assign players to courts using scoring
  return assignToCourts(selected, gameTypes, config, pairLookup);
}

/**
 * Decide which courts are mixed vs doubles based on ratio and gender availability
 */
function decideGameTypes(
  numCourts: number,
  mixedRatio: number,
  players: Array<Player & { effective_games: number }>,
): Array<"mixed" | "doubles"> {
  const males = players.filter((p) => p.gender === "male").length;
  const females = players.filter((p) => p.gender === "female").length;

  // Max possible mixed courts (each needs at least 1M + 1F per team = 2M + 2F)
  const maxMixed = Math.min(Math.floor(males / 2), Math.floor(females / 2), numCourts);

  // Target mixed courts based on ratio
  const targetMixed = Math.round((mixedRatio / 100) * numCourts);
  const actualMixed = Math.min(targetMixed, maxMixed);

  const types: Array<"mixed" | "doubles"> = [];
  for (let i = 0; i < actualMixed; i++) types.push("mixed");
  for (let i = actualMixed; i < numCourts; i++) types.push("doubles");

  return types;
}

/**
 * Build a lookup map from player pair → times_paired
 */
function buildPairLookup(history: PartnerPair[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of history) {
    map.set(pairKey(h.player1_id, h.player2_id), h.times_paired);
  }
  return map;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Assign players to courts, optimizing for skill balance and partner variety
 */
function assignToCourts(
  players: Array<Player & { effective_games: number }>,
  gameTypes: Array<"mixed" | "doubles">,
  config: AlgorithmConfig,
  pairLookup: Map<string, number>,
): CourtAssignment[] {
  const numCourts = gameTypes.length;

  // Separate by gender for mixed courts
  const males = players.filter((p) => p.gender === "male");
  const females = players.filter((p) => p.gender === "female");
  const unknown = players.filter((p) => p.gender === null);

  const assignments: CourtAssignment[] = [];
  const used = new Set<string>();

  // First pass: fill mixed courts
  for (let i = 0; i < numCourts; i++) {
    if (gameTypes[i] !== "mixed") continue;

    const availM = males.filter((p) => !used.has(p.id));
    const availF = females.filter((p) => !used.has(p.id));

    if (availM.length < 2 || availF.length < 2) {
      // Fallback to doubles
      gameTypes[i] = "doubles";
      continue;
    }

    // Pick best 2M + 2F combo by scoring
    const bestCombo = pickBestMixedCombo(availM, availF, config, pairLookup);
    if (!bestCombo) {
      gameTypes[i] = "doubles";
      continue;
    }

    for (const p of [...bestCombo.team_a, ...bestCombo.team_b]) used.add(p.id);
    assignments.push({ court_index: i, game_type: "mixed", ...bestCombo });
  }

  // Second pass: fill doubles courts
  const remaining = players.filter((p) => !used.has(p.id));
  // Add unknowns to remaining pool
  for (const p of unknown) {
    if (!used.has(p.id)) {
      // already in remaining
    }
  }

  let doublesPool = [...remaining];

  for (let i = 0; i < numCourts; i++) {
    if (gameTypes[i] !== "doubles") continue;

    if (doublesPool.length < 4) break;

    const bestCombo = pickBestDoublesCombo(doublesPool, config, pairLookup);
    if (bestCombo) {
      for (const p of [...bestCombo.team_a, ...bestCombo.team_b]) {
        doublesPool = doublesPool.filter((dp) => dp.id !== p.id);
      }
      assignments.push({ court_index: i, game_type: "doubles", ...bestCombo });
      continue;
    }

    // Strict gender prevented same-gender doubles — fall back to mixed (2M+2F)
    const poolM = doublesPool.filter((p) => p.gender === "male");
    const poolF = doublesPool.filter((p) => p.gender === "female");
    if (poolM.length >= 2 && poolF.length >= 2) {
      const mixedCombo = pickBestMixedCombo(poolM, poolF, config, pairLookup);
      if (mixedCombo) {
        for (const p of [...mixedCombo.team_a, ...mixedCombo.team_b]) {
          doublesPool = doublesPool.filter((dp) => dp.id !== p.id);
        }
        assignments.push({ court_index: i, game_type: "mixed", ...mixedCombo });
        continue;
      }
    }
    // Truly can't fill this court
  }

  // Sort by court index
  assignments.sort((a, b) => a.court_index - b.court_index);
  return assignments;
}

/**
 * Pick best 2M+2F for a mixed court
 * For efficiency, evaluate top candidates (not all permutations)
 */
function pickBestMixedCombo(
  males: Player[],
  females: Player[],
  config: AlgorithmConfig,
  pairLookup: Map<string, number>,
): { team_a: [Player, Player]; team_b: [Player, Player] } | null {
  // Take top candidates of each gender
  const topM = males.slice(0, Math.min(6, males.length));
  const topF = females.slice(0, Math.min(6, females.length));

  let bestScore = -Infinity;
  let bestTeams: { team_a: [Player, Player]; team_b: [Player, Player] } | null = null;

  // Try all 2-from-M × 2-from-F combinations
  for (let mi = 0; mi < topM.length - 1; mi++) {
    for (let mj = mi + 1; mj < topM.length; mj++) {
      for (let fi = 0; fi < topF.length - 1; fi++) {
        for (let fj = fi + 1; fj < topF.length; fj++) {
          const fourPlayers = [topM[mi], topM[mj], topF[fi], topF[fj]];

          // Try both team splits: (M1+F1 vs M2+F2) and (M1+F2 vs M2+F1)
          const splits: [Player, Player, Player, Player][] = [
            [topM[mi], topF[fi], topM[mj], topF[fj]],
            [topM[mi], topF[fj], topM[mj], topF[fi]],
          ];

          for (const [a1, a2, b1, b2] of splits) {
            const score = scoreAssignment(
              [a1, a2], [b1, b2], config, pairLookup,
            );
            if (score > bestScore) {
              bestScore = score;
              bestTeams = { team_a: [a1, a2], team_b: [b1, b2] };
            }
          }
        }
      }
    }
  }

  return bestTeams;
}

/**
 * Pick best 4 players for a doubles court
 * Prefers same-gender groups (4M or 4F), falls back to any combo
 */
function pickBestDoublesCombo(
  pool: Player[],
  config: AlgorithmConfig,
  pairLookup: Map<string, number>,
): { team_a: [Player, Player]; team_b: [Player, Player] } | null {
  const males = pool.filter((p) => p.gender === "male");
  const females = pool.filter((p) => p.gender === "female");

  // Prefer whichever gender has more players available
  const genderPools = males.length >= females.length
    ? [males, females]
    : [females, males];

  for (const gPool of genderPools) {
    if (gPool.length < 4) continue;
    const result = pickBest4FromPool(gPool.slice(0, Math.min(8, gPool.length)), config, pairLookup);
    if (result) return result;
  }

  // Fallback to any combo only if strict_gender is off
  if (!config.strict_gender && pool.length >= 4) {
    return pickBest4FromPool(pool.slice(0, Math.min(8, pool.length)), config, pairLookup);
  }

  return null;
}

function pickBest4FromPool(
  top: Player[],
  config: AlgorithmConfig,
  pairLookup: Map<string, number>,
): { team_a: [Player, Player]; team_b: [Player, Player] } | null {
  if (top.length < 4) return null;

  let bestScore = -Infinity;
  let bestTeams: { team_a: [Player, Player]; team_b: [Player, Player] } | null = null;

  // Try all 4-from-N combinations
  for (let a = 0; a < top.length - 3; a++) {
    for (let b = a + 1; b < top.length - 2; b++) {
      for (let c = b + 1; c < top.length - 1; c++) {
        for (let d = c + 1; d < top.length; d++) {
          const four = [top[a], top[b], top[c], top[d]];
          // Try 3 possible team splits
          const splits: [[number, number], [number, number]][] = [
            [[0, 1], [2, 3]],
            [[0, 2], [1, 3]],
            [[0, 3], [1, 2]],
          ];

          for (const [t1, t2] of splits) {
            const team_a: [Player, Player] = [four[t1[0]], four[t1[1]]];
            const team_b: [Player, Player] = [four[t2[0]], four[t2[1]]];
            const score = scoreAssignment(team_a, team_b, config, pairLookup);
            if (score > bestScore) {
              bestScore = score;
              bestTeams = { team_a, team_b };
            }
          }
        }
      }
    }
  }

  return bestTeams;
}

/**
 * Score a court assignment (higher = better)
 */
function scoreAssignment(
  teamA: [Player, Player],
  teamB: [Player, Player],
  config: AlgorithmConfig,
  pairLookup: Map<string, number>,
): number {
  const all = [...teamA, ...teamB];

  // 1. Skill balance: lower variance across teams = better
  //    Compare average level of each team
  const avgA = (teamA[0].level + teamA[1].level) / 2;
  const avgB = (teamB[0].level + teamB[1].level) / 2;
  const levelDiff = Math.abs(avgA - avgB);
  // Max diff is 4 (lvl 1 vs 5), normalize to 0-1
  const skillScore = 1 - levelDiff / 4;

  // 2. Partner variety: penalize repeat pairings within teams
  const pairScoreA = getPairPenalty(teamA[0].id, teamA[1].id, pairLookup);
  const pairScoreB = getPairPenalty(teamB[0].id, teamB[1].id, pairLookup);
  // Also consider cross-team (opponent) variety but weight less
  const opponentPairs = [
    getPairPenalty(teamA[0].id, teamB[0].id, pairLookup),
    getPairPenalty(teamA[0].id, teamB[1].id, pairLookup),
    getPairPenalty(teamA[1].id, teamB[0].id, pairLookup),
    getPairPenalty(teamA[1].id, teamB[1].id, pairLookup),
  ];
  const avgOpponentPenalty = opponentPairs.reduce((a, b) => a + b, 0) / 4;
  // Partner variety score: 0 = lots of repeats, 1 = no repeats
  const varietyScore = 1 - (pairScoreA + pairScoreB + avgOpponentPenalty * 0.3) / 2.3;

  // 3. Fairness: prefer players with fewer games (already handled by pre-sorting,
  //    but add a small bonus for lower total games)
  const totalGames = all.reduce((sum, p) => sum + p.games_played, 0);
  const fairnessScore = 1 / (1 + totalGames * 0.05);

  // Weighted combination
  const wSkill = config.skill_balance / 100;
  const wVariety = config.partner_variety / 100;
  const wFairness = 0.3; // always matters

  return (
    wSkill * skillScore +
    wVariety * varietyScore +
    wFairness * fairnessScore
  );
}

/**
 * Get repeat penalty for a pair (0 = never paired, approaches 1 = many repeats)
 */
function getPairPenalty(id1: string, id2: string, lookup: Map<string, number>): number {
  const times = lookup.get(pairKey(id1, id2)) || 0;
  // Diminishing returns: 1 repeat = 0.5, 2 = 0.67, 3 = 0.75...
  return times / (times + 1);
}

/**
 * Generate partner history updates from assignments
 */
export function extractPairs(
  assignments: CourtAssignment[],
): Array<{ player1_id: string; player2_id: string }> {
  const pairs: Array<{ player1_id: string; player2_id: string }> = [];

  for (const court of assignments) {
    const allPlayers = [...court.team_a, ...court.team_b];
    // Record all pair combinations (teammate + opponent)
    for (let i = 0; i < allPlayers.length - 1; i++) {
      for (let j = i + 1; j < allPlayers.length; j++) {
        const [p1, p2] =
          allPlayers[i].id < allPlayers[j].id
            ? [allPlayers[i].id, allPlayers[j].id]
            : [allPlayers[j].id, allPlayers[i].id];
        pairs.push({ player1_id: p1, player2_id: p2 });
      }
    }
  }

  return pairs;
}
