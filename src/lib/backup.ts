import { Platform } from 'react-native';
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

/**
 * Writes every tournament to a local JSON file and opens the share sheet so it can be saved/sent
 * anywhere. expo-file-system's File/Directory API is native-only (its web shim is a stub that
 * throws "this.validatePath is not a function" the moment you touch it), so the web build instead
 * triggers a normal browser download via an object URL.
 */
export async function exportAllData(events: WowEvent[]): Promise<void> {
  const payload: BackupFile = { schema: SCHEMA_VERSION, exportedAt: Date.now(), events };
  const json = JSON.stringify(payload);

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }

  const file = new File(Paths.cache, backupFileName());
  file.create();
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export WOW Padel data' });
}

export type ImportResult = { cancelled: true } | { cancelled: false; events: WowEvent[] };

function parseBackupJson(raw: string): WowEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid JSON — pick a WOW Padel backup file.");
  }
  const events = (parsed as Partial<BackupFile> | null)?.events;
  if (!Array.isArray(events)) {
    throw new Error("That file doesn't look like a WOW Padel backup — no tournaments found in it.");
  }
  return events as WowEvent[];
}

/** Web-only: opens the browser's native file picker via a throwaway `<input type="file">`. */
function pickBackupFileWeb(): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    let settled = false;
    const finishOk = (result: ImportResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      resolve(result);
    };
    const finishErr = (err: unknown) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      reject(err);
    };
    // No file input in any browser fires a reliable "cancel" event across the board, so this
    // falls back to checking for an empty file list once focus returns to the page after the
    // native picker dialog closes (the standard workaround for this gap).
    const onFocus = () => {
      setTimeout(() => {
        if (!settled && input.files && input.files.length === 0) finishOk({ cancelled: true });
      }, 300);
    };
    input.addEventListener('change', async () => {
      const picked = input.files && input.files[0];
      if (!picked) {
        finishOk({ cancelled: true });
        return;
      }
      try {
        const events = parseBackupJson(await picked.text());
        finishOk({ cancelled: false, events });
      } catch (err) {
        finishErr(err);
      }
    });
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

/** Lets the user pick a previously exported JSON file and returns the tournaments found in it. */
export async function pickBackupFile(): Promise<ImportResult> {
  if (Platform.OS === 'web') return pickBackupFileWeb();

  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return { cancelled: true };

  const raw = await picked.result.text();
  return { cancelled: false, events: parseBackupJson(raw) };
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
