// Ghost storage (06 §14): its own localStorage key, outside SaveData. Every read and write is wrapped; a failure means no ghost.
import { GHOST } from '../../data/practice.ts';
import { decodeGhost, encodeGhost, type GhostSample } from './codec.ts';

export interface GhostStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
type GhostFile = { v: number; ghosts: Record<string, { ticks: number; data: string }> };

function read(storage: GhostStorage): GhostFile {
  try {
    const raw = storage.getItem(GHOST.storageKey), parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.v === GHOST.version && parsed.ghosts && typeof parsed.ghosts === 'object') return parsed as GhostFile;
  } catch { /* no ghost */ }
  return { v: GHOST.version, ghosts: {} };
}
const defaultStorage = (): GhostStorage | null => { try { return window.localStorage; } catch { return null; } };

/** On `practiceBestSaved`: replaces the key's ghost with this attempt. */
export function saveGhost(key: string, ticks: number, samples: readonly GhostSample[], storage: GhostStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    const file = read(storage); file.ghosts[key] = { ticks, data: encodeGhost(samples) };
    storage.setItem(GHOST.storageKey, JSON.stringify(file)); return true;
  } catch { return false; }
}
/** The ghost for a key, only if its `ticks` equals the practice best (a save import can leave a stale ghost). */
export function loadGhost(key: string, practiceBest: number | undefined, storage: GhostStorage | null = defaultStorage()): GhostSample[] | null {
  if (!storage || practiceBest === undefined) return null;
  try {
    const g = read(storage).ghosts[key];
    if (!g || g.ticks !== practiceBest) return null;
    return decodeGhost(g.data);
  } catch { return null; }
}
