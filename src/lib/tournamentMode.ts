import { buildKnockout } from './tournament';
import type { Match, Player, Round, TournamentGroup, WowEvent } from '../types';

// Tournament Mode: round-robin groups (win 3 / tie 1 / loss 0, ranked by points then head-to-head)
// followed by a single-elimination knockout seeded from the group results. See TournamentConfig in types.ts.

/** League scoring used in every group. */
export const GROUP_WIN_POINTS = 3;
export const GROUP_DRAW_POINTS = 1;

export interface GroupStanding {
  player: Player;
  rank: number; // 1-based within the group
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scoreFor: number;
  scoreAgainst: number;
  diff: number;
  points: number; // league points (3 / 1 / 0)
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function defaultGroupName(index: number): string {
  return index < 26 ? `Group ${String.fromCharCode(65 + index)}` : `Group ${index + 1}`;
}

/** Deals players into `groupCount` groups as evenly as possible (sizes differ by at most one), in random order. */
export function randomGroupAssignment(playerIds: string[], groupCount: number): Record<string, number> {
  const out: Record<string, number> = {};
  const count = Math.max(groupCount, 1);
  shuffled(playerIds).forEach((id, i) => (out[id] = i % count));
  return out;
}

/** Circle-method round robin: every pair exactly once, one list of pairs per matchday. An odd group gets one bye per matchday. */
function roundRobinMatchdays(ids: string[]): { a: string; b: string }[][] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const days: { a: string; b: string }[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const day: { a: string; b: string }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = list[i];
      const y = list[n - 1 - i];
      if (x == null || y == null) continue;
      // Alternate sides between matchdays so nobody is always "team A".
      day.push((r + i) % 2 === 0 ? { a: x, b: y } : { a: y, b: x });
    }
    days.push(day);
    list.splice(1, 0, list.pop() as string | null);
  }
  return days;
}

/** Builds every group's full round-robin fixture list and starts the group stage. Matchday N holds every group's Nth fixtures. */
export function startTournament(event: WowEvent): WowEvent {
  const cfg = event.tournament;
  if (!cfg) return event;
  const perGroup = cfg.groups.map((g) => roundRobinMatchdays(g.playerIds));
  const dayCount = Math.max(0, ...perGroup.map((d) => d.length));
  const rounds: Round[] = [];
  for (let d = 0; d < dayCount; d++) {
    const matches: Match[] = [];
    const sitOuts: string[] = [];
    perGroup.forEach((days, gi) => {
      const day = days[d];
      if (!day) return;
      const playing = new Set<string>();
      day.forEach((pair, k) => {
        playing.add(pair.a);
        playing.add(pair.b);
        // Fixture key: unique per match and encodes the group (see groupIndexOfMatch).
        matches.push({ courtId: `g${gi}d${d}m${k}`, teamA: [pair.a], teamB: [pair.b], scoreA: null, scoreB: null });
      });
      cfg.groups[gi].playerIds.forEach((id) => {
        if (!playing.has(id)) sitOuts.push(id);
      });
    });
    rounds.push({ index: d + 1, matches, sitOuts, completed: false });
  }
  return { ...event, scoringMode: 'free', rounds, totalRoundsEstimate: rounds.length, currentRoundIndex: 1, status: 'live' };
}

/** Which group a fixture belongs to (-1 if unknown). */
export function groupIndexOfMatch(m: Match): number {
  const hit = /^g(\d+)d/.exec(m.courtId);
  return hit ? Number(hit[1]) : -1;
}

function isScored(m: Match): boolean {
  return m.scoreA != null && m.scoreB != null;
}

/** Marks fully-scored matchdays completed and points `currentRoundIndex` at the first open one (the last one once all are done). */
function recomputeGroupStage(event: WowEvent): WowEvent {
  const rounds = event.rounds.map((r) => ({ ...r, completed: r.matches.length > 0 && r.matches.every(isScored) }));
  const firstOpen = rounds.find((r) => !r.completed);
  return { ...event, rounds, currentRoundIndex: firstOpen ? firstOpen.index : rounds.length };
}

export function setGroupScore(event: WowEvent, roundIndex: number, courtId: string, team: 'A' | 'B', value: number): WowEvent {
  const v = Math.max(0, Math.min(99, value));
  const rounds = event.rounds.map((r) =>
    r.index !== roundIndex
      ? r
      : {
          ...r,
          matches: r.matches.map((m) => (m.courtId !== courtId ? m : team === 'A' ? { ...m, scoreA: v } : { ...m, scoreB: v })),
        }
  );
  return recomputeGroupStage({ ...event, rounds });
}

