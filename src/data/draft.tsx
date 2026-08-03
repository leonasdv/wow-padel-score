import React, { createContext, useContext, useState } from 'react';
import { makeId } from '../lib/id';
import type { Court, Format, Player, ScoringMode } from '../types';

export interface DraftEvent {
  name: string;
  format: Format;
  scoringMode: ScoringMode;
  pot: number;
  courts: Court[];
  players: Player[];
  numRounds: number;
  matchesPerPlayer?: number;
}

function emptyDraft(): DraftEvent {
  return {
    name: '',
    format: 'americano',
    scoringMode: 'total',
    pot: 4,
    courts: [{ id: makeId('court'), name: 'Court 1' }],
    players: [],
    numRounds: 9,
  };
}

interface DraftContextValue {
  draft: DraftEvent;
  setDraft: React.Dispatch<React.SetStateAction<DraftEvent>>;
  reset: () => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<DraftEvent>(emptyDraft());
  const reset = () => setDraft(emptyDraft());
  return <DraftContext.Provider value={{ draft, setDraft, reset }}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used within DraftProvider');
  return ctx;
}
