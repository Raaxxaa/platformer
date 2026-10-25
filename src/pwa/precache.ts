// The list of files the service worker saves for offline play (M12 Task 6). Pure: the Vite plugin feeds it the built files.
export interface PrecacheFile { path: string; size: number }
export interface PrecacheList { version: string; files: string[] }
const SKIP = new Set(['sw.js', 'precache.json']);

/** Every built file except the worker itself and this list, as `./path`, in a stable order, with a version that changes when any file does. */
export function buildPrecache(files: readonly PrecacheFile[]): PrecacheList {
  const kept = files.filter((f) => !SKIP.has(f.path)).map((f) => ({ ...f })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  let h = 0x811c9dc5;
  for (const f of kept) for (const ch of `${f.path}:${f.size};`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return { version: h.toString(16).padStart(8, '0'), files: ['./', ...kept.map((f) => `./${f.path}`)] };
}