export function clearGroupScore(event: WowEvent, roundIndex: number, courtId: string): WowEvent {
  const rounds = event.rounds.map((r) =>
    r.index !== roundIndex
      ? r
      : { ...r, matches: r.matches.map((m) => (m.courtId === courtId ? { ...m, scoreA: null, scoreB: null } : m)) }
  );
  return recomputeGroupStage({ ...event, rounds });
}

/** Group-stage matches for the event, whether the group stage is still live or archived behind the knockout. */
export function groupStageRounds(event: WowEvent): Round[] {
  return event.format === 'tournament' ? event.rounds : event.tournament?.groupRounds ?? [];
}

/**
 * Group table ranked by league points (win 3 / tie 1 / loss 0), then head-to-head between the tied
 * players (a mini-league over only the matches they played against each other, re-applied to any
 * sub-tie it leaves), then overall score difference, points scored and finally name so the order is
 * always deterministic.
 */
export function computeGroupTable(group: TournamentGroup, players: Player[], rounds: Round[]): GroupStanding[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const ids = new Set(group.playerIds);
  const rows = new Map<string, GroupStanding>();
  group.playerIds.forEach((id) => {
    const player = byId.get(id);
    if (player) rows.set(id, { player, rank: 0, played: 0, wins: 0, draws: 0, losses: 0, scoreFor: 0, scoreAgainst: 0, diff: 0, points: 0 });
  });

  const matches: Match[] = [];
  for (const round of rounds) {
    for (const m of round.matches) {
      const a = m.teamA[0];
      const b = m.teamB[0];
      if (!a || !b || !ids.has(a) || !ids.has(b) || !isScored(m)) continue;
      matches.push(m);
      const ra = rows.get(a);
      const rb = rows.get(b);
      if (!ra || !rb) continue;
      const sa = m.scoreA as number;
      const sb = m.scoreB as number;
      ra.played++;
      rb.played++;
      ra.scoreFor += sa;
      ra.scoreAgainst += sb;
      rb.scoreFor += sb;
      rb.scoreAgainst += sa;
      if (sa > sb) {
        ra.wins++;
        rb.losses++;
        ra.points += GROUP_WIN_POINTS;
      } else if (sb > sa) {
        rb.wins++;
        ra.losses++;
        rb.points += GROUP_WIN_POINTS;
      } else {
        ra.draws++;
        rb.draws++;
        ra.points += GROUP_DRAW_POINTS;
        rb.points += GROUP_DRAW_POINTS;
      }
    }
  }
  rows.forEach((r) => (r.diff = r.scoreFor - r.scoreAgainst));

  const fallback = (x: GroupStanding, y: GroupStanding) =>
    y.diff - x.diff || y.scoreFor - x.scoreFor || x.player.name.localeCompare(y.player.name);

  // Head-to-head mini-league among `tied`, recursing on any sub-tie it leaves unresolved.
  const breakTie = (tied: GroupStanding[]): GroupStanding[] => {
    const tiedIds = new Set(tied.map((r) => r.player.id));
    const mini = new Map<string, number>(tied.map((r) => [r.player.id, 0]));
    for (const m of matches) {
      const a = m.teamA[0];
      const b = m.teamB[0];
      if (!tiedIds.has(a) || !tiedIds.has(b)) continue;
      const sa = m.scoreA as number;
      const sb = m.scoreB as number;
      if (sa > sb) mini.set(a, (mini.get(a) as number) + GROUP_WIN_POINTS);
      else if (sb > sa) mini.set(b, (mini.get(b) as number) + GROUP_WIN_POINTS);
      else {
        mini.set(a, (mini.get(a) as number) + GROUP_DRAW_POINTS);
        mini.set(b, (mini.get(b) as number) + GROUP_DRAW_POINTS);
      }
    }
    const miniOf = (r: GroupStanding) => mini.get(r.player.id) as number;
    const sorted = [...tied].sort((x, y) => miniOf(y) - miniOf(x));
    const out: GroupStanding[] = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j < sorted.length && miniOf(sorted[j]) === miniOf(sorted[i])) j++;
      const sub = sorted.slice(i, j);
      if (sub.length === 1) out.push(sub[0]);
      else if (sub.length < tied.length) out.push(...breakTie(sub)); // h2h separated others — re-run among the remainder
      else out.push(...sub.sort(fallback)); // h2h can't separate them at all
      i = j;
    }
    return out;
  };

  const byPoints = [...rows.values()].sort((x, y) => y.points - x.points);
  const ranked: GroupStanding[] = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i;
    while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    const tied = byPoints.slice(i, j);
    ranked.push(...(tied.length > 1 ? breakTie(tied) : tied));
    i = j;
  }
  ranked.forEach((r, idx) => (r.rank = idx + 1));
  return ranked;
}

