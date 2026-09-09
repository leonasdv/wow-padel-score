import { makeId } from './id';
import type {
  Court,
  FixedTeam,
  Format,
  Gender,
  Match,
  Player,
  Round,
  Standing,
  WowEvent,
} from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function removeFromArray<T>(arr: T[], item: T) {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
}

export function estimateRounds(playerCount: number, courtCount: number): number {
  if (playerCount < 4 || courtCount < 1) return 0;
  return Math.max(4, Math.min(20, Math.ceil((playerCount - 1) / 2)));
}

export function isRankingBased(format: Format): boolean {
  return format === 'mexicano' || format === 'mixicano';
}

/** Fixed-roster formats where each roster entry already represents a complete team. */
export function isTeamFormat(format: Format): boolean {
  return format === 'team_americano' || format === 'team_mexicano';
}

/**
 * Picks which players sit out this round, favoring those who have played the fewest matches so far.
 * When `cap` is set, anyone who has already reached it is forced to sit out — regardless of how much
 * spare court capacity is left — so nobody exceeds the target matches-per-player count.
 */
function pickSitOuts(
  players: Player[],
  playCount: Record<string, number>,
  capacityPerRound: number,
  requireEvenGender: boolean,
  cap?: number
): { active: Player[]; sitOuts: Player[] } {
  const eligible = cap != null ? players.filter((p) => (playCount[p.id] ?? 0) < cap) : players;
  const capped = cap != null ? players.filter((p) => (playCount[p.id] ?? 0) >= cap) : [];

  if (requireEvenGender) {
    const byLeastPlayed = (a: Player, b: Player) => (playCount[a.id] ?? 0) - (playCount[b.id] ?? 0);
    const males = shuffle(eligible.filter((p) => p.gender === 'M')).sort(byLeastPlayed);
    const females = shuffle(eligible.filter((p) => p.gender === 'F')).sort(byLeastPlayed);
    const maxPairsPerGender = Math.floor(capacityPerRound / 4) * 2;
    let used = Math.min(males.length, females.length, maxPairsPerGender);
    if (used % 2 !== 0) used -= 1;
    used = Math.max(used, 0);
    const active = [...males.slice(0, used), ...females.slice(0, used)];
    const sitOuts = [...males.slice(used), ...females.slice(used), ...capped];
    return { active, sitOuts };
  }
  const sorted = shuffle(eligible).sort((a, b) => (playCount[a.id] ?? 0) - (playCount[b.id] ?? 0));
  const usable = Math.min(sorted.length, capacityPerRound) - (Math.min(sorted.length, capacityPerRound) % 4);
  return { active: sorted.slice(0, usable), sitOuts: [...sorted.slice(usable), ...capped] };
}

/** Greedily builds courts of 4 (two teams of 2), minimizing repeat partners/opponents seen so far. */
function buildQuartets(
  playingIds: string[],
  partnerCount: Record<string, number>,
  opponentCount: Record<string, number>,
  genderOf?: (id: string) => 'M' | 'F'
): { teamA: string[]; teamB: string[] }[] {
  const remaining = shuffle(playingIds);
  const quartets: { teamA: string[]; teamB: string[] }[] = [];

  while (remaining.length >= 4) {
    const p1 = remaining.shift()!;
    const partnerPool = genderOf ? remaining.filter((c) => genderOf(c) !== genderOf(p1)) : remaining;
    let partner = partnerPool[0];
    let bestPartnerScore = Infinity;
    for (const c of partnerPool) {
      const score = partnerCount[pairKey(p1, c)] ?? 0;
      if (score < bestPartnerScore) {
        bestPartnerScore = score;
        partner = c;
      }
    }
    removeFromArray(remaining, partner);

    let bestPair: [string, string] | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const a = remaining[i];
        const b = remaining[j];
        if (genderOf && genderOf(a) === genderOf(b)) continue;
        const score =
          (opponentCount[pairKey(p1, a)] ?? 0) +
          (opponentCount[pairKey(p1, b)] ?? 0) +
          (opponentCount[pairKey(partner, a)] ?? 0) +
          (opponentCount[pairKey(partner, b)] ?? 0) +
          (partnerCount[pairKey(a, b)] ?? 0) * 2;
        if (score < bestScore) {
          bestScore = score;
          bestPair = [a, b];
        }
      }
    }
    if (!bestPair) bestPair = [remaining[0], remaining[1]];
    removeFromArray(remaining, bestPair[0]);
    removeFromArray(remaining, bestPair[1]);

    quartets.push({ teamA: [p1, partner], teamB: bestPair });
    partnerCount[pairKey(p1, partner)] = (partnerCount[pairKey(p1, partner)] ?? 0) + 1;
    partnerCount[pairKey(bestPair[0], bestPair[1])] = (partnerCount[pairKey(bestPair[0], bestPair[1])] ?? 0) + 1;
    for (const a of [p1, partner]) {
      for (const b of bestPair) {
        opponentCount[pairKey(a, b)] = (opponentCount[pairKey(a, b)] ?? 0) + 1;
      }
    }
  }
  return quartets;
}

interface RotationHistory {
  partnerCount: Record<string, number>;
  opponentCount: Record<string, number>;
  playCount: Record<string, number>;
}

/** Rebuilds partner/opponent/play-count history from a format's existing rounds, so extending a schedule keeps minimizing repeats instead of restarting from zero. */
export function deriveRotationHistory(players: Player[], rounds: Round[]): RotationHistory {
  const partnerCount: Record<string, number> = {};
  const opponentCount: Record<string, number> = {};
  const playCount: Record<string, number> = {};
  players.forEach((p) => (playCount[p.id] = 0));
  for (const round of rounds) {
    for (const m of round.matches) {
      const [a1, a2] = m.teamA;
      const [b1, b2] = m.teamB;
      if (a2 !== undefined) partnerCount[pairKey(a1, a2)] = (partnerCount[pairKey(a1, a2)] ?? 0) + 1;
      if (b2 !== undefined) partnerCount[pairKey(b1, b2)] = (partnerCount[pairKey(b1, b2)] ?? 0) + 1;
      for (const a of m.teamA) {
        for (const b of m.teamB) {
          opponentCount[pairKey(a, b)] = (opponentCount[pairKey(a, b)] ?? 0) + 1;
        }
      }
    }
    for (const pid of [...round.matches.flatMap((m) => [...m.teamA, ...m.teamB])]) {
      playCount[pid] = (playCount[pid] ?? 0) + 1;
    }
  }
  return { partnerCount, opponentCount, playCount };
}

/** Hard ceiling on generated rounds when chasing a matches-per-player target, so a stuck/impossible target can't loop forever. */
const MAX_TARGET_ROUNDS = 300;

/**
 * Pre-generates a rotation schedule for formats that don't depend on live scores (Americano / Mix Americano).
 * Pass `seed` (from deriveRotationHistory) to continue an existing schedule fairly instead of restarting
 * history from zero.
 *
 * If `matchesPerPlayer` is set, `totalRounds` is ignored: rounds are generated until every player has played
 * exactly that many matches, forcing anyone who's reached it to sit out even if that leaves courts idle —
 * so the final round(s) may only fill some of the available courts.
 */
