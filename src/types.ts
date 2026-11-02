export type Gender = 'M' | 'F';

export type Format =
  | 'americano'
  | 'mexicano'
  | 'mixicano'
  | 'mix_americano'
  | 'team_americano'
  | 'team_mexicano'
  | 'knockout'
  | 'tournament';

export type ScoringMode = 'total' | 'free';

export type EventStatus = 'draft' | 'live' | 'done';

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  /** Benched — sits out of every round from here on (past and in-progress rounds are unaffected) until un-benched. */
  benched?: boolean;
  /** Set at creation time only — excludes this player from round 1's pairings; they join normally from round 2 onward. Cleared once rounds are generated. */
  skipFirstRound?: boolean;
}

export interface Court {
  id: string;
  name: string;
}

export interface Match {
  courtId: string;
  teamA: string[]; // player ids
  teamB: string[]; // player ids
  scoreA: number | null;
  scoreB: number | null;
}

export interface Round {
  index: number; // 1-based
  matches: Match[];
  sitOuts: string[]; // player ids not playing this round
  completed: boolean;
}

export interface FixedTeam {
  id: string;
  playerIds: string[];
}

/** One round-robin group in Tournament Mode. */
export interface TournamentGroup {
  id: string;
  name: string; // "Group A"
  playerIds: string[];
}

/**
 * Tournament Mode = round-robin group stage, then a single-elimination knockout of the top finishers.
 * While the group stage runs the event's `format` is 'tournament' and its matches live in `rounds`
 * (one round per matchday, `courtId` is a per-group-unique fixture key). When the organizer starts the
 * knockout stage the event's `format` flips to 'knockout' (so the bracket screen, results card and web
 * viewer all work unchanged), `rounds` becomes the bracket, and the group matches are archived in `groupRounds`.
 */
export interface TournamentConfig {
  groups: TournamentGroup[];
  /** How many players from each group advance to the knockout (top 1, top 2, ...). */
  advanceCount: number;
  /** Group-stage matches, archived once the knockout stage has started. */
  groupRounds?: Round[];
}

export interface WowEvent {
  id: string;
  name: string;
  format: Format;
  scoringMode: ScoringMode;
  pot: number; // used when scoringMode === 'total'
  courts: Court[];
  players: Player[];
  fixedTeams?: FixedTeam[]; // team_americano / team_mexicano only
  thirdPlaceMatch?: Match; // knockout only — semifinal losers play for 3rd
  tournament?: TournamentConfig; // Tournament Mode only — groups + advancement; see TournamentConfig
  rounds: Round[];
  totalRoundsEstimate: number;
  matchesPerPlayer?: number; // optional target set at creation — every player/team gets exactly this many matches
  currentRoundIndex: number; // 1-based index of active round
  status: EventStatus;
  createdAt: number;
  resultBgIndex: number;
  resultBgUri?: string;
  resultPodiumPosition?: 'top' | 'bottom';
  resultTemplate?: 'list' | 'podium' | 'table';
  shareId?: string; // set once the event is published to the public live share link
  editToken?: string; // private token authorizing full updates to the published copy — never shown to users
  editorToken?: string; // narrower token for the web "score entry" link — private, never shown to users
  shareInputSource?: 'app' | 'web'; // who's currently allowed to submit scores for the published copy — defaults to 'app'
}

export interface Standing {
  player: Player;
  played: number;
  wins: number;
  draws: number;
  points: number;
}

export const FORMAT_META: Record<Format, { name: string; abbr: string; desc: string }> = {
  americano: {
    name: 'Americano',
    abbr: 'AM',
    desc: 'Everyone plays with & against everyone. Individual points.',
  },
  mexicano: {
    name: 'Mexicano',
    abbr: 'MX',
    desc: 'Pairings each round set by current ranking. Individual points.',
  },
  mixicano: {
    name: 'Mixicano',
    abbr: 'MI',
    desc: 'Mixed pairs rotate — one man, one woman per team.',
  },
  mix_americano: {
    name: 'Mix Americano',
    abbr: 'MA',
    desc: 'Americano rotation played strictly in mixed pairs.',
  },
  team_americano: {
    name: 'Team Americano',
    abbr: 'TA',
    desc: 'Fixed teams face every other team. Team points.',
  },
  team_mexicano: {
    name: 'Team Mexicano',
    abbr: 'TM',
    desc: 'Fixed teams ranked each round — winners climb to the top court, losers drop to the bottom.',
  },
  knockout: {
    name: 'Knockout',
    abbr: 'KO',
    desc: 'Single-elimination bracket — win or go home.',
  },
  tournament: {
    name: 'Tournament Mode',
    abbr: 'TN',
    desc: 'Group stage (round-robin, 3 pts per win) then a knockout for the top finishers.',
  },
};

/** Display name for an event's format — a knockout that grew out of a group stage still reads "Tournament Mode". */
export function eventFormatName(event: Pick<WowEvent, 'format' | 'tournament'>): string {
  return event.tournament ? FORMAT_META.tournament.name : FORMAT_META[event.format].name;
}
