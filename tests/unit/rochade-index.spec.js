import { test, expect } from '@playwright/test';
import { watchPage, localRefs, brokenRefs, expectNavigation } from './site-helpers.js';

// The issue PDFs are not part of the repository (.gitignore: *.pdf), so the
// link checks only cover pages, stylesheets, scripts and images.
const notPdf = (url) => url.pathname.endsWith('.pdf');

const YEARS = Array.from({ length: 19 }, (_, i) => 1982 + i); // 1982 .. 2000

async function yearRows(page) {
  return page.locator('#rochade-table > .table-row').evaluateAll((rows) =>
    rows
      .filter((r) => !r.querySelector('.table-head'))
      .map((r) => {
        const cells = Array.from(r.querySelectorAll(':scope > .table-cell'));
        return {
          year: cells[0].textContent.trim(),
          pdfIds: Array.from(r.querySelectorAll('a:not(.rochade_scan_link)')).map((a) => a.id),
          pdfHrefs: Array.from(r.querySelectorAll('a:not(.rochade_scan_link)')).map((a) => a.getAttribute('href')),
          scanUrls: Array.from(r.querySelectorAll('a.rochade_scan_link')).map((a) => a.href),
          cells: cells.slice(1).map((c) => c.textContent.trim()),
        };
      }),
  );
}

test.describe('rochade/index.html', () => {
  test('has title, intro and the active Rochade navigation', async ({ page }) => {
    await watchPage(page);
    await page.goto('/rochade/index.html');
    await expect(page).toHaveTitle('SVWARCHIV');
    await expect(page.locator('.module_hlp')).toHaveText('Die Württemberg Rochade 1982-2000 im PDF Format');
    await expect(page.getByText('Hier können Sie die digitalisierten Ausgaben')).toBeVisible();
    await expectNavigation(page, 'WuerttembergRochade');
    await expect(page.getByRole('link', { name: 'Willkommen' })).toHaveAttribute('href', '../index.html');
  });

  test('table header lists the year column and all twelve months', async ({ page }) => {
    await page.goto('/rochade/index.html');
    const head = page.locator('#rochade-table > .table-row').first().locator('.table-head');
    await expect(head).toHaveText(['Jahr', 'Jan', 'Feb', 'März', 'April', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']);
  });

  test('first issue is June 1982: earlier months are marked n.a.', async ({ page }) => {
    await page.goto('/rochade/index.html');
    const [first] = await yearRows(page);
    expect(first.year).toBe('1982');
    expect(first.cells.slice(0, 5)).toEqual(['n.a.', 'n.a.', 'n.a.', 'n.a.', 'n.a.']);
    expect(first.pdfIds).toEqual(['06', '07', '08', '09', '10', '11', '12'].map((m) => `rochade1982-${m}`));
  });

  test('last issue is June 2000: the rest of 2000 is not in the archive', async ({ page }) => {
    await page.goto('/rochade/index.html');
    const rows = await yearRows(page);
    const last = rows[rows.length - 1];
    expect(last.pdfIds).toEqual(['01', '02', '03', '04', '05', '06'].map((m) => `rochade2000-${m}`));
    expect(last.cells.slice(6)).toEqual(['svw', 'svw', 'svw', 'svw', 'svw', 'svw']);
    await expect(page.locator('a[href="http://schachzeitung.svw.info/"]')).toHaveCount(1);
  });

  test('every year from 1983 to 1999 has twelve issues with OCR PDF and scan', async ({ page }) => {
    await page.goto('/rochade/index.html');
    const rows = await yearRows(page);
    expect(rows).toHaveLength(YEARS.length);
    for (const row of rows.slice(1, -1)) {
      const year = row.pdfIds[0].slice('rochade'.length, 'rochade'.length + 4);
      const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
      expect(row.pdfIds, `issues of ${year}`).toEqual(months.map((m) => `rochade${year}-${m}`));
      expect(row.pdfHrefs).toEqual(months.map((m) => `rochade${year}-${m}.pdf`));
      // scan links point to original-<issue>.pdf in the same directory (line breaks in href are ignored)
      expect(row.scanUrls.map((u) => new URL(u).pathname)).toEqual(
        months.map((m) => `/rochade/original-rochade${year}-${m}.pdf`),
      );
    }
  });

  test('the year label of each row matches the issues it links to', async ({ page }) => {
    // aqaa: confirmed bug - the row with the 1995 issues (rochade1995-01 ... -12) is labelled "1994",
    // so 1994 appears twice and 1995 is missing from the year column.
    await page.goto('/rochade/index.html');
    const rows = await yearRows(page);
    expect(rows.map((r) => r.year)).toEqual(YEARS.map(String));
    for (const row of rows) {
      for (const id of row.pdfIds) expect(id.startsWith(`rochade${row.year}-`), id).toBe(true);
    }
  });

  test('all PDF and scan links open in a new tab', async ({ page }) => {
    await page.goto('/rochade/index.html');
    const targets = await page.locator('#rochade-table a').evaluateAll((as) => as.map((a) => a.target));
    expect(targets.length).toBe(2 * (7 + 17 * 12 + 6));
    expect(new Set(targets)).toEqual(new Set(['_blank']));
  });

  test('local pages, stylesheets, scripts and images load', async ({ page, request }) => {
    await watchPage(page);
    await page.goto('/rochade/index.html');
    const refs = await localRefs(page, { exclude: notPdf });
    expect(refs).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/css\/svwarchiv\.css$/),
      expect.stringMatching(/\/css\/selectize\.css$/),
      expect.stringMatching(/\/css\/jquery2\.min\.js$/),
      expect.stringMatching(/\/css\/selectize\.min\.js$/),
      expect.stringMatching(/\/svwlogo\.gif$/),
      expect.stringMatching(/\/favicon\.ico$/),
    ]));
    expect(await brokenRefs(request, refs)).toEqual([]);
  });

  test('renders without console errors or failed requests', async ({ page }) => {
    const problems = await watchPage(page);
    await page.goto('/rochade/index.html');
    await page.waitForLoadState('load');
    expect(await page.locator('#page-logo img').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