export function generateRotationSchedule(
  format: Format,
  players: Player[],
  courts: Court[],
  totalRounds: number,
  startIndex = 0,
  seed?: RotationHistory,
  matchesPerPlayer?: number
): Round[] {
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const genderOf = format === 'mix_americano' ? (id: string) => playersById[id].gender : undefined;
  const partnerCount: Record<string, number> = { ...(seed?.partnerCount ?? {}) };
  const opponentCount: Record<string, number> = { ...(seed?.opponentCount ?? {}) };
  const playCount: Record<string, number> = { ...(seed?.playCount ?? {}) };
  players.forEach((p) => (playCount[p.id] = playCount[p.id] ?? 0));
  const capacity = courts.length * 4;
  const rounds: Round[] = [];

  const roundLimit = matchesPerPlayer != null ? MAX_TARGET_ROUNDS : totalRounds;
  for (let r = 1; r <= roundLimit; r++) {
    if (matchesPerPlayer != null && players.every((p) => (playCount[p.id] ?? 0) >= matchesPerPlayer)) break;
    const { active, sitOuts } = pickSitOuts(players, playCount, capacity, format === 'mix_americano', matchesPerPlayer);
    if (active.length < 4) break; // not enough players left needing a match to fill one — target unreachable for the rest
    const quartets = buildQuartets(active.map((p) => p.id), partnerCount, opponentCount, genderOf);
    const matches: Match[] = quartets.map((q, i) => ({
      courtId: courts[i].id,
      teamA: q.teamA,
      teamB: q.teamB,
      scoreA: null,
      scoreB: null,
    }));
    active.forEach((p) => (playCount[p.id] += 1));
    rounds.push({ index: startIndex + r, matches, sitOuts: sitOuts.map((p) => p.id), completed: false });
  }
  return rounds;
}

/**
 * Team Americano treats each roster entry as an already-complete team (an entry's name may
 * represent two real people, e.g. "Leon & Sinta") — entries are never auto-paired with each other.
 */
export function createFixedTeams(players: Player[]): FixedTeam[] {
  return players.map((p) => ({ id: makeId('team'), playerIds: [p.id] }));
}

/** Roster entries eligible for future matches — benched players/teams stay in the roster but never get scheduled. */
function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => !p.benched);
}

/** Fixed teams whose player isn't currently benched — same idea as {@link activePlayers} for team formats. */
function activeFixedTeams(fixedTeams: FixedTeam[], players: Player[]): FixedTeam[] {
  const benchedIds = new Set(players.filter((p) => p.benched).map((p) => p.id));
  return fixedTeams.filter((t) => !t.playerIds.some((pid) => benchedIds.has(pid)));
}

interface TeamHistory {
  appearances: Record<string, number>;
  opponentCount: Record<string, number>;
}

/** Reconstruct per-team appearance and opponent counts from existing rounds, so extending/reshuffling a Team Americano keeps the rotation fair. */
export function deriveTeamHistory(fixedTeams: FixedTeam[], rounds: Round[]): TeamHistory {
  const teamOfPlayer: Record<string, string> = {};
  fixedTeams.forEach((t) => t.playerIds.forEach((pid) => (teamOfPlayer[pid] = t.id)));
  const appearances: Record<string, number> = {};
  const opponentCount: Record<string, number> = {};
  fixedTeams.forEach((t) => (appearances[t.id] = 0));
  for (const round of rounds) {
    for (const m of round.matches) {
      const ta = teamOfPlayer[m.teamA[0]];
      const tb = teamOfPlayer[m.teamB[0]];
      if (ta) appearances[ta] = (appearances[ta] ?? 0) + 1;
      if (tb) appearances[tb] = (appearances[tb] ?? 0) + 1;
      if (ta && tb) opponentCount[pairKey(ta, tb)] = (opponentCount[pairKey(ta, tb)] ?? 0) + 1;
    }
  }
  return { appearances, opponentCount };
}

