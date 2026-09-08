import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
  /** Overwrites the entire local roster — used to apply a merged/imported backup in one write. */
  replaceAllEvents: (events: WowEvent[]) => Promise<void>;
  /** Pulls scores submitted from the web link for one event right now, instead of waiting for the
   * background poll — used for a manual "sync now" action and whenever the app comes to the
   * foreground (a `setInterval` only runs while the app is actually in the foreground, so without
   * this, scores entered while the organizer's phone was locked/backgrounded wouldn't show up
   * until the interval happened to tick again after reopening). No-op if nothing's pending. */
  syncSharedScores: (id: string) => Promise<void>;
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

  const replaceAllEvents = useCallback(
    async (next: WowEvent[]) => {
      await persist(next);
    },
    [persist]
  );

  // Kept fresh on every render so the poll loop below always reads the latest roster, without
  // needing `events` in its own effect deps (which would tear down and restart the interval —
  // and, worse, risk operating on a stale snapshot mid-await — every time any event changes).
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Pulls one event's queued web scores and folds them in, if any are waiting. Shared by the
  // background interval, the app-foreground trigger, and the manual "sync now" action below —
  // one implementation so they can't drift apart.
  const syncOne = useCallback(
    async (ev: WowEvent) => {
      try {
        const updated = await pullPendingScores(ev);
        if (updated === ev) return; // nothing was pending
        const latest = eventsRef.current;
        await persist(latest.map((e) => (e.id === ev.id ? updated : e)));
        pushEventUpdate(updated).catch(() => {});
      } catch {
        // Best-effort — picked up again on the next tick / next foreground / next manual sync.
      }
    },
    [persist]
  );

  const syncAllWebEvents = useCallback(async () => {
    const candidates = eventsRef.current.filter((e) => e.shareId && e.shareInputSource === 'web' && e.status === 'live');
    for (const ev of candidates) {
      await syncOne(ev);
    }
  }, [syncOne]);

  const syncSharedScores = useCallback(
    async (id: string) => {
      const ev = eventsRef.current.find((e) => e.id === id);
      if (ev) await syncOne(ev);
    },
    [syncOne]
  );

  // While an event is toggled to web score entry, the organizer's own phone needs to pull scores
  // submitted from that link back in — sync is otherwise push-only (see pushEventUpdate). This
  // interval only actually runs while the app is in the foreground (React Native suspends JS
  // timers in the background), which is exactly why the AppState listener below also matters.
  useEffect(() => {
    const interval = setInterval(syncAllWebEvents, WEB_SCORE_POLL_MS);
    return () => clearInterval(interval);
  }, [syncAllWebEvents]);

  // Catches up immediately when the app is opened or resumed from the background — otherwise
  // whatever was submitted on web while the phone was locked/backgrounded (when the interval
  // above wasn't running at all) would sit unsynced until the interval happened to tick again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncAllWebEvents();
    });
    return () => sub.remove();
  }, [syncAllWebEvents]);

  // Also catch up right after a cold start, once the roster's actually loaded — AppState's
  // 'change' listener above only fires on a later transition, not the app's very first launch.
  useEffect(() => {
    if (!loading) syncAllWebEvents();
  }, [loading, syncAllWebEvents]);

  const value = useMemo(
    () => ({ events, loading, getEvent, addEvent, updateEvent, deleteEvent, replaceAllEvents, syncSharedScores }),
    [events, loading, getEvent, addEvent, updateEvent, deleteEvent, replaceAllEvents, syncSharedScores]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used within EventsProvider');
  return ctx;
}
