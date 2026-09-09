export type Gender = 'M' | 'F';

export type Format =
  | 'americano'
  | 'mexicano'
  | 'mixicano'
  | 'mix_americano'
  | 'team_americano'
  | 'team_mexicano'
  | 'knockout';

export type ScoringMode = 'total' | 'free';

export type EventStatus = 'draft' | 'live' | 'done';

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  /** Benched — sits out of every round from here on (past and in-progress rounds are unaffected) until un-benched. */
  benched?: boolean;
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
};