/** Greedily pairs teams for one round, preferring opponents they've faced least. */
function pairTeamsMinRepeat(teamIds: string[], opponentCount: Record<string, number>): [string, string][] {
  const remaining = shuffle(teamIds);
  const pairs: [string, string][] = [];
  while (remaining.length >= 2) {
    const a = remaining.shift()!;
    let best = remaining[0];
    let bestScore = Infinity;
    for (const b of remaining) {
      const score = opponentCount[pairKey(a, b)] ?? 0;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    removeFromArray(remaining, best);
    pairs.push([a, best]);
    opponentCount[pairKey(a, best)] = (opponentCount[pairKey(a, best)] ?? 0) + 1;
  }
  return pairs;
}

/**
 * Fair Team Americano scheduler. Each round it seats the teams that have played the fewest
 * matches so far (guaranteeing equal matches & equal rest to within one game), fills every
 * available court, and pairs seated teams to minimize rematches. `seed` continues an existing
 * schedule fairly (used when extending / reshuffling).
 *
 * If `matchesPerTeam` is set, `totalRounds` is ignored: rounds are generated until every team has
 * played exactly that many matches, forcing anyone who's reached it to rest even if that leaves
 * courts idle — so the final round(s) may only fill some of the available courts.
 */
export function generateTeamAmericanoSchedule(
  fixedTeams: FixedTeam[],
  courts: Court[],
  totalRounds: number,
  startIndex = 0,
  seed?: TeamHistory,
  matchesPerTeam?: number
): Round[] {
  const teamsById = Object.fromEntries(fixedTeams.map((t) => [t.id, t]));
  const teamIds = fixedTeams.map((t) => t.id);
  const appearances: Record<string, number> = { ...(seed?.appearances ?? {}) };
  const opponentCount: Record<string, number> = { ...(seed?.opponentCount ?? {}) };
  teamIds.forEach((id) => (appearances[id] = appearances[id] ?? 0));

  const rounds: Round[] = [];
  const roundLimit = matchesPerTeam != null ? MAX_TARGET_ROUNDS : totalRounds;

  for (let r = 1; r <= roundLimit; r++) {
    const eligible = matchesPerTeam != null ? teamIds.filter((id) => (appearances[id] ?? 0) < matchesPerTeam) : teamIds;
    if (matchesPerTeam != null && eligible.length < 2) break; // one team left needing a match — no opponent available
    const capped = matchesPerTeam != null ? teamIds.filter((id) => (appearances[id] ?? 0) >= matchesPerTeam) : [];

    const matchesThisRound = Math.min(courts.length, Math.floor(eligible.length / 2));
    if (matchesThisRound === 0) break;
    const teamsPerRound = matchesThisRound * 2;

    // Seat the least-played teams first (shuffle breaks ties fairly).
    const ordered = shuffle(eligible).sort((a, b) => (appearances[a] ?? 0) - (appearances[b] ?? 0));
    const playing = ordered.slice(0, teamsPerRound);
    const resting = [...ordered.slice(teamsPerRound), ...capped];
    const pairs = pairTeamsMinRepeat(playing, opponentCount);
    const matches: Match[] = pairs.map((pair, ci) => ({
      courtId: courts[ci].id,
      teamA: teamsById[pair[0]].playerIds,
      teamB: teamsById[pair[1]].playerIds,
      scoreA: null,
      scoreB: null,
    }));
    playing.forEach((id) => (appearances[id] = (appearances[id] ?? 0) + 1));
    const sitOuts = resting.flatMap((id) => teamsById[id].playerIds);
    rounds.push({ index: startIndex + r, matches, sitOuts, completed: false });
  }
  return rounds;
}

export function computeStandings(event: WowEvent): Standing[] {
  if (event.format === 'knockout') return computeKnockoutStandings(event);
  const map: Record<string, Standing> = {};
  event.players.forEach((p) => (map[p.id] = { player: p, played: 0, wins: 0, draws: 0, points: 0 }));
  for (const round of event.rounds) {
    for (const m of round.matches) {
      if (m.scoreA == null || m.scoreB == null) continue;
      const aWin = m.scoreA > m.scoreB;
      const bWin = m.scoreB > m.scoreA;
      const draw = m.scoreA === m.scoreB;
      for (const pid of m.teamA) {
        const s = map[pid];
        if (!s) continue;
        s.played += 1;
        s.points += m.scoreA;
        if (aWin) s.wins += 1;
        if (draw) s.draws += 1;
      }
      for (const pid of m.teamB) {
        const s = map[pid];
        if (!s) continue;
        s.played += 1;
        s.points += m.scoreB;
        if (bWin) s.wins += 1;
        if (draw) s.draws += 1;
      }
    }
  }
  return Object.values(map);
}

/** League points (win=3, draw=1, loss=0) per match played — normalizes players who played fewer games. */
export function leaguePointsPerMatch(s: Standing): number {
  if (s.played === 0) return 0;
  return (s.wins * 3 + s.draws) / s.played;
}

export function matchLosses(s: Standing): number {
  return s.played - s.wins - s.draws;
}

/**
 * Head-to-head win counts between two players/teams, counting only matches where they were on
 * opposing teams (doubles rotations mean the same two people may or may not have faced each
 * other directly, possibly more than once). Teammate-only matches don't count.
 */
function headToHeadRecord(rounds: Round[], ownId: string, otherId: string): { ownWins: number; otherWins: number } {
  let ownWins = 0;
  let otherWins = 0;
  for (const round of rounds) {
    for (const m of round.matches) {
      if (m.scoreA == null || m.scoreB == null) continue;
      const ownOnA = m.teamA.includes(ownId);
      const ownOnB = m.teamB.includes(ownId);
      const otherOnA = m.teamA.includes(otherId);
      const otherOnB = m.teamB.includes(otherId);
      if (!(ownOnA || ownOnB) || !(otherOnA || otherOnB)) continue;
      if ((ownOnA && otherOnA) || (ownOnB && otherOnB)) continue; // same team — not a head-to-head match
      const ownScore = ownOnA ? m.scoreA : m.scoreB;
      const otherScore = otherOnA ? m.scoreA : m.scoreB;
      if (ownScore > otherScore) ownWins += 1;
      else if (otherScore > ownScore) otherWins += 1;
    }
  }
  return { ownWins, otherWins };
}

/**
 * Net head-to-head result between two players/teams — positive means `other` won more of their
 * direct meetings. Matches the `b.X - a.X` descending comparator convention used elsewhere in
 * `sortStandings` (so it can be dropped straight into an `||` comparator chain).
 */
export function headToHeadCompare(rounds: Round[], ownId: string, otherId: string): number {
  const { ownWins, otherWins } = headToHeadRecord(rounds, ownId, otherId);
  return otherWins - ownWins;
}

export function sortStandings(standings: Standing[], sortBy: 'points' | 'wins' | 'league', rounds: Round[] = []): Standing[] {
  return [...standings].sort((a, b) => {
    if (sortBy === 'points') {
      return (
        b.points - a.points ||
        leaguePointsPerMatch(b) - leaguePointsPerMatch(a) ||
        b.wins - a.wins ||
        b.draws - a.draws ||
        matchLosses(a) - matchLosses(b) ||
        headToHeadCompare(rounds, a.player.id, b.player.id)
      );
    }
    if (sortBy === 'wins') return b.wins - a.wins || b.points - a.points;
    return leaguePointsPerMatch(b) - leaguePointsPerMatch(a) || b.wins - a.wins || b.points - a.points;
  });
}

export type TiebreakCriterion = 'headToHead' | 'league' | 'wins' | 'ties' | 'losses' | 'tied';

export interface TiebreakReason {
  criterion: TiebreakCriterion;
  ownValue: number;
  otherValue: number;
  /** true if `standing` ranks ahead of `other` per this criterion (and thus overall, since points already match). */
  aheadOfOther: boolean;
}

/**
 * Explains why two same-points standings ended up in the order they did, following the same
 * points → league score (PPM) → wins → ties → fewer losses → head-to-head chain used by
 * `sortStandings`'s 'points' mode. Returns null if the two aren't actually tied on points.
 */
export function describeTiebreak(standing: Standing, other: Standing, rounds: Round[] = []): TiebreakReason | null {
  if (standing.points !== other.points) return null;
  const ownLeague = leaguePointsPerMatch(standing);
  const otherLeague = leaguePointsPerMatch(other);
  if (ownLeague !== otherLeague) return { criterion: 'league', ownValue: ownLeague, otherValue: otherLeague, aheadOfOther: ownLeague > otherLeague };
  if (standing.wins !== other.wins) return { criterion: 'wins', ownValue: standing.wins, otherValue: other.wins, aheadOfOther: standing.wins > other.wins };
  if (standing.draws !== other.draws) return { criterion: 'ties', ownValue: standing.draws, otherValue: other.draws, aheadOfOther: standing.draws > other.draws };
  const ownLosses = matchLosses(standing);
  const otherLosses = matchLosses(other);
  if (ownLosses !== otherLosses) return { criterion: 'losses', ownValue: ownLosses, otherValue: otherLosses, aheadOfOther: ownLosses < otherLosses };
  const { ownWins: ownH2H, otherWins: otherH2H } = headToHeadRecord(rounds, standing.player.id, other.player.id);
  if (ownH2H !== otherH2H) return { criterion: 'headToHead', ownValue: ownH2H, otherValue: otherH2H, aheadOfOther: ownH2H > otherH2H };
  return { criterion: 'tied', ownValue: 0, otherValue: 0, aheadOfOther: false };
}

/**
 * Picks the fairest of a quartet's 3 possible 2v2 splits — same-partner and same-opponent history
 * both penalized, repeat partners weighted far more heavily since staying fresh every round is the
 * whole point of individual Mexicano (unlike Team Mexicano, whose teams are fixed by design). Ties
 * default to the conventional rank1&4-vs-rank2&3 split (the widely-documented Mexicano rule) so the
 * "smart" pick only kicks in when history actually calls for it.
 */
function bestQuartetSplit(
  quartet: [string, string, string, string],
  partnerCount: Record<string, number>,
  opponentCount: Record<string, number>
): { teamA: [string, string]; teamB: [string, string] } {
  const [r1, r2, r3, r4] = quartet;
  const options: [[string, string], [string, string]][] = [
    [[r1, r4], [r2, r3]], // conventional: top+bottom vs the middle two
    [[r1, r2], [r3, r4]],
    [[r1, r3], [r2, r4]],
  ];
  let best = options[0];
  let bestScore = Infinity;
  for (const [teamA, teamB] of options) {
    const partnerRepeats = (partnerCount[pairKey(...teamA)] ?? 0) + (partnerCount[pairKey(...teamB)] ?? 0);
    const opponentRepeats =
      (opponentCount[pairKey(teamA[0], teamB[0])] ?? 0) +
      (opponentCount[pairKey(teamA[0], teamB[1])] ?? 0) +
      (opponentCount[pairKey(teamA[1], teamB[0])] ?? 0) +
      (opponentCount[pairKey(teamA[1], teamB[1])] ?? 0);
    const score = partnerRepeats * 100 + opponentRepeats;
    if (score < bestScore) {
      bestScore = score;
      best = [teamA, teamB];
    }
  }
  return { teamA: best[0], teamB: best[1] };
}

function generateRankingRound(
  format: 'mexicano' | 'mixicano',
  players: Player[],
  courts: Court[],
  roundIndex: number,
  standings: Standing[],
  rounds: Round[],
  matchesPerPlayer?: number
): Round {
  const byId = Object.fromEntries(standings.map((s) => [s.player.id, s]));
  const playCount: Record<string, number> = Object.fromEntries(players.map((p) => [p.id, byId[p.id]?.played ?? 0]));
  const capacity = courts.length * 4;
  const pointsOf = (p: Player) => byId[p.id]?.points ?? 0;
  // Points per match played so far — used (mexicano only) instead of raw points so a recent bye
  // doesn't bury a player who simply hasn't rotated back onto court as often yet.
  const rateOf = (p: Player) => {
    const s = byId[p.id];
    return s && s.played > 0 ? s.points / s.played : 0;
  };

  if (format === 'mixicano') {
    const { active, sitOuts } = pickSitOuts(players, playCount, capacity, true, matchesPerPlayer);
    const males = active.filter((p) => p.gender === 'M').sort((a, b) => pointsOf(b) - pointsOf(a));
    const females = active.filter((p) => p.gender === 'F').sort((a, b) => pointsOf(b) - pointsOf(a));
    const n = Math.min(males.length, females.length);
    const teams: { players: [string, string]; pts: number }[] = [];
    for (let i = 0; i < n; i++) {
      teams.push({ players: [males[i].id, females[i].id], pts: pointsOf(males[i]) + pointsOf(females[i]) });
    }
    teams.sort((a, b) => b.pts - a.pts);
    const matches: Match[] = [];
    for (let i = 0; i + 1 < teams.length && matches.length < courts.length; i += 2) {
      matches.push({
        courtId: courts[matches.length].id,
        teamA: teams[i].players,
        teamB: teams[i + 1].players,
        scoreA: null,
        scoreB: null,
      });
    }
    const usedIds = new Set(matches.flatMap((m) => [...m.teamA, ...m.teamB]));
    const sitOutIds = new Set(sitOuts.map((p) => p.id));
    players.forEach((p) => {
      if (!usedIds.has(p.id)) sitOutIds.add(p.id);
    });
    return { index: roundIndex, matches, sitOuts: [...sitOutIds], completed: false };
  }

  // mexicano — same fairness DNA as Team Mexicano (rank by rate, seat the least-rested first,
  // weaker player rests on a tie), plus quartet-level history avoidance since individuals get
  // freshly re-partnered every round instead of staying in a fixed team.
  const eligible = matchesPerPlayer != null ? players.filter((p) => (playCount[p.id] ?? 0) < matchesPerPlayer) : players;
  const capped = matchesPerPlayer != null ? players.filter((p) => (playCount[p.id] ?? 0) >= matchesPerPlayer) : [];
  const seatingOrder = shuffle(eligible).sort(
    (a, b) => (playCount[a.id] ?? 0) - (playCount[b.id] ?? 0) || rateOf(b) - rateOf(a)
  );
  const usable = Math.min(seatingOrder.length, capacity) - (Math.min(seatingOrder.length, capacity) % 4);
  const active = seatingOrder.slice(0, usable);
  const sitOuts = [...seatingOrder.slice(usable), ...capped];

  const ranked = shuffle(active).sort((a, b) => rateOf(b) - rateOf(a));
  const { partnerCount, opponentCount } = deriveRotationHistory(players, rounds);
  const matches: Match[] = [];
  for (let i = 0; i + 4 <= ranked.length; i += 4) {
    const quartet = ranked.slice(i, i + 4).map((p) => p.id) as [string, string, string, string];
    const { teamA, teamB } = bestQuartetSplit(quartet, partnerCount, opponentCount);
    matches.push({
      courtId: courts[matches.length].id,
      teamA,
      teamB,
      scoreA: null,
      scoreB: null,
    });
  }
  const leftover = ranked.slice(matches.length * 4);
  const sitOutIds = new Set([...sitOuts.map((p) => p.id), ...leftover.map((p) => p.id)]);
  return { index: roundIndex, matches, sitOuts: [...sitOutIds], completed: false };
}

/**
 * Team Mexicano round — Swiss-adapted ladder pairing for fixed teams:
 *
 * 1. Seating (who plays this round): teams that have rested least so far get priority, so nobody
 *    sits out twice before everyone has sat out once. Ties (several teams equally due to play) go
 *    to the currently lower-ranked team first, mirroring the Swiss-system rule of handing byes to
 *    the lowest scorer who hasn't had one yet — a leader is never pulled off court ahead of a
 *    trailer sitting on the same rest count.
 * 2. Ranking (who's "on top" right now): by points *per match played*, not raw cumulative points —
 *    byes mean teams can be sitting on a different number of matches played at any given moment, so
 *    a raw total would unfairly bury a team that simply hasn't rotated onto court as often yet.
 * 3. Pairing: walk the ranked list top to bottom pairing each team with the *nearest-ranked
 *    opponent it hasn't already played* — the strongest seated teams meet on the top court, the
 *    weakest on the bottom, exactly like a Mexicano leaderboard is supposed to work — falling back
 *    to the least-repeated (then nearest-ranked) available opponent only once a repeat is
 *    unavoidable. This is the Swiss-system "avoid rematches unless mathematically forced" rule
 *    applied to a ranked ladder instead of scoring-based chess pairing.
 */
export function generateTeamMexicanoRound(
  fixedTeams: FixedTeam[],
  courts: Court[],
  roundIndex: number,
  standings: Standing[],
  history: TeamHistory,
  matchesPerTeam?: number
): Round {
  const teamsById = Object.fromEntries(fixedTeams.map((t) => [t.id, t]));
  const teamIds = fixedTeams.map((t) => t.id);
  const { appearances, opponentCount } = history;
  const standingByPlayer: Record<string, Standing> = Object.fromEntries(standings.map((s) => [s.player.id, s]));
  // Points per match played so far — falls back to 0 (treated as a tie) for a team that hasn't played yet.
  const rateOf = (teamId: string): number => {
    const s = standingByPlayer[teamsById[teamId].playerIds[0]];
    return s && s.played > 0 ? s.points / s.played : 0;
  };

  const eligible = matchesPerTeam != null ? teamIds.filter((id) => (appearances[id] ?? 0) < matchesPerTeam) : teamIds;
  const capped = matchesPerTeam != null ? teamIds.filter((id) => (appearances[id] ?? 0) >= matchesPerTeam) : [];

  const matchesThisRound = Math.min(courts.length, Math.floor(eligible.length / 2));
  const teamsPerRound = matchesThisRound * 2;

  // Seat the least-rested teams first; among ties, prioritize the currently stronger team to play
  // (so the weaker of two equally-due teams is the one pushed into the rest slot).
  const seatingOrder = shuffle(eligible).sort(
    (a, b) => (appearances[a] ?? 0) - (appearances[b] ?? 0) || rateOf(b) - rateOf(a)
  );
  const playing = seatingOrder.slice(0, teamsPerRound);
  const resting = [...seatingOrder.slice(teamsPerRound), ...capped];

  // Rank the seated teams by current form (shuffle first so ties — e.g. everyone at 0 in round 1 — land randomly).
  const ranked = shuffle(playing).sort((a, b) => rateOf(b) - rateOf(a));

  // Pair down the ranked ladder, preferring the nearest-ranked opponent not already played.
  const remaining = [...ranked];
  const pairs: [string, string][] = [];
  while (remaining.length >= 2) {
    const a = remaining.shift()!;
    let bestIdx = 0;
    let bestRepeats = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const repeats = opponentCount[pairKey(a, remaining[i])] ?? 0;
      if (repeats < bestRepeats) {
        bestRepeats = repeats;
        bestIdx = i;
        if (repeats === 0) break; // nearest-ranked never-played opponent — this round's best possible pick
      }
    }
    const b = remaining.splice(bestIdx, 1)[0];
    pairs.push([a, b]);
  }

  const matches: Match[] = pairs.map((pair, i) => ({
    courtId: courts[i].id,
    teamA: teamsById[pair[0]].playerIds,
    teamB: teamsById[pair[1]].playerIds,
    scoreA: null,
    scoreB: null,
  }));
  const sitOuts = resting.flatMap((id) => teamsById[id].playerIds);
  return { index: roundIndex, matches, sitOuts, completed: false };
}

