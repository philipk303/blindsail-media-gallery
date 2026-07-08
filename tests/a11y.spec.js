import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const pageName of ['index.html', 'voices.html', 'logbook.html']) {
  test(`${pageName} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.route('**/media.local.json', route => route.fulfill({ status: 404 }));
    await page.goto(`/${pageName}`);
    await page.waitForLoadState('networkidle');
    // Let entrance animations (e.g. the hero title fade-in) reach their settled
    // state before scanning; skip infinite decorative loops whose `finished`
    // promise never resolves.
    await page.evaluate(() => Promise.all(
      document.getAnimations()
        .filter(a => a.effect.getTiming().iterations !== Infinity)
        .map(a => a.finished)
    ));
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // YouTube's own IFrame API player chrome (rendered inside the embed
      // iframe) has its own aria markup we don't control and can't fix;
      // Able Player supplies the accessible control layer around it.
      .exclude('.able-media-container iframe')
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
