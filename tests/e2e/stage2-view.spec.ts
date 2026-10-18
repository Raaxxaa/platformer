import { test, expect, type Page } from '@playwright/test';

async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

for (const road of ['mountains', 'swamps']) {
  test(`${road} boots with its available art or grey fallback and no page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/assets/') && response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    await page.goto(`/?debug=1&start=${road}&seed=STAGE2-VIEW`);
    await page.waitForFunction(() => (window as any).__game?.ready === true, undefined, { timeout: 10_000 });
    await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(2, {}); });
    expect(await page.evaluate(() => (window as any).__game.levelId())).toBe(road);
    await nextFrames(page);
    await page.screenshot({ path: `test-results/m71-view-${road}-boot.png` });
    expect(errors).toEqual([]);
  });
}

test('the dark hollow dims unlit space while the player light stays clear', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/assets/') && response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto('/?debug=1&start=swamps&section=3&seed=STAGE2-VIEW');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  const points = await page.evaluate(() => {
    const g = (window as any).__game;
    g.setManual(true); g.step(2, {});
    const body = g.body(), camera = g.camera();
    return [{ x: body.x - camera.x, y: body.y - 50 - camera.y }, { x: body.x + 230 - camera.x, y: body.y - 130 - camera.y }];
  });
  await nextFrames(page);
  const shot = await page.locator('canvas').screenshot({ path: 'test-results/m71-view-dark-hollow.png' });
  const brightness = await page.evaluate(async ({ png, points }) => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return points.map(p => {
      const [r, g, b] = ctx.getImageData(Math.round(p.x * image.width / 640), Math.round(p.y * image.height / 360), 1, 1).data;
      return r + g + b;
    });
  }, { png: shot.toString('base64'), points });
  expect(brightness[0], `lit/unlit RGB sums: ${brightness}`).toBeGreaterThan(0);
  expect(brightness[1], `lit/unlit RGB sums: ${brightness}`).toBeLessThan(brightness[0] * 0.6);
  expect(errors).toEqual([]);
});