/**
 * Whether a matches-per-player target is achievable with an exactly equal split for every
 * participant. Quartet formats need `players × target` divisible by 4 (4 players per match);
 * team_americano needs `teams × target` divisible by 2 (2 teams per match). Gendered formats
 * (Mix Americano / Mixicano) additionally need equal male/female counts, since every match pairs
 * one of each — an imbalance means the majority gender can never all reach the same count.
 */
export function matchesPerPlayerIsFeasible(format: Format, players: Player[], matchesPerPlayer: number): boolean {
  if (!Number.isFinite(matchesPerPlayer) || matchesPerPlayer <= 0) return false;
  if (isTeamFormat(format)) return (players.length * matchesPerPlayer) % 2 === 0;
  if (format === 'mix_americano' || format === 'mixicano') {
    const males = players.filter((p) => p.gender === 'M').length;
    if (males !== players.length - males) return false;
  }
  return (players.length * matchesPerPlayer) % 4 === 0;
}

/** Estimates total rounds a matches-per-player target will produce, for preview before generating. */
export function estimateRoundsForMatchesPerPlayer(format: Format, players: Player[], courts: Court[], matchesPerPlayer: number): number {
  if (format === 'knockout') return 0;
  if (isTeamFormat(format)) {
    // Round count only depends on capacity + fair appearance seating, not on how courts are paired —
    // Team Americano's scheduler gives the same count Team Mexicano's live, standings-driven rounds will need.
    return generateTeamAmericanoSchedule(createFixedTeams(players), courts, 0, 0, undefined, matchesPerPlayer).length;
  }
  const rotationFormat: Format = format === 'mixicano' ? 'mix_americano' : format === 'mexicano' ? 'americano' : format;
  return generateRotationSchedule(rotationFormat, players, courts, 0, 0, undefined, matchesPerPlayer).length;
}

