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
  gameTypeHistory?: { mixed: number; doubles: number },
): CourtAssignment[] {
  const available = players.filter((p) => true); // all players are candidates

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

  // Gender-aware selection: figure out how many of each gender we need
  // based on expected game types, to avoid leaving unfillable courts
  const allMales = adjusted.filter(p => p.gender === "male");
  const allFemales = adjusted.filter(p => p.gender === "female");
  const allUnknown = adjusted.filter(p => p.gender === null);
  const needed = actualCourts * 4;

  // Compute play-count equity: which gender is behind?
  const avgPlayM = allMales.length > 0
    ? allMales.reduce((s, p) => s + p.effective_games, 0) / allMales.length : 0;
  const avgPlayF = allFemales.length > 0
    ? allFemales.reduce((s, p) => s + p.effective_games, 0) / allFemales.length : 0;
  const deficitGender = avgPlayF < avgPlayM ? "female" : avgPlayM < avgPlayF ? "male" : null;
  const playGap = Math.abs(avgPlayM - avgPlayF);

  // Pre-calculate mixed/doubles split to know gender needs
  const maxMixed = Math.min(Math.floor(allMales.length / 2), Math.floor(allFemales.length / 2), actualCourts);
  const targetMixed = Math.round((config.mixed_ratio / 100) * actualCourts);
  let plannedMixed = Math.min(targetMixed, maxMixed);
  let plannedDoubles = actualCourts - plannedMixed;

  // Equity adjustment: if a gender is behind and can't fill a doubles court
  // with the current mixed allocation, reduce mixed by 1 to free up 2 more
  // of that gender. Only do this when there's a meaningful gap (>= 2 games).
  if (deficitGender && playGap >= 2 && plannedMixed > 0 && plannedDoubles > 0) {
    const deficitTotal = deficitGender === "female" ? allFemales.length : allMales.length;
    const deficitUsedByMixed = plannedMixed * 2;
    const deficitRemaining = deficitTotal - deficitUsedByMixed;

    // Can't fill a same-gender doubles with current allocation — reduce mixed
    if (deficitRemaining < 4 && deficitTotal >= (plannedMixed - 1) * 2 + 4) {
      plannedMixed -= 1;
      plannedDoubles += 1;
      console.log(`[engine] Equity adjustment: reduced mixed to ${plannedMixed} to allow ${deficitGender} doubles (gap=${playGap.toFixed(1)})`);
    }
  }

  // Mixed courts need 2M+2F each; doubles need 4 same-gender each
  let needM = plannedMixed * 2;
  let needF = plannedMixed * 2;

  // For doubles: prefer the deficit gender so they catch up
  for (let d = 0; d < plannedDoubles; d++) {
    const canM = allMales.length >= needM + 4;
    const canF = allFemales.length >= needF + 4;

    if (deficitGender === "female" && canF) {
      needF += 4;
    } else if (deficitGender === "male" && canM) {
      needM += 4;
    } else if (canM) {
      needM += 4;
    } else if (canF) {
      needF += 4;
    } else {
      // Can't fill with same gender — will fall back to mixed in assignToCourts
      needM += 2;
      needF += 2;
    }
  }

  // Select the right number of each gender, sorted by priority
  const selectedM = allMales.slice(0, Math.min(needM, allMales.length));
  const selectedF = allFemales.slice(0, Math.min(needF, allFemales.length));
  const selectedU = allUnknown.slice(0, Math.max(0, needed - selectedM.length - selectedF.length));
  const selected = [...selectedM, ...selectedF, ...selectedU].slice(0, needed);
  
  console.log(`[engine] Gender-aware selection: need ${needM}M + ${needF}F for ${plannedMixed} mixed + ${plannedDoubles} doubles courts`);

  const selMales = selected.filter(p => p.gender === "male").length;
  const selFemales = selected.filter(p => p.gender === "female").length;
  const selNull = selected.filter(p => p.gender === null).length;
  console.log(`[engine] Selected ${selected.length} players: ${selMales}M, ${selFemales}F, ${selNull}null`);

  // Build game types from our planned split (respects equity adjustment)
  const gameTypes: Array<"mixed" | "doubles"> = [];
  for (let i = 0; i < plannedMixed; i++) gameTypes.push("mixed");
  for (let i = plannedMixed; i < actualCourts; i++) gameTypes.push("doubles");
  console.log(`[engine] Game types: ${gameTypes.join(", ")}`);

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
  gameTypeHistory?: { mixed: number; doubles: number },
): Array<"mixed" | "doubles"> {
  const males = players.filter((p) => p.gender === "male").length;
  const females = players.filter((p) => p.gender === "female").length;

  // Max possible mixed courts (each needs at least 1M + 1F per team = 2M + 2F)
  const maxMixed = Math.min(Math.floor(males / 2), Math.floor(females / 2), numCourts);

  // Calculate target based on CUMULATIVE ratio across the session
  const pastMixed = gameTypeHistory?.mixed ?? 0;
  const pastDoubles = gameTypeHistory?.doubles ?? 0;
  const pastTotal = pastMixed + pastDoubles;

  // How many mixed games should there be after this round?
  const futureTotal = pastTotal + numCourts;
  const targetTotalMixed = Math.round((mixedRatio / 100) * futureTotal);
  const targetThisRound = Math.max(0, Math.min(numCourts, targetTotalMixed - pastMixed));
  const actualMixed = Math.min(targetThisRound, maxMixed);

  console.log(`[engine] decideGameTypes: ${numCourts} courts, mixedRatio=${mixedRatio}, past=${pastMixed}mixed/${pastDoubles}doubles, targetThisRound=${targetThisRound}, actualMixed=${actualMixed}`);
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
    console.log(`[engine] Court ${i}: could not fill (doublesPool=${doublesPool.length}, M=${doublesPool.filter(p=>p.gender==="male").length}, F=${doublesPool.filter(p=>p.gender==="female").length})`);
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

  // Prefer the gender with lower average play count (equity-first).
  // Fall back to majority gender if play counts are equal.
  const avgM = males.length > 0 ? males.reduce((s, p) => s + p.games_played, 0) / males.length : Infinity;
  const avgF = females.length > 0 ? females.reduce((s, p) => s + p.games_played, 0) / females.length : Infinity;
  const genderPools = avgF < avgM
    ? [females, males]
    : avgM < avgF
      ? [males, females]
      : males.length >= females.length
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
