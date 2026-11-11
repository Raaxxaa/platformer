import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// M12 Task 6: the game installs as an app and runs offline after one load.
// Review C7: context.setOffline does not cut the service worker's own network in Chromium, so this test serves the
// build from its own small server and closes that server before reloading: only the saved copy can answer then.
function serveDist(): Promise<{ url: string; close: () => Promise<void> }> {
  const root = path.resolve('dist');
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav',
    '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.fnt': 'text/xml', '.xml': 'text/xml', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let f = path.join(root, u === '/' ? 'index.html' : u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => {
    const port = (server.address() as { port: number }).port;
    ok({ url: `http://127.0.0.1:${port}`, close: () => new Promise((done) => { server.closeAllConnections(); server.close(() => done()); }) });
  }));
}

test('after one load the game starts with the network off', async ({ page }) => {
  test.slow();
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  const srv = await serveDist();
  await page.goto(`${srv.url}/?debug=1&sw=1&start=plains&seed=OFFLINE&kit=swordsman:greatsword`);
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  // The worker has saved the build: it is active and controls the page.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  const saved = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return { keys, count: (await c.keys()).length }; });
  expect(saved.keys.length).toBe(1); expect(saved.count).toBeGreaterThan(300);
  await srv.close();                                      // the server is gone: nothing but the saved copy can answer
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  expect(await page.evaluate(() => (window as any).__game.levelId())).toBe('plains');
  expect(errors).toEqual([]);
});

test('the manifest and icons are served', async ({ request }) => {
  const m = await request.get('/manifest.webmanifest'); expect(m.ok()).toBe(true);
  expect((await m.json()).display).toBe('fullscreen');
  expect((await request.get('/assets/app/icon-512.png')).ok()).toBe(true);
  expect((await request.get('/precache.json')).ok()).toBe(true);
});