export function startEvent(event: WowEvent, desiredRounds?: number, matchesPerPlayer?: number): WowEvent {
  if (event.format === 'knockout') {
    return startKnockout(event);
  }
  if (event.format === 'team_americano') {
    const fixedTeams = createFixedTeams(event.players);
    const target = desiredRounds ?? estimateRounds(event.players.length, event.courts.length);
    const rounds = generateTeamAmericanoSchedule(fixedTeams, event.courts, target, 0, undefined, matchesPerPlayer);
    return { ...event, fixedTeams, rounds, totalRoundsEstimate: rounds.length, currentRoundIndex: 1, status: 'live', matchesPerPlayer };
  }
  if (event.format === 'team_mexicano') {
    const fixedTeams = createFixedTeams(event.players);
    const round = generateTeamMexicanoRound(fixedTeams, event.courts, 1, [], { appearances: {}, opponentCount: {} }, matchesPerPlayer);
    const totalRoundsEstimate =
      matchesPerPlayer != null
        ? estimateRoundsForMatchesPerPlayer(event.format, event.players, event.courts, matchesPerPlayer)
        : (desiredRounds ?? estimateRounds(event.players.length, event.courts.length));
    return { ...event, fixedTeams, rounds: [round], totalRoundsEstimate, currentRoundIndex: 1, status: 'live', matchesPerPlayer };
  }
  if (isRankingBased(event.format)) {
    const round = generateRankingRound(event.format as 'mexicano' | 'mixicano', event.players, event.courts, 1, [], [], matchesPerPlayer);
    const totalRoundsEstimate =
      matchesPerPlayer != null
        ? estimateRoundsForMatchesPerPlayer(event.format, event.players, event.courts, matchesPerPlayer)
        : (desiredRounds ?? estimateRounds(event.players.length, event.courts.length));
    return { ...event, rounds: [round], totalRoundsEstimate, currentRoundIndex: 1, status: 'live', matchesPerPlayer };
  }
  const totalRoundsEstimate = desiredRounds ?? estimateRounds(event.players.length, event.courts.length);
  const rounds = generateRotationSchedule(event.format, event.players, event.courts, totalRoundsEstimate, 0, undefined, matchesPerPlayer);
  return { ...event, rounds, totalRoundsEstimate: rounds.length, currentRoundIndex: 1, status: 'live', matchesPerPlayer };
}

export function advanceRound(event: WowEvent): WowEvent {
  const rounds = event.rounds.map((r) => (r.index === event.currentRoundIndex ? { ...r, completed: true } : r));
  const nextIndex = event.currentRoundIndex + 1;

  if (nextIndex > event.totalRoundsEstimate) {
    return { ...event, rounds, status: 'done' };
  }
  if (event.format === 'team_mexicano') {
    const standings = computeStandings({ ...event, rounds });
    const history = deriveTeamHistory(event.fixedTeams!, rounds);
    const newRound = generateTeamMexicanoRound(activeFixedTeams(event.fixedTeams!, event.players), event.courts, nextIndex, standings, history, event.matchesPerPlayer);
    return { ...event, rounds: [...rounds, newRound], currentRoundIndex: nextIndex };
  }
  if (event.format === 'team_americano' || !isRankingBased(event.format)) {
    return { ...event, rounds, currentRoundIndex: nextIndex };
  }
  const standings = computeStandings({ ...event, rounds });
  const newRound = generateRankingRound(event.format as 'mexicano' | 'mixicano', activePlayers(event.players), event.courts, nextIndex, standings, rounds, event.matchesPerPlayer);
  return { ...event, rounds: [...rounds, newRound], currentRoundIndex: nextIndex };
}

/** Re-opens a finished event so its organizer can correct scores or keep playing. Standings and completed rounds are untouched — only `status` flips back to 'live'. */
export function reopenEvent(event: WowEvent): WowEvent {
  if (event.status !== 'done') return event;
  return { ...event, status: 'live' };
}

