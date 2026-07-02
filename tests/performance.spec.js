import { test, expect } from '@playwright/test';

test('index.html initial load stays within a 3MB mobile budget', async ({ page }) => {
  await page.route('**/media.local.json', route => route.fulfill({ status: 404 }));
  let totalBytes = 0;
  page.on('response', async (response) => {
    try {
      const body = await response.body();
      totalBytes += body.length;
    } catch { /* redirects/aborted */ }
  });
  await page.goto('/index.html', { waitUntil: 'networkidle' });
  console.log(`index.html total transfer: ${(totalBytes / 1024).toFixed(1)} KiB`);
  expect(totalBytes).toBeLessThan(3 * 1024 * 1024);
});
