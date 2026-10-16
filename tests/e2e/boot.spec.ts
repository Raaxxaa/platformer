import { test, expect, type Page } from '@playwright/test';

async function canvasBox(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

test('boots with no page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.screenshot({ path: 'test-results/boot.png' });
  expect(errors).toEqual([]);
});

test('scales by a whole number and centers with black bars', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  expect(await canvasBox(page)).toMatchObject({ w: 1280, h: 720 });

  await page.setViewportSize({ width: 1000, height: 600 });
  await expect.poll(() => canvasBox(page)).toMatchObject({ w: 640, h: 360 });
  const box = await canvasBox(page);
  expect(box.x).toBeCloseTo((1000 - 640) / 2, 0);
  expect(box.y).toBeCloseTo((600 - 360) / 2, 0);
  await page.screenshot({ path: 'test-results/boot-1000x600.png' });
});
