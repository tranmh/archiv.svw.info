import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home page logo image has alternative text (axe image-alt)', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).include("img").withRules(["image-alt"]).analyze();
  expect(results.violations).toEqual([]);
});
