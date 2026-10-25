import { test, expect } from '@playwright/test';

// M12 Task 6: the game installs as an app and runs offline after one load.
test('after one load the game starts with the network off', async ({ page, context }) => {
  test.slow();
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&sw=1&start=plains&seed=OFFLINE&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  // The worker has saved the build: it is active and controls the page.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  const saved = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return { keys, count: (await c.keys()).length }; });
  expect(saved.keys.length).toBe(1); expect(saved.count).toBeGreaterThan(300);
  await context.setOffline(true);
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