/** Every group's ranked table for an event in (or past) the group stage. */
export function computeAllGroupTables(event: WowEvent): { group: TournamentGroup; table: GroupStanding[] }[] {
  const cfg = event.tournament;
  if (!cfg) return [];
  const rounds = groupStageRounds(event);
  return cfg.groups.map((group) => ({ group, table: computeGroupTable(group, event.players, rounds) }));
}

export function groupStageProgress(event: WowEvent): { played: number; total: number } {
  const all = groupStageRounds(event).flatMap((r) => r.matches);
  return { played: all.filter(isScored).length, total: all.length };
}

export function isGroupStageComplete(event: WowEvent): boolean {
  const { played, total } = groupStageProgress(event);
  return total > 0 && played === total;
}

/** Validates a tournament setup; returns a human-readable problem, or null when it's good to go. */
export function tournamentSetupProblem(groupSizes: number[], unassigned: number, advanceCount: number): string | null {
  if (groupSizes.length < 2) return 'Use at least 2 groups.';
  if (unassigned > 0) return `${unassigned} player${unassigned === 1 ? ' is' : 's are'} not in a group yet.`;
  const smallest = Math.min(...groupSizes);
  if (smallest < 2) return 'Every group needs at least 2 players.';
  if (advanceCount < 1) return 'At least 1 player per group must advance.';
  if (advanceCount > smallest) return `Only ${smallest} can advance from the smallest group.`;
  if (advanceCount * groupSizes.length < 2) return 'Fewer than 2 players would reach the knockout.';
  return null;
}

/**
 * Seeds the knockout from the group results and flips the event into its knockout stage. Qualifiers are
 * seeded by group finish (all 1sts, then all 2nds, ...; within a finish by points, score difference, then
 * score). Standard bracket seeding keeps the top seeds apart and gives byes (when the qualifier count isn't a
 * power of two) to the best seeds; a repair pass then swaps same-finish qualifiers so nobody meets a
 * group-mate in round 1 when that can be avoided.
 */
export function startTournamentKnockout(event: WowEvent): WowEvent {
  const cfg = event.tournament;
  if (!cfg || event.format !== 'tournament') return event;

  interface Entry {
    id: string;
    group: number;
    finish: number;
    points: number;
    diff: number;
    scoreFor: number;
  }
  const entries: Entry[] = [];
  computeAllGroupTables(event).forEach(({ table }, gi) => {
    table.slice(0, cfg.advanceCount).forEach((row) =>
      entries.push({ id: row.player.id, group: gi, finish: row.rank, points: row.points, diff: row.diff, scoreFor: row.scoreFor })
    );
  });
  entries.sort(
    (a, b) => a.finish - b.finish || b.points - a.points || b.diff - a.diff || b.scoreFor - a.scoreFor || a.group - b.group
  );

  const n = entries.length;
  let size = 2;
  while (size < n) size *= 2;

  // Standard bracket seed order: size 8 → 1,8,4,5,2,7,3,6 (adjacent pairs are first-round matches).
  let order = [1, 2];
  while (order.length < size) {
    const len = order.length * 2;
    order = order.flatMap((seed) => [seed, len + 1 - seed]);
  }
  const slots: (Entry | undefined)[] = order.map((seed) => entries[seed - 1]); // undefined = bye

  const conflicts = () => {
    let c = 0;
    for (let i = 0; i < size; i += 2) {
      const a = slots[i];
      const b = slots[i + 1];
      if (a && b && a.group === b.group) c++;
    }
    return c;
  };
  for (let pass = 0; pass < 100; pass++) {
    const before = conflicts();
    if (before === 0) break;
    let improved = false;
    for (let i = 0; i < size && !improved; i += 2) {
      const x = slots[i];
      const y = slots[i + 1];
      if (!x || !y || x.group !== y.group) continue;
      for (const pos of [i, i + 1]) {
        for (let j = 0; j < size && !improved; j++) {
          const moving = slots[pos];
          const other = slots[j];
          if (!moving || !other || Math.floor(j / 2) === Math.floor(pos / 2) || other.finish !== moving.finish) continue;
          slots[pos] = other;
          slots[j] = moving;
          if (conflicts() < before) improved = true;
          else {
            slots[pos] = moving; // no improvement — undo
            slots[j] = other;
          }
        }
        if (improved) break;
      }
    }
    if (!improved) break;
  }

  const firstMatches: Match[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    const [first, second] = a ? [a, b] : [b, a]; // a bye always sits on the empty side (teamB)
    firstMatches.push({
      courtId: `r0m${i / 2}`,
      teamA: first ? [first.id] : [],
      teamB: second ? [second.id] : [],
      scoreA: null,
      scoreB: null,
    });
  }

  const built = buildKnockout(event, firstMatches, size, n);
  return { ...built, format: 'knockout', tournament: { ...cfg, groupRounds: event.rounds } };
}