/** Adds more rounds once the tournament reaches its estimated end, for organizers with time left. */
export function extendRounds(event: WowEvent, additionalRounds: number): WowEvent {
  const wasFinished = event.status === 'done';

  if (event.format === 'team_americano') {
    const seed = deriveTeamHistory(event.fixedTeams!, event.rounds);
    const extra = generateTeamAmericanoSchedule(activeFixedTeams(event.fixedTeams!, event.players), event.courts, additionalRounds, event.rounds.length, seed);
    const rounds = [...event.rounds, ...extra];
    const currentRoundIndex = wasFinished ? event.currentRoundIndex + 1 : event.currentRoundIndex;
    return { ...event, rounds, totalRoundsEstimate: rounds.length, currentRoundIndex, status: 'live' };
  }
  if (event.format === 'team_mexicano') {
    const totalRoundsEstimate = event.totalRoundsEstimate + additionalRounds;
    if (!wasFinished) return { ...event, totalRoundsEstimate, status: 'live' };
    const standings = computeStandings(event);
    const history = deriveTeamHistory(event.fixedTeams!, event.rounds);
    const nextIndex = event.currentRoundIndex + 1;
    const newRound = generateTeamMexicanoRound(activeFixedTeams(event.fixedTeams!, event.players), event.courts, nextIndex, standings, history);
    return { ...event, rounds: [...event.rounds, newRound], totalRoundsEstimate, currentRoundIndex: nextIndex, status: 'live' };
  }
  if (isRankingBased(event.format)) {
    const totalRoundsEstimate = event.totalRoundsEstimate + additionalRounds;
    if (!wasFinished) return { ...event, totalRoundsEstimate, status: 'live' };
    const standings = computeStandings(event);
    const nextIndex = event.currentRoundIndex + 1;
    const newRound = generateRankingRound(event.format as 'mexicano' | 'mixicano', activePlayers(event.players), event.courts, nextIndex, standings, event.rounds);
    return { ...event, rounds: [...event.rounds, newRound], totalRoundsEstimate, currentRoundIndex: nextIndex, status: 'live' };
  }
  const seed = deriveRotationHistory(event.players, event.rounds);
  const extra = generateRotationSchedule(event.format, activePlayers(event.players), event.courts, additionalRounds, event.rounds.length, seed);
  const rounds = [...event.rounds, ...extra];
  const currentRoundIndex = wasFinished ? event.currentRoundIndex + 1 : event.currentRoundIndex;
  return { ...event, rounds, totalRoundsEstimate: rounds.length, currentRoundIndex, status: 'live' };
}

export function addPlayerMidEvent(event: WowEvent, player: Player): WowEvent {
  const players = [...event.players, player];
  const completed = event.rounds.filter((r) => r.completed);

  const remaining = Math.max(event.totalRoundsEstimate - completed.length, 1);

  if (event.format === 'team_americano') {
    const fixedTeams = createFixedTeams(players);
    const seed = deriveTeamHistory(fixedTeams, completed);
    const regenerated = generateTeamAmericanoSchedule(activeFixedTeams(fixedTeams, players), event.courts, remaining, completed.length, seed, event.matchesPerPlayer);
    const rounds = [...completed, ...regenerated];
    return { ...event, players, fixedTeams, rounds, totalRoundsEstimate: rounds.length };
  }
  if (event.format === 'team_mexicano') {
    const fixedTeams = createFixedTeams(players);
    const standings = computeStandings({ ...event, players, rounds: completed });
    const history = deriveTeamHistory(fixedTeams, completed);
    const newCurrent = generateTeamMexicanoRound(activeFixedTeams(fixedTeams, players), event.courts, event.currentRoundIndex, standings, history, event.matchesPerPlayer);
    return { ...event, players, fixedTeams, rounds: [...completed, newCurrent] };
  }
  if (!isRankingBased(event.format)) {
    const seed = deriveRotationHistory(players, completed);
    const regenerated = generateRotationSchedule(event.format, activePlayers(players), event.courts, remaining, completed.length, seed, event.matchesPerPlayer);
    const rounds = [...completed, ...regenerated];
    return { ...event, players, rounds, totalRoundsEstimate: rounds.length };
  }
  // Ranking formats keep the original totalRoundsEstimate as-is here — recomputing it against the
  // new roster would need each player's already-completed count seeded in, not just a fresh target.
  const standings = computeStandings({ ...event, players, rounds: completed });
  const newCurrent = generateRankingRound(event.format as 'mexicano' | 'mixicano', activePlayers(players), event.courts, event.currentRoundIndex, standings, completed, event.matchesPerPlayer);
  return { ...event, players, rounds: [...completed, newCurrent] };
}

/** Regenerates every not-yet-completed round with fresh randomness. Completed rounds and standings are untouched. */
export function reshuffleUpcoming(event: WowEvent): WowEvent {
  const completed = event.rounds.filter((r) => r.completed);
  const remaining = Math.max(event.totalRoundsEstimate - completed.length, 1);

  if (event.format === 'team_americano') {
    const seed = deriveTeamHistory(event.fixedTeams!, completed);
    const regenerated = generateTeamAmericanoSchedule(activeFixedTeams(event.fixedTeams!, event.players), event.courts, remaining, completed.length, seed, event.matchesPerPlayer);
    return { ...event, rounds: [...completed, ...regenerated] };
  }
  if (event.format === 'team_mexicano') {
    const standings = computeStandings({ ...event, rounds: completed });
    const history = deriveTeamHistory(event.fixedTeams!, completed);
    const cur = generateTeamMexicanoRound(activeFixedTeams(event.fixedTeams!, event.players), event.courts, event.currentRoundIndex, standings, history, event.matchesPerPlayer);
    return { ...event, rounds: [...completed, cur] };
  }
  if (!isRankingBased(event.format)) {
    const seed = deriveRotationHistory(event.players, completed);
    const regenerated = generateRotationSchedule(event.format, activePlayers(event.players), event.courts, remaining, completed.length, seed, event.matchesPerPlayer);
    return { ...event, rounds: [...completed, ...regenerated] };
  }
  // Ranking formats build one round at a time from standings — regenerate just the current round.
  const standings = computeStandings({ ...event, rounds: completed });
  const cur = generateRankingRound(event.format as 'mexicano' | 'mixicano', activePlayers(event.players), event.courts, event.currentRoundIndex, standings, completed, event.matchesPerPlayer);
  return { ...event, rounds: [...completed, cur] };
}

/**
 * Benches (or un-benches) a player/team in place. A bench never touches completed rounds or the
 * round currently in progress — even if the benched player already has a match there — it only
 * takes effect from the next round onward. For formats whose whole schedule is generated in one
 * batch upfront (Americano / Mix Americano / Team Americano), that means regenerating every round
 * after the current live one, right away, without the benched player; formats that build one round
 * at a time from live standings (Mexicano / Mixicano / Team Mexicano) have nothing pre-generated
 * beyond the live round, so flipping the flag is enough — the next round they generate (see
 * {@link advanceRound}) already leaves a benched player out, and brings them back the moment
 * they're un-benched.
 */
export function toggleBench(event: WowEvent, playerId: string): WowEvent {
  const target = event.players.find((p) => p.id === playerId);
  if (!target) return event;
  const players = event.players.map((p) => (p.id === playerId ? { ...p, benched: !p.benched } : p));
  const updated = { ...event, players };

  if (event.format === 'knockout') return updated; // bracket is fixed at creation — nothing to regenerate

  const kept = event.rounds.filter((r) => r.completed || r.index <= event.currentRoundIndex);
  const remaining = event.totalRoundsEstimate - kept.length;
  if (remaining <= 0) return updated; // current round is already the last one — nothing ahead to regenerate

  if (event.format === 'team_americano') {
    const fixedTeams = createFixedTeams(players);
    const seed = deriveTeamHistory(fixedTeams, kept);
    const regenerated = generateTeamAmericanoSchedule(activeFixedTeams(fixedTeams, players), event.courts, remaining, kept.length, seed, event.matchesPerPlayer);
    const rounds = [...kept, ...regenerated];
    return { ...updated, fixedTeams, rounds, totalRoundsEstimate: rounds.length };
  }
  if (event.format === 'team_mexicano' || isRankingBased(event.format)) {
    return updated; // one round at a time — the next generated round already excludes the bench
  }
  const seed = deriveRotationHistory(players, kept);
  const regenerated = generateRotationSchedule(event.format, activePlayers(players), event.courts, remaining, kept.length, seed, event.matchesPerPlayer);
  const rounds = [...kept, ...regenerated];
  return { ...updated, rounds, totalRoundsEstimate: rounds.length };
}

