import * as Crypto from 'expo-crypto';
import { computeStandings, sortStandings } from './tournament';
import { makeId } from './id';
import { supabase } from './supabase';
import type { WowEvent } from '../types';

function buildPayload(event: WowEvent) {
  const standings = sortStandings(computeStandings(event), 'points', event.rounds);
  return {
    name: event.name,
    format: event.format,
    scoringMode: event.scoringMode,
    courts: event.courts,
    players: event.players,
    rounds: event.rounds,
    currentRoundIndex: event.currentRoundIndex,
    totalRoundsEstimate: event.totalRoundsEstimate,
    status: event.status,
    standings,
  };
}

/** Base URL of the deployed public web viewer (e.g. https://your-app.vercel.app). */
export function shareUrlFor(shareId: string): string {
  const base = process.env.EXPO_PUBLIC_SHARE_BASE_URL;
  if (!base) return shareId;
  return `${base.replace(/\/$/, '')}/?e=${shareId}`;
}

/** Publishes an event for the first time. Returns the event patched with shareId/editToken — caller must persist it via updateEvent. */
export async function publishEvent(event: WowEvent): Promise<WowEvent> {
  const shareId = makeId('e');
  const editToken = Crypto.randomUUID();
  const { error } = await supabase.rpc('create_shared_event', {
    p_share_id: shareId,
    p_edit_token: editToken,
    p_payload: buildPayload(event),
  });
  if (error) throw error;
  return { ...event, shareId, editToken };
}

/** Best-effort sync of the latest rounds/standings to a previously published event. Never throws. */
export async function pushEventUpdate(event: WowEvent): Promise<void> {
  if (!event.shareId || !event.editToken) return;
  const { error } = await supabase.rpc('update_shared_event', {
    p_share_id: event.shareId,
    p_edit_token: event.editToken,
    p_payload: buildPayload(event),
  });
  if (error) console.warn('Failed to sync shared event', event.id, error.message);
}

/** Unpublishes an event. Returns the event with shareId/editToken cleared — caller must persist it via updateEvent. */
export async function unpublishEvent(event: WowEvent): Promise<WowEvent> {
  if (event.shareId && event.editToken) {
    const { error } = await supabase.rpc('unpublish_shared_event', {
      p_share_id: event.shareId,
      p_edit_token: event.editToken,
    });
    if (error) throw error;
  }
  const { shareId, editToken, ...rest } = event;
  return rest as WowEvent;
}
