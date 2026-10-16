import { test, expect } from '@playwright/test';

test('boots with no page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.screenshot({ path: 'test-results/boot.png' });
  expect(errors).toEqual([]);
});
