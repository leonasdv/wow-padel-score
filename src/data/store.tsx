import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { WowEvent } from '../types';

const STORAGE_KEY = '@wow_padel_score/events';

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
      await persist(events.map((e) => (e.id === id ? updater(e) : e)));
    },
    [events, persist]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      await persist(events.filter((e) => e.id !== id));
    },
    [events, persist]
  );

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
