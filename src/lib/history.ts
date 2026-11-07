import type { WowEvent } from '../types';

/** Snapshots kept per event for undo/redo — older ones fall off the back. */
export const MAX_HISTORY = 40;

export interface EventHistory {
  past: WowEvent[];
  future: WowEvent[];
}

export type HistoryMap = Record<string, EventHistory>;

/** Link/publish state belongs to the live share, not to the game — undo/redo must never roll it back. */
export const withCurrentShareFields = (snapshot: WowEvent, current: WowEvent): WowEvent => ({
  ...snapshot,
  shareId: current.shareId,
  editorToken: current.editorToken,
  shareInputSource: current.shareInputSource,
});

/** Remembers `before` so it can be revisited; any new change wipes the redo branch. Returns false if nothing changed. */
export function recordHistory(map: HistoryMap, before: WowEvent, after: WowEvent): boolean {
  if (JSON.stringify(before) === JSON.stringify(after)) return false;
  const h = map[before.id] ?? { past: [], future: [] };
  map[before.id] = { past: [...h.past, before].slice(-MAX_HISTORY), future: [] };
  return true;
}

/** Moves one step back (undo) or forward (redo). Returns the event to show, or null if there is nothing to step to. */
export function stepHistory(map: HistoryMap, current: WowEvent, direction: 'undo' | 'redo'): WowEvent | null {
  const h = map[current.id];
  if (!h) return null;
  const from = direction === 'undo' ? h.past : h.future;
  if (!from.length) return null;
  const target = withCurrentShareFields(from[from.length - 1], current);
  const rest = from.slice(0, -1);
  map[current.id] =
    direction === 'undo' ? { past: rest, future: [...h.future, current] } : { past: [...h.past, current], future: rest };
  return target;
}
