import { test, expect } from '@playwright/test';
import { watchPage, localRefs, brokenRefs } from '../unit/site-helpers.js';

// The issue PDFs are not part of the repository (.gitignore: *.pdf).
const notPdf = (url) => url.pathname.endsWith('.pdf');
const urlEnds = (path) => new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

// Follows every local link from the start pages like a visitor would. Returns the
// visited page paths and the local assets/pages that did not answer with 2xx.
async function crawl(page, request, starts) {
  const queue = [...starts];
  const visited = new Set();
  const assets = new Set();
  const broken = [];
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    const res = await page.goto(path);
    if (!res.ok()) {
      broken.push(`${res.status()} ${path}`);
      continue;
    }
    for (const ref of await localRefs(page, { exclude: notPdf })) {
      const url = new URL(ref);
      if (url.pathname.endsWith('.html') && url.search === '') {
        queue.push(url.pathname);
      } else if (!assets.has(ref)) {
        assets.add(ref);
        broken.push(...await brokenRefs(request, [ref]));
      }
    }
  }
  return { visited: [...visited].sort(), broken };
}

test.describe('internal link crawl', () => {
  test('every page and asset reachable from the main pages loads without errors', async ({ page, request }) => {
    test.setTimeout(120_000);
    const problems = await watchPage(page);
    const { visited, broken } = await crawl(page, request, [
      '/index.html', '/willkommen.html', '/archiv.html', '/mitmachen.html',
    ]);
    expect(broken).toEqual([]);
    expect(visited).toEqual([
      '/archiv.html',
      '/archivsuche.html',
      '/index.html',
      '/mitmachen.html',
      '/rochade/index.html',
      '/schachinwuerttemberg.html',
      '/willkommen.html',
      '/wuerttembergrochade.html',
    ]);
    expect(problems).toEqual([]);
  });

  test('the book excerpts can be reached from the "Schach in Württemberg" page', async ({ page, request }) => {
    test.skip(true, 'aqaa: open bug, see report');
    // aqaa: suspected bug - schachinwuerttemberg.html says the excerpts are "hier als digitale Auszüge
    // verfügbar", but neither it nor any other main page links to schachinwuerttemberg_offset_*.html,
    // so the 14 excerpt pages are orphaned.
    await watchPage(page);
    const { visited } = await crawl(page, request, ['/index.html']);
    expect(visited).toContain('/schachinwuerttemberg_offset_0.html');
  });
});

