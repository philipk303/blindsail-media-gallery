import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/media.local.json', route => route.fulfill({ status: 404 }));
});

test('ambient toggle is keyboard-operable and persists', async ({ page }) => {
  await page.goto('/index.html');
  const toggle = page.locator('#ambient-toggle');
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('#ambient-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('skip link is the first focusable element', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
});

test('reduced motion sets the html class', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveClass(/reduced-motion/);
});

test('logbook renders photo cards with disabled AD buttons from sample data', async ({ page }) => {
  await page.goto('/logbook.html');
  const adButton = page.locator('.ad-button').first();
  await expect(adButton).toBeDisabled();
  await expect(adButton).toHaveText('Audio description not yet available');
});

test('voices renders interview cards with transcripts', async ({ page }) => {
  await page.goto('/voices.html');
  await expect(page.locator('.media-card')).toHaveCount(2);
  await expect(page.locator('details summary').first()).toHaveText('Transcript');
});
