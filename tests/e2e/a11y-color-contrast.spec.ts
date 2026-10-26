import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('a11y: nav link WürttembergRochade on / meets color contrast', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .include("#WuerttembergRochade > a[href=\"rochade/index.html\"]")
    .withRules(["color-contrast"])
    .analyze();
  expect(results.violations).toEqual([]);
});
