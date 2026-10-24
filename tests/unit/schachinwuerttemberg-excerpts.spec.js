import { test, expect } from '@playwright/test';
import { watchPage, localRefs, brokenRefs, expectNavigation } from './site-helpers.js';

// Excerpt pages of "Schach in Württemberg": schachinwuerttemberg_offset_<n>.html, n = 0 .. 13.
const TITLES = [
  'Der Tübinger Springer',
  'Herzog August',
  'Ludwig Bachmann',
  'Der Schwäbische Schachbund',
  'Schwäbischer Schachbund',
  'Württembergische Meister bis 1945',
  'Eberhardsbau, Fürstenhof, Aljechin und Hess',
  'Der Schwäbische Schachbund - Mannschaftswettbewerbe',
  'Arbeiterschach - Paul Schleif',
  'Graf Eberhard Bau',
  'Arbeiterschach',
  'Füerstenhof',
  'Der Schwäbische Schachbund - Otto Kaufmann',
  'Eberhard Herter - Schach in Württemberg',
];
const LAST = TITLES.length - 1;
const pageOf = (n) => `schachinwuerttemberg_offset_${n}.html`;

for (let n = 0; n <= LAST; n++) {
  test.describe(pageOf(n), () => {
    test('shows the excerpt, the active module and the search box', async ({ page }) => {
      await watchPage(page);
      await page.goto(`/${pageOf(n)}`);
      await expect(page).toHaveTitle('SVWARCHIV');
      await expectNavigation(page, 'SchachInWuerttemberg');
      await expect(page.locator('.table_header')).toContainText('Auszüge aus dem Buch');
      await expect(page.locator('.survey_wrapper strong').first()).toHaveText(TITLES[n].trim());
      const search = page.locator('form.search_form');
      await expect(search.getByRole('button', { name: 'Suchen' })).toBeVisible();
      await expect(search.locator('input[name="module"]')).toHaveValue('SchachInWuerttemberg');
    });

    test('pager shows the position and links to all pages', async ({ page }) => {
      await page.goto(`/${pageOf(n)}`);
      const pagers = page.locator('.pager');
      await expect(pagers).toHaveCount(2);
      for (const pager of await pagers.all()) {
        await expect(pager).toContainText(`Resultate ${n + 1} bis ${n + 1} von 14`);
        await expect(pager.locator('.active.selected')).toHaveText(String(n + 1));
        const pageLinks = pager.locator('.pagination a:not(.prev):not(.next)');
        await expect(pageLinks).toHaveCount(14);
        for (let i = 0; i <= LAST; i++) {
          await expect(pageLinks.nth(i)).toHaveAttribute('href', pageOf(i));
        }
      }
    });

    test('previous/next links stop at the first and last page', async ({ page }) => {
      await page.goto(`/${pageOf(n)}`);
      const pager = page.locator('.pager').first();
      if (n === 0) {
        await expect(pager.locator('a.prev')).toHaveCount(0);
      } else {
        await expect(pager.locator('a.prev')).toHaveAttribute('href', pageOf(n - 1));
      }
      if (n === LAST) {
        await expect(pager.locator('a.next')).toHaveCount(0);
      } else {
        await expect(pager.locator('a.next')).toHaveAttribute('href', pageOf(n + 1));
      }
    });

    test('stylesheets, scripts, logo and page links load', async ({ page, request }) => {
      await watchPage(page);
      await page.goto(`/${pageOf(n)}`);
      // Only the shared site assets and the .html links here; the excerpt image and the
      // book download are checked separately below.
      const refs = await localRefs(page, {
        exclude: (url) => url.pathname === '/index.php' || url.search !== '',
      });
      expect(await brokenRefs(request, refs)).toEqual([]);
    });
  });
}

test('the excerpt images and the book download link resolve on the static site', async ({ page, request }) => {
  test.skip(true, 'aqaa: open bug, see report');
  // aqaa: suspected bug - the excerpt pages still point at the old PHP backend:
  // <img src="/index.php?action=download&file=...&size=thumb"> and the book download
  // <a href="?module=Archiv&action=download&file=27.pdf"> (which only reloads the page itself).
  // Neither exists in the static site, so every excerpt image is broken (HTTP 404).
  const broken = [];
  for (let n = 0; n <= LAST; n++) {
    await page.goto(`/${pageOf(n)}`);
    const imgs = await page.locator('.survey_wrapper img').evaluateAll((els) => els.map((i) => i.src));
    broken.push(...await brokenRefs(request, imgs));
    const download = page.getByRole('link', { name: 'Download' });
    await expect(download).not.toHaveAttribute('href', /^\?module=/);
  }
  expect(broken).toEqual([]);
});

test('excerpt pages render without failed requests', async ({ page }) => {
  test.skip(true, 'aqaa: open bug, see report');
  // aqaa: suspected bug - see above: the /index.php thumbnails fail with 404 and log console errors.
  const problems = await watchPage(page);
  await page.goto(`/${pageOf(0)}`);
  await page.waitForLoadState('load');
  expect(problems).toEqual([]);
});

test('next links walk through all excerpts from the first to the last page', async ({ page }) => {
  await watchPage(page);
  await page.goto(`/${pageOf(0)}`);
  for (let n = 1; n <= LAST; n++) {
    await page.locator('.pager').first().getByRole('link', { name: '>>' }).click();
    await expect(page).toHaveURL(new RegExp(`${pageOf(n).replace('.', '\\.')}$`));
    await expect(page.locator('.survey_wrapper strong').first()).toHaveText(TITLES[n].trim());
  }
  await page.locator('.pager').first().getByRole('link', { name: '<<' }).click();
  await expect(page).toHaveURL(new RegExp(`${pageOf(LAST - 1).replace('.', '\\.')}$`));
});
