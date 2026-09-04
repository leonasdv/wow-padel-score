import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { pullPendingScores, pushEventUpdate } from '../lib/share';
import type { WowEvent } from '../types';

const STORAGE_KEY = '@wow_padel_score/events';
/** How often to check for scores submitted from a web score-entry link — mirrors the web viewer's own poll cadence. */
const WEB_SCORE_POLL_MS = 5000;

interface EventsContextValue {
  events: WowEvent[];
  loading: boolean;
  getEvent: (id: string) => WowEvent | undefined;
  addEvent: (event: WowEvent) => Promise<void>;
  updateEvent: (id: string, updater: (event: WowEvent) => WowEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<WowEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setEvents(JSON.parse(raw));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: WowEvent[]) => {
    setEvents(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const getEvent = useCallback((id: string) => events.find((e) => e.id === id), [events]);

  const addEvent = useCallback(
    async (event: WowEvent) => {
      await persist([event, ...events]);
    },
    [events, persist]
  );

  const updateEvent = useCallback(
    async (id: string, updater: (event: WowEvent) => WowEvent) => {
      let updated: WowEvent | undefined;
      await persist(
        events.map((e) => {
          if (e.id !== id) return e;
          updated = updater(e);
          return updated;
        })
      );
      // Best-effort sync to the published share link, if any — never blocks or throws into the caller.
      if (updated?.shareId) pushEventUpdate(updated).catch(() => {});
    },
    [events, persist]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      await persist(events.filter((e) => e.id !== id));
    },
    [events, persist]
  );

  // Kept fresh on every render so the poll loop below always reads the latest roster, without
  // needing `events` in its own effect deps (which would tear down and restart the interval —
  // and, worse, risk operating on a stale snapshot mid-await — every time any event changes).
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // While an event is toggled to web score entry, the organizer's own phone needs to pull scores
  // submitted from that link back in — sync is otherwise push-only (see pushEventUpdate).
  useEffect(() => {
    const interval = setInterval(async () => {
      const candidates = eventsRef.current.filter((e) => e.shareId && e.shareInputSource === 'web' && e.status === 'live');
      for (const ev of candidates) {
        try {
          const updated = await pullPendingScores(ev);
          if (updated === ev) continue; // nothing was pending
          const latest = eventsRef.current;
          await persist(latest.map((e) => (e.id === ev.id ? updated : e)));
          pushEventUpdate(updated).catch(() => {});
        } catch {
          // Best-effort — picked up again on the next tick.
        }
      }
    }, WEB_SCORE_POLL_MS);
    return () => clearInterval(interval);
  }, [persist]);

  const value = useMemo(
    () => ({ events, loading, getEvent, addEvent, updateEvent, deleteEvent }),
    [events, loading, getEvent, addEvent, updateEvent, deleteEvent]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used within EventsProvider');
  return ctx;
}
