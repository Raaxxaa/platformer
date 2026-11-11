import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Runs public/sw.js against a small fake of the browser's cache, to check what the worker answers offline.
// The fake follows the real rule that matters here: a saved answer with a `Vary` header only matches a request
// whose headers are the same, unless the caller asks to ignore that (review 2026-11).
type Listener = (event: { request: Request; respondWith(p: Promise<Response>): void }) => void;
interface Saved { url: string; requestHeaders: Record<string, string>; response: Response }

function loadWorker(saved: Saved[], online: boolean) {
  const listeners: Record<string, Listener> = {};
  const self = { location: { origin: 'https://game.test' }, addEventListener: (type: string, fn: Listener) => { listeners[type] = fn; }, registration: {}, clients: { matchAll: async () => [], claim: async () => {} } };
  const caches = {
    async match(req: Request | string, opts: { ignoreVary?: boolean; ignoreSearch?: boolean } = {}) {
      const r = typeof req === 'string' ? new Request(new URL(req, 'https://game.test/')) : req;
      const strip = (u: string) => (opts.ignoreSearch ? u.split('?')[0] : u);
      return saved.find((s) => {
        if (strip(s.url) !== strip(r.url)) return false;
        if (opts.ignoreVary) return true;
        const vary = (s.response.headers.get('vary') ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
        return vary.every((h) => (s.requestHeaders[h] ?? null) === r.headers.get(h));
      })?.response.clone();
    },
    async open() { return { addAll: async () => {} }; }, async keys() { return []; }, async delete() { return true; },
  };
  const fetchFake = async () => { if (!online) throw new TypeError('Failed to fetch'); return new Response('from network'); };
  new Function('self', 'caches', 'fetch', readFileSync('public/sw.js', 'utf8'))(self, caches, fetchFake);
  return async (request: Request): Promise<string> => {
    let answer: Promise<Response> | null = null;
    listeners.fetch({ request, respondWith: (p) => { answer = p; } });
    if (!answer) return 'not handled';
    try { return await (await (answer as Promise<Response>)).text(); } catch { return 'FAILED'; }
  };
}

describe('the service worker answers from the saved copy when offline', () => {
  const script = 'https://game.test/assets/index-abc.js';
  it('serves a saved file even when the host marks answers "Vary: Origin" and the page asks with an Origin header', async () => {
    // Saved by the worker itself (no Origin header); asked for by <script type="module" crossorigin> (with one).
    const saved: Saved[] = [{ url: script, requestHeaders: {}, response: new Response('saved game code', { headers: { Vary: 'Origin' } }) }];
    const ask = loadWorker(saved, false);
    expect(await ask(new Request(script, { headers: { Origin: 'https://game.test' } }))).toBe('saved game code');
  });
  it('still answers the page itself from the saved copy, whatever its ?query', async () => {
    const saved: Saved[] = [{ url: 'https://game.test/', requestHeaders: {}, response: new Response('saved page') }];
    const ask = loadWorker(saved, false);
    const nav = new Request('https://game.test/?start=plains'); Object.defineProperty(nav, 'mode', { value: 'navigate' });
    expect(await ask(nav)).toBe('saved page');
  });
  it('leaves other sites alone', async () => {
    expect(await loadWorker([], true)(new Request('https://elsewhere.test/api'))).toBe('not handled');
  });
});

describe('the stamped build version (review C11)', () => {
  it('activate keeps only its own stamped cache, without fetching precache.json', async () => {
    const src = readFileSync('public/sw.js', 'utf8').replace('const BUILD = null;', "const BUILD = 'v2';");
    const listeners: Record<string, (e: { waitUntil(p: Promise<unknown>): void }) => void> = {};
    const deleted: string[] = []; let fetched = 0; let done: Promise<unknown> = Promise.resolve();
    const self = { addEventListener: (t: string, f: never) => { listeners[t] = f; }, clients: { claim: async () => {} }, location: { origin: 'x' } };
    const caches = { keys: async () => ['rushblade-v1', 'rushblade-v2', 'other'], delete: async (k: string) => { deleted.push(k); return true; } };
    new Function('self', 'caches', 'fetch', src)(self, caches, async () => { fetched++; throw new Error('offline'); });
    listeners.activate({ waitUntil: (p) => { done = p; } }); await done;
    expect(deleted).toEqual(['rushblade-v1']); expect(fetched).toBe(0);
  });
});
