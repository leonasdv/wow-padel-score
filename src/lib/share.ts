import * as Crypto from 'expo-crypto';
import { applyScore, computeStandings, sortStandings } from './tournament';
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
    thirdPlaceMatch: event.thirdPlaceMatch, // knockout only — lives outside `rounds`
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

/** The separate "score entry" link — distinct from the read-only viewer link above, and only
 * usable while the event is toggled to web input (see setShareInputSource). */
export function editorShareUrlFor(shareId: string, editorToken: string): string {
  const base = process.env.EXPO_PUBLIC_SHARE_BASE_URL;
  if (!base) return `${shareId}&editor=${editorToken}`;
  return `${base.replace(/\/$/, '')}/?e=${shareId}&editor=${editorToken}`;
}

/** Publishes an event for the first time. Returns the event patched with shareId/editToken/editorToken — caller must persist it via updateEvent. */
export async function publishEvent(event: WowEvent): Promise<WowEvent> {
  const shareId = makeId('e');
  const editToken = Crypto.randomUUID();
  const editorToken = Crypto.randomUUID();
  const { error } = await supabase.rpc('create_shared_event', {
    p_share_id: shareId,
    p_edit_token: editToken,
    p_editor_token: editorToken,
    p_payload: buildPayload(event),
  });
  if (error) throw error;
  return { ...event, shareId, editToken, editorToken, shareInputSource: 'app' };
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

/** Unpublishes an event. Returns the event with all share-related fields cleared — caller must persist it via updateEvent. */
export async function unpublishEvent(event: WowEvent): Promise<WowEvent> {
  if (event.shareId && event.editToken) {
    const { error } = await supabase.rpc('unpublish_shared_event', {
      p_share_id: event.shareId,
      p_edit_token: event.editToken,
    });
    if (error) throw error;
  }
  const { shareId, editToken, editorToken, shareInputSource, ...rest } = event;
  return rest as WowEvent;
}

/**
 * Flips who's currently allowed to submit scores for a published event. Switching back to
 * `'app'` first pulls any scores submitted on web moments earlier (see pullPendingScores), so the
 * app resuming as writer can never silently clobber them.
 */
export async function setShareInputSource(event: WowEvent, source: 'app' | 'web'): Promise<WowEvent> {
  if (!event.shareId || !event.editToken) return event;
  const { error } = await supabase.rpc('set_shared_input_source', {
    p_share_id: event.shareId,
    p_edit_token: event.editToken,
    p_source: source,
  });
  if (error) throw error;
  const next: WowEvent = { ...event, shareInputSource: source };
  return source === 'app' ? pullPendingScores(next) : next;
}

interface PendingScoreRow {
  id: number;
  round_index: number;
  court_id: string;
  team: 'A' | 'B';
  value: number;
}

/**
 * Pulls any scores submitted via the web score-entry link and folds them into the event through
 * `applyScore` — the exact same scoring + auto-advance rules the app's own keypad uses — then
 * acknowledges them so they aren't re-applied on the next pull. Never throws; returns the event
 * unchanged if there's nothing pending, the event isn't published, or the pull itself fails.
 */
export async function pullPendingScores(event: WowEvent): Promise<WowEvent> {
  if (!event.shareId || !event.editToken) return event;
  const { data, error } = await supabase.rpc('get_pending_score_submissions', {
    p_share_id: event.shareId,
    p_edit_token: event.editToken,
  });
  if (error) {
    console.warn('Failed to pull pending scores', event.id, error.message);
    return event;
  }
  const rows = (data ?? []) as PendingScoreRow[];
  if (rows.length === 0) return event;

  let next = event;
  for (const row of rows) {
    next = applyScore(next, row.round_index, row.court_id, row.team, row.value);
  }

  const { error: ackError } = await supabase.rpc('ack_score_submissions', {
    p_share_id: event.shareId,
    p_edit_token: event.editToken,
    p_ids: rows.map((r) => r.id),
  });
  if (ackError) console.warn('Failed to ack pending scores', event.id, ackError.message);
  return next;
}