test.describe('main navigation', () => {
  test('the menu leads through every module and marks it active', async ({ page }) => {
    const problems = await watchPage(page);
    await page.goto('/willkommen.html');
    const steps = [
      ['Das Online-Archiv', '/archiv.html', 'Das Online-Archiv des SVW', 'Archiv'],
      ['Mitmachen', '/mitmachen.html', 'Mitmachen - Helfen Sie beim Archivaufbau!', 'Mitmachen'],
      ['Suche', '/archivsuche.html', 'Erweiterte Archiv-Suche', 'ArchivSuche'],
      ['Schach In Württemberg', '/schachinwuerttemberg.html', '"Schach in Württemberg" von Prof. Eberhard Herter', 'SchachInWuerttemberg'],
      ['WürttembergRochade', '/wuerttembergrochade.html', 'Württemberg-Rochade Archiv (1982-2000)', 'WuerttembergRochade'],
      ['Willkommen', '/willkommen.html', 'Willkommen beim digitalen Archiv des Schachverbandes Württemberg', 'Willkommen'],
    ];
    for (const [label, path, heading, activeId] of steps) {
      await page.locator('#navigation').getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(urlEnds(path));
      await expect(page.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible();
      await expect(page.locator('#navigation li.active')).toHaveAttribute('id', activeId);
    }
    expect(problems).toEqual([]);
  });

  test('the start page leads into the Rochade PDF archive and back', async ({ page }) => {
    const problems = await watchPage(page);
    await page.goto('/index.html');
    await page.locator('#navigation').getByRole('link', { name: 'WürttembergRochade' }).click();
    await expect(page).toHaveURL(urlEnds('/rochade/index.html'));
    await expect(page.getByText('Die Württemberg Rochade 1982-2000 im PDF Format')).toBeVisible();
    await page.locator('#navigation').getByRole('link', { name: 'Willkommen' }).click();
    await expect(page).toHaveURL(urlEnds('/index.html'));
    // the news entry of May 2015 links the archive as well
    await page.locator('a[href="rochade/index.html"]', { hasText: 'hier' }).click();
    await expect(page).toHaveURL(urlEnds('/rochade/index.html'));
    await page.locator('#navigation').getByRole('link', { name: 'Suche' }).click();
    await expect(page).toHaveURL(urlEnds('/archivsuche.html'));
    expect(problems).toEqual([]);
  });
});

test.describe('Württemberg-Rochade', () => {
  test('overview pages lead to the PDF archive with all years', async ({ page }) => {
    const problems = await watchPage(page);
    await page.goto('/willkommen.html');
    await page.getByRole('link', { name: 'Württemberg-Rochade Archiv' }).click();
    await expect(page).toHaveURL(urlEnds('/wuerttembergrochade.html'));
    await page.getByRole('link', { name: 'Zum Rochade-Archiv' }).click();
    await expect(page).toHaveURL(urlEnds('/rochade/index.html'));
    const yearRows = page.locator('#rochade-table > .table-row:not(:has(.table-head))');
    await expect(yearRows).toHaveCount(19);
    await expect(yearRows.first().locator('> .table-cell').first()).toHaveText('1982');
    await expect(yearRows.last().locator('> .table-cell').first()).toHaveText('2000');
    const june82 = page.locator('#rochade1982-06');
    await expect(june82).toHaveText('PDF');
    await expect(june82).toHaveAttribute('href', 'rochade1982-06.pdf');
    await expect(page.locator('#rochade1982-06scan')).toHaveText('Scan');
    expect(problems).toEqual([]);

    await page.goto('/rochade.html');
    await page.getByRole('link', { name: 'Zum PDF-Archiv' }).click();
    await expect(page).toHaveURL(urlEnds('/rochade/index.html'));
    expect(problems).toEqual([]);
  });

  test('rochade/index.html loads its ../css assets and runs its scripts without errors', async ({ page }) => {
    const problems = await watchPage(page);
    const loaded = [];
    page.on('response', (res) => { if (res.ok()) loaded.push(new URL(res.url()).pathname); });
    await page.goto('/rochade/index.html');
    await page.waitForLoadState('load');
    expect(loaded).toEqual(expect.arrayContaining([
      '/css/svwarchiv.css', '/css/selectize.css', '/css/jquery2.min.js', '/css/selectize.min.js', '/svwlogo.gif',
    ]));
    expect(await page.evaluate(() => typeof window.jQuery.fn.selectize)).toBe('function');
    // the stylesheet is applied: the issue table is rendered as a CSS table
    await expect(page.locator('#rochade-table')).toHaveCSS('display', 'table');
    expect(problems).toEqual([]);
  });

  test('the year sections list the same issues as the PDF archive', async ({ page, request }) => {
    // aqaa: bug - year_sections.html lists January-May 1982 (marked n.a. in rochade/index.html,
    // the first issue is June 1982), only five issues of 1999 and no year 2000 at all, while
    // rochade/index.html links all twelve 1999 issues and January-June 2000.
    const issuesOf = async (path, selector) => {
      const html = await (await request.get(path)).text();
      return page.evaluate(([src, sel]) => {
        const doc = new DOMParser().parseFromString(src, 'text/html');
        return Array.from(doc.querySelectorAll(sel)).map((a) => a.getAttribute('href').trim());
      }, [html, selector]);
    };
    await page.goto('/index.html');
    const archive = await issuesOf('/rochade/index.html', '#rochade-table a:not(.rochade_scan_link)');
    const sections = await issuesOf('/year_sections.html', 'a.pdf-button.pdf');
    expect(archive).toHaveLength(7 + 17 * 12 + 6);
    expect(sections).toEqual(archive);
  });
});

test.describe('Schach in Württemberg excerpts', () => {
  const pageOf = (n) => `/schachinwuerttemberg_offset_${n}.html`;

  test('a reader jumps to the last excerpt, pages back to the first and returns to the overview', async ({ page }) => {
    test.setTimeout(60_000);
    await watchPage(page);
    await page.goto(pageOf(0));
    const pager = () => page.locator('.pager').last();
    await pager().getByRole('link', { name: '14', exact: true }).click();
    await expect(page).toHaveURL(urlEnds(pageOf(13)));
    await expect(pager().getByRole('link', { name: '>>' })).toHaveCount(0);
    const titles = new Set([await page.locator('.survey_wrapper strong').first().textContent()]);
    for (let n = 12; n >= 0; n--) {
      await pager().getByRole('link', { name: '<<' }).click();
      await expect(page).toHaveURL(urlEnds(pageOf(n)));
      await expect(pager()).toContainText(`Resultate ${n + 1} bis ${n + 1} von 14`);
      titles.add(await page.locator('.survey_wrapper strong').first().textContent());
    }
    await expect(pager().getByRole('link', { name: '<<' })).toHaveCount(0);
    expect(titles.size).toBe(14);
    await page.locator('#navigation').getByRole('link', { name: 'Schach In Württemberg' }).click();
    await expect(page).toHaveURL(urlEnds('/schachinwuerttemberg.html'));
  });

  test('every pager link of every excerpt page points to an existing page', async ({ request }) => {
    const broken = [];
    for (let n = 0; n <= 13; n++) {
      const html = await (await request.get(pageOf(n))).text();
      const hrefs = [...html.matchAll(/href="(schachinwuerttemberg_offset_\d+\.html)"/g)].map((m) => `/${m[1]}`);
      expect(hrefs.length, pageOf(n)).toBeGreaterThanOrEqual(2 * 14);
      for (const href of new Set(hrefs)) {
        if (!(await request.get(href)).ok()) broken.push(`${pageOf(n)} -> ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
