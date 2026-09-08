import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { WowEvent } from '../types';

const SCHEMA_VERSION = 1;

interface BackupFile {
  schema: number;
  exportedAt: number;
  events: WowEvent[];
}

function backupFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `wow-padel-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

/** Writes every tournament to a local JSON file and opens the share sheet so it can be saved/sent anywhere. */
export async function exportAllData(events: WowEvent[]): Promise<void> {
  const payload: BackupFile = { schema: SCHEMA_VERSION, exportedAt: Date.now(), events };
  const file = new File(Paths.cache, backupFileName());
  file.create();
  file.write(JSON.stringify(payload));

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export WOW Padel data' });
}

export type ImportResult = { cancelled: true } | { cancelled: false; events: WowEvent[] };

/** Lets the user pick a previously exported JSON file and returns the tournaments found in it. */
export async function pickBackupFile(): Promise<ImportResult> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return { cancelled: true };

  let parsed: unknown;
  try {
    parsed = await picked.result.json();
  } catch {
    throw new Error("That file isn't valid JSON — pick a WOW Padel backup file.");
  }
  const events = (parsed as Partial<BackupFile> | null)?.events;
  if (!Array.isArray(events)) {
    throw new Error("That file doesn't look like a WOW Padel backup — no tournaments found in it.");
  }
  return { cancelled: false, events: events as WowEvent[] };
}

/** Merges imported tournaments into the existing roster: new ids are added, matching ids are overwritten, nothing existing is removed. */
export function mergeEvents(existing: WowEvent[], incoming: WowEvent[]): { merged: WowEvent[]; added: number; updated: number } {
  const existingIds = new Set(existing.map((e) => e.id));
  const byId = new Map(existing.map((e) => [e.id, e]));
  let added = 0;
  let updated = 0;
  for (const ev of incoming) {
    if (existingIds.has(ev.id)) updated += 1;
    else added += 1;
    byId.set(ev.id, ev);
  }
  const newFirst = incoming.filter((e) => !existingIds.has(e.id));
  const rest = existing.map((e) => byId.get(e.id)!);
  return { merged: [...newFirst, ...rest], added, updated };
}