/** Substitutes a participant with a new name in place — keeps their schedule slot and any completed-match scores. */
export function replaceParticipant(event: WowEvent, playerId: string, newName: string, newGender?: Gender): WowEvent {
  return {
    ...event,
    players: event.players.map((p) =>
      p.id === playerId ? { ...p, name: newName, gender: newGender ?? p.gender } : p
    ),
  };
}

/**
 * Substitutes a participant for every round that hasn't been completed yet — outgoing and
 * incoming trade slots (their match, or sitting out) in the current round and every later one,
 * while completed rounds and their recorded scores stay exactly as played. Because it's a like-
 * for-like slot swap across the same remaining rounds, neither participant's total match count
 * for the event changes. Use when a scheduled player/team can't continue and someone already in
 * the roster takes over their remaining matches.
 */
export function substituteParticipant(event: WowEvent, outgoingId: string, incomingId: string): WowEvent {
  const rounds = event.rounds.map((r) => {
    if (r.completed) return r;
    const swap = (pid: string) => (pid === outgoingId ? incomingId : pid === incomingId ? outgoingId : pid);
    const matches = r.matches.map((m) => ({ ...m, teamA: m.teamA.map(swap), teamB: m.teamB.map(swap) }));
    const sitOuts = r.sitOuts.map(swap);
    return { ...r, matches, sitOuts };
  });
  return { ...event, rounds };
}

export function setScore(event: WowEvent, roundIndex: number, courtId: string, team: 'A' | 'B', value: number): WowEvent {
  const rounds = event.rounds.map((r) => {
    if (r.index !== roundIndex) return r;
    return {
      ...r,
      matches: r.matches.map((m) => {
        if (m.courtId !== courtId) return m;
        if (event.scoringMode === 'total') {
          const v = Math.max(0, Math.min(event.pot, value));
          const other = event.pot - v;
          return team === 'A' ? { ...m, scoreA: v, scoreB: other } : { ...m, scoreA: other, scoreB: v };
        }
        const v = Math.max(0, Math.min(99, value));
        return team === 'A' ? { ...m, scoreA: v } : { ...m, scoreB: v };
      }),
    };
  });
  return { ...event, rounds };
}

/**
 * Clears a match back to unscored (both sides null) — the only way to walk an entry back, since
 * setScore/applyScore only ever overwrite with a new number.
 *
 * If the cleared match belongs to the current live round (or a round ahead of it), this is a pure
 * correction: nothing else changes. But if it belongs to an *earlier* round — one that already got
 * left behind by auto-advance, or by the event finishing — leaving `currentRoundIndex` where it
 * was would strand that round "completed" with a gap in it. So this rewinds the tournament back to
 * the corrected round instead: it becomes live again (event status included, if the event had
 * finished), and every round after it is marked not-completed.
 *
 * For formats whose rounds get appended one at a time from live standings (Mexicano / Mixicano /
 * Team Mexicano), every round after the corrected one is also discarded outright, not just marked
 * incomplete — their pairings were built from standings that included the score being erased, so
 * they're stale; replaying "End Round" from here regenerates them fresh. Fixed-schedule formats
 * (Americano / Mix Americano / Team Americano) keep their later rounds as-is, since those pairings
 * were fixed at creation and never depended on scores.
 */
export function clearScore(event: WowEvent, roundIndex: number, courtId: string): WowEvent {
  const cleared = event.rounds.map((r) =>
    r.index === roundIndex
      ? { ...r, matches: r.matches.map((m) => (m.courtId === courtId ? { ...m, scoreA: null, scoreB: null } : m)) }
      : r
  );

  const isAppendedFromStandings = event.format === 'team_mexicano' || isRankingBased(event.format);
  const isAhead = roundIndex >= event.currentRoundIndex;
  if (isAhead && event.status === 'live') {
    return { ...event, rounds: cleared };
  }

  const kept = isAppendedFromStandings ? cleared.filter((r) => r.index <= roundIndex) : cleared;
  const rounds = kept.map((r) => (r.index >= roundIndex ? { ...r, completed: false } : r));
  return { ...event, rounds, currentRoundIndex: roundIndex, status: 'live' };
}

/**
 * Enters one score and auto-advances the round if that was its last missing score — the single
 * place this "score, then maybe advance" rule lives, shared by the app's own keypad and by scores
 * pulled in from the web score-entry link, so the two paths can never drift apart. Editing a round
 * that isn't the current live one (a correction to history) never triggers auto-advance.
 */
export function applyScore(event: WowEvent, roundIndex: number, courtId: string, team: 'A' | 'B', value: number): WowEvent {
  const scored = setScore(event, roundIndex, courtId, team, value);
  if (scored.status !== 'live' || roundIndex !== scored.currentRoundIndex) return scored;
  const round = scored.rounds.find((r) => r.index === roundIndex);
  const allScoredNow = !!round && round.matches.every((m) => m.scoreA != null && m.scoreB != null);
  return allScoredNow ? advanceRound(scored) : scored;
}

// ===== Single-elimination knockout =====

function nextPowerOfTwo(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return Math.max(4, p);
}

/** Human name for a knockout round given how many competitors it contains. */
export function knockoutRoundName(competitorCount: number): string {
  switch (competitorCount) {
    case 2:
      return 'Final';
    case 4:
      return 'Semi Finals';
    case 8:
      return 'Quarter Finals';
    case 16:
      return 'Round of 16';
    case 32:
      return 'Round of 32';
    default:
      return `Round of ${competitorCount}`;
  }
}

/** Winner of a knockout match. `allowBye` (first round only) lets a lone competitor advance unopposed. */
function knockoutWinner(m: Match, allowBye: boolean): string | null {
  const a = m.teamA[0];
  const b = m.teamB[0];
  if (allowBye) {
    if (a && !b) return a;
    if (b && !a) return b;
  }
  if (a && b && m.scoreA != null && m.scoreB != null && m.scoreA !== m.scoreB) {
    return m.scoreA > m.scoreB ? a : b;
  }
  return null;
}

/** The loser of a decided real match (null for byes / undecided). */
function knockoutLoser(m: Match, allowBye: boolean): string | null {
  const w = knockoutWinner(m, allowBye);
  if (!w) return null;
  const a = m.teamA[0];
  const b = m.teamB[0];
  if (!a || !b) return null; // bye — no loser
  return w === a ? b : a;
}

function thirdPlaceDecided(tp: Match | undefined): boolean {
  return !!(tp && tp.teamA[0] && tp.teamB[0] && tp.scoreA != null && tp.scoreB != null && tp.scoreA !== tp.scoreB);
}

