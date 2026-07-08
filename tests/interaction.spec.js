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

test('logbook renders photo cards with a playable AD button', async ({ page }) => {
  await page.goto('/logbook.html');
  const photoCard = page.locator('.media-card', { has: page.locator('img') }).first();
  const adButton = photoCard.locator('.ad-button');
  await expect(adButton).toBeEnabled();
  await expect(adButton).toHaveText('Play audio description');
});

test('voices shows an empty-state message when no interviews are published', async ({ page }) => {
  await page.goto('/voices.html');
  await expect(page.locator('.media-card')).toHaveCount(0);
  await expect(page.locator('.voices-empty')).toBeVisible();
});
