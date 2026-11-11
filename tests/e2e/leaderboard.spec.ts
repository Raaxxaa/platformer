import { test, expect, type Page } from '@playwright/test';

// M18 (06 §14.3): the daily leaderboard against a mocked server — the board screen, and the queued score sent on launch.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([fn, a]) => (window as any).__game?.[fn as string]?.(...(a as unknown[])), [fn, a] as const);
const HOST = 'https://board.test';

test('Leaderboard: the queued score is sent on launch; Title → Daily → Leaderboard lists the day', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  const posted: unknown[] = [];
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await page.route(`${HOST}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'POST') { posted.push(JSON.parse(req.postData() ?? '{}')); await route.fulfill({ status: 201, body: '' }); return; }
    const assist = req.url().includes('assist=eq.true');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(assist ? [] : [
      { name: 'speedy', ticks: 52000, class: 'tank', weapon: 'war_maul', road: 'forest' },
      { name: 'Me_Me', ticks: 61234, class: 'archer', weapon: 'bow', road: 'mountain' },
      { name: 'slowpoke', ticks: 90000, class: 'wizard', weapon: 'staff', road: 'forest' }]) });
  });
  await page.addInitScript(([day]) => {
    localStorage.setItem('rushblade.save', JSON.stringify({ v: 1, settings: { online: { name: 'Me_Me', enabled: true } },
      onlineQueue: { day, name: 'Me_Me', ticks: 61234, class: 'archer', weapon: 'bow', road: 'mountain', assist: false },
      daily: { [day]: { official: { result: 'complete', ticks: 61234, stageReached: 4, splits: [1, 2, 3, 61234], road: 'mountain', assist: false }, bestTicks: 61234, attempts: 1 } } }));
  }, [day]);
  await page.goto(`/?debug=1&records=1&online=${encodeURIComponent(HOST)}`);
  await page.waitForFunction(() => (window as any).__game?.ready);
  await expect.poll(() => posted.length).toBe(1);
  expect(posted[0]).toEqual({ day, name: 'Me_Me', ticks: 61234, class: 'archer', weapon: 'bow', road: 'mountain', assist: false });
  await expect.poll(async () => { const s = await g(page, 'save'); return [s.onlineQueue, s.daily[day].sent]; }).toEqual([null, true]);
  await page.keyboard.press('Space');
  await g(page, 'titleRun', 'daily');
  await expect.poll(async () => (await g(page, 'screenState')).model?.rows).toContain('leaderboard');
  for (let i = 0; i < 3; i++) await g(page, 'screenAction', 'down');
  await g(page, 'screenAction', 'confirm');
  await expect.poll(async () => (await g(page, 'screenState')).model?.rows?.length).toBe(3);
  await page.waitForTimeout(200); await frames(page);
  await page.screenshot({ path: 'test-results/m18-leaderboard.png' });
  expect(errors).toEqual([]);
});