/** Recomputes which competitor occupies every later-round slot from entered results, feeds the 3rd-place match its semifinal losers, and updates completion/status. */
export function recomputeKnockout(event: WowEvent): WowEvent {
  const rounds = event.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m })) }));
  for (let r = 0; r < rounds.length - 1; r++) {
    const first = r === 0;
    for (let i = 0; i < rounds[r].matches.length; i++) {
      const w = knockoutWinner(rounds[r].matches[i], first);
      const next = rounds[r + 1].matches[Math.floor(i / 2)];
      if (i % 2 === 0) next.teamA = w ? [w] : [];
      else next.teamB = w ? [w] : [];
    }
    rounds[r].completed = rounds[r].matches.every((m) => knockoutWinner(m, first) !== null);
  }
  const last = rounds[rounds.length - 1];
  last.completed = knockoutWinner(last.matches[0], rounds.length === 1) !== null;

  // Third-place playoff: fill it with the two semifinal losers (keeps its own score).
  let thirdPlaceMatch = event.thirdPlaceMatch;
  if (thirdPlaceMatch && rounds.length >= 2) {
    const semi = rounds[rounds.length - 2];
    const semiIsFirst = rounds.length - 2 === 0;
    const losers = semi.matches.map((m) => knockoutLoser(m, semiIsFirst));
    thirdPlaceMatch = {
      ...thirdPlaceMatch,
      teamA: losers[0] ? [losers[0]!] : [],
      teamB: losers[1] ? [losers[1]!] : [],
    };
  }

  const roundsDone = rounds.every((r) => r.completed);
  const allDone = roundsDone && (!thirdPlaceMatch || thirdPlaceDecided(thirdPlaceMatch));
  const firstOpen = rounds.findIndex((r) => !r.completed);
  return {
    ...event,
    rounds,
    thirdPlaceMatch,
    currentRoundIndex: firstOpen === -1 ? rounds.length : firstOpen + 1,
    status: allDone ? 'done' : 'live',
  };
}

/**
 * Builds a single-elimination bracket in INPUT ORDER (no shuffle): first-round matches are the
 * adjacent pairs a-vs-b, c-vs-d, … Any byes go to the last entered competitors so every real
 * pairing stays in order and no first-round match is bye-vs-bye.
 */
export function startKnockout(event: WowEvent): WowEvent {
  const players = event.players; // keep the organizer's entered order
  const size = nextPowerOfTwo(players.length);
  const matchCount = size / 2;
  const byes = size - players.length;
  const realMatches = matchCount - byes; // matches with two real competitors

  const rounds: Round[] = [];
  const firstMatches: Match[] = [];
  let k = 0;
  for (let i = 0; i < matchCount; i++) {
    if (i < realMatches) {
      const a = players[k++].id;
      const b = players[k++].id;
      firstMatches.push({ courtId: `r0m${i}`, teamA: [a], teamB: [b], scoreA: null, scoreB: null });
    } else {
      const a = players[k++]?.id;
      firstMatches.push({ courtId: `r0m${i}`, teamA: a ? [a] : [], teamB: [], scoreA: null, scoreB: null });
    }
  }
  rounds.push({ index: 1, matches: firstMatches, sitOuts: [], completed: false });

  let count = size / 2;
  let idx = 1;
  while (count > 1) {
    count = Math.floor(count / 2);
    idx += 1;
    const matches: Match[] = [];
    for (let i = 0; i < count; i++) {
      matches.push({ courtId: `r${idx - 1}m${i}`, teamA: [], teamB: [], scoreA: null, scoreB: null });
    }
    rounds.push({ index: idx, matches, sitOuts: [], completed: false });
  }

  // A 3rd-place playoff needs two real semifinal losers. That holds for size ≥ 8 (byes only reach
  // round 1), or for a 4-slot bracket only when it's exactly 4 players (no byes in the semis).
  const hasThirdPlace = rounds.length >= 2 && (size >= 8 || players.length === 4);
  const thirdPlaceMatch: Match | undefined = hasThirdPlace
    ? { courtId: 'third', teamA: [], teamB: [], scoreA: null, scoreB: null }
    : undefined;

  return recomputeKnockout({
    ...event,
    scoringMode: 'free',
    rounds,
    thirdPlaceMatch,
    totalRoundsEstimate: rounds.length,
    currentRoundIndex: 1,
    status: 'live',
  });
}

/** Enter a score for the 3rd-place playoff. */
export function setThirdPlaceScore(event: WowEvent, team: 'A' | 'B', value: number): WowEvent {
  if (!event.thirdPlaceMatch) return event;
  const v = Math.max(0, Math.min(99, value));
  const tp = { ...event.thirdPlaceMatch };
  if (team === 'A') tp.scoreA = v;
  else tp.scoreB = v;
  return recomputeKnockout({ ...event, thirdPlaceMatch: tp });
}

/** Clears the 3rd-place playoff back to unscored. */
export function clearThirdPlaceScore(event: WowEvent): WowEvent {
  if (!event.thirdPlaceMatch) return event;
  return recomputeKnockout({ ...event, thirdPlaceMatch: { ...event.thirdPlaceMatch, scoreA: null, scoreB: null } });
}

export function setKnockoutScore(event: WowEvent, roundIndex: number, matchIndex: number, team: 'A' | 'B', value: number): WowEvent {
  const v = Math.max(0, Math.min(99, value));
  const rounds = event.rounds.map((r) => {
    if (r.index !== roundIndex) return r;
    return {
      ...r,
      matches: r.matches.map((m, i) => {
        if (i !== matchIndex) return m;
        return team === 'A' ? { ...m, scoreA: v } : { ...m, scoreB: v };
      }),
    };
  });
  return recomputeKnockout({ ...event, rounds });
}

/** Clears a bracket match back to unscored — recomputeKnockout cascades this into clearing whichever later slot that match's winner had already filled. */
export function clearKnockoutScore(event: WowEvent, roundIndex: number, matchIndex: number): WowEvent {
  const rounds = event.rounds.map((r) => {
    if (r.index !== roundIndex) return r;
    return {
      ...r,
      matches: r.matches.map((m, i) => (i === matchIndex ? { ...m, scoreA: null, scoreB: null } : m)),
    };
  });
  return recomputeKnockout({ ...event, rounds });
}

/**
 * Ranks knockout competitors by how far they advanced (champion first), so byes never distort the order:
 * points = furthest round reached ×2, +1 if they won that round (i.e. the champion). `wins` holds real matches won.
 */
export function computeKnockoutStandings(event: WowEvent): Standing[] {
  const map: Record<string, Standing> = {};
  event.players.forEach((p) => (map[p.id] = { player: p, played: 0, wins: 0, draws: 0, points: 0 }));
  const lastRound: Record<string, number> = {};
  const wonLast: Record<string, boolean> = {};

  event.rounds.forEach((round, ri) => {
    for (const m of round.matches) {
      const a = m.teamA[0];
      const b = m.teamB[0];
      for (const id of [a, b]) {
        if (id && (lastRound[id] == null || ri > lastRound[id])) {
          lastRound[id] = ri;
          wonLast[id] = false;
        }
      }
      if (a && b && m.scoreA != null && m.scoreB != null && m.scoreA !== m.scoreB) {
        const w = knockoutWinner(m, ri === 0);
        if (map[a]) map[a].played += 1;
        if (map[b]) map[b].played += 1;
        if (w && map[w]) {
          map[w].wins += 1;
          if (ri >= (lastRound[w] ?? -1)) wonLast[w] = true;
        }
      }
    }
  });

  event.players.forEach((p) => {
    const lr = lastRound[p.id] ?? -1;
    map[p.id].points = (lr + 1) * 2 + (wonLast[p.id] ? 1 : 0);
  });

  // 3rd-place playoff: count it, and nudge its winner above the other semifinalist (3rd vs 4th).
  const tp = event.thirdPlaceMatch;
  if (tp && tp.teamA[0] && tp.teamB[0] && tp.scoreA != null && tp.scoreB != null && tp.scoreA !== tp.scoreB) {
    const a = tp.teamA[0];
    const b = tp.teamB[0];
    const w = tp.scoreA > tp.scoreB ? a : b;
    if (map[a]) map[a].played += 1;
    if (map[b]) map[b].played += 1;
    if (map[w]) {
      map[w].wins += 1;
      map[w].points += 1; // both semifinal losers share a base score; this ranks the winner 3rd, loser 4th
    }
  }

  return Object.values(map);
}
