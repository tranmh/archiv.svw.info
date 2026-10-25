import { test, expect } from '@playwright/test';
import { watchPage, localRefs, brokenRefs, expectNavigation } from './site-helpers.js';

const PAGES = [
  {
    path: '/index.html',
    title: 'SVWARCHIV',
    active: 'Willkommen',
    heading: { role: 'heading', level: 5, name: 'Willkommen beim digitalen Archiv des Schachverbandes Württemberg' },
    rochadeNav: 'rochade/index.html',
  },
  {
    path: '/willkommen.html',
    title: 'Willkommen - SVWARCHIV',
    active: 'Willkommen',
    heading: { role: 'heading', level: 2, name: 'Willkommen beim digitalen Archiv des Schachverbandes Württemberg' },
    rochadeNav: 'wuerttembergrochade.html',
  },
  {
    path: '/archiv.html',
    title: 'Das Online-Archiv - SVWARCHIV',
    active: 'Archiv',
    heading: { role: 'heading', level: 2, name: 'Das Online-Archiv des SVW' },
    rochadeNav: 'wuerttembergrochade.html',
  },
  {
    path: '/mitmachen.html',
    title: 'Mitmachen - SVWARCHIV',
    active: 'Mitmachen',
    heading: { role: 'heading', level: 2, name: 'Mitmachen - Helfen Sie beim Archivaufbau!' },
    rochadeNav: 'wuerttembergrochade.html',
  },
  {
    path: '/archivsuche.html',
    title: 'Archiv-Suche - SVWARCHIV',
    active: 'ArchivSuche',
    heading: { role: 'heading', level: 2, name: 'Erweiterte Archiv-Suche' },
    rochadeNav: 'wuerttembergrochade.html',
  },
  {
    path: '/schachinwuerttemberg.html',
    title: 'Schach in Württemberg - SVWARCHIV',
    active: 'SchachInWuerttemberg',
    heading: { role: 'heading', level: 2, name: '"Schach in Württemberg" von Prof. Eberhard Herter' },
    rochadeNav: 'wuerttembergrochade.html',
  },
  {
    path: '/wuerttembergrochade.html',
    title: 'Württemberg-Rochade Archiv - SVWARCHIV',
    active: 'WuerttembergRochade',
    heading: { role: 'heading', level: 2, name: 'Württemberg-Rochade Archiv (1982-2000)' },
    rochadeNav: 'wuerttembergrochade.html',
  },
  {
    path: '/rochade.html',
    title: 'Rochade-Archiv - SVWARCHIV',
    active: 'WuerttembergRochade',
    heading: { role: 'heading', level: 2, name: 'Württemberg-Rochade - Archiv der Verbandszeitung' },
    rochadeNav: 'wuerttembergrochade.html',
  },
];

for (const p of PAGES) {
  test.describe(p.path, () => {
    test('has title, header, key heading and footer', async ({ page }) => {
      await watchPage(page);
      await page.goto(p.path);
      await expect(page).toHaveTitle(p.title);
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(page.locator('#title')).toContainText('Schachverband Württemberg e.V.');
      await expect(page.locator('#subtitle')).toHaveText('Digitales Archiv');
      await expect(page.getByRole(p.heading.role, { level: p.heading.level, name: p.heading.name, exact: true })).toBeVisible();
      await expect(page.locator('#footer')).toContainText('does not collect any information about its visitors');
    });

    test('shows the main navigation with the current module marked active', async ({ page }) => {
      await watchPage(page);
      await page.goto(p.path);
      await expectNavigation(page, p.active);
      await expect(page.locator('#WuerttembergRochade a')).toHaveAttribute('href', p.rochadeNav);
    });

    test('offers the login form with user name and password', async ({ page }) => {
      await watchPage(page);
      await page.goto(p.path);
      const form = page.locator('#login_form');
      await expect(form.getByPlaceholder('Benutzername')).toHaveAttribute('type', 'text');
      await expect(form.getByPlaceholder('Passwort')).toHaveAttribute('type', 'password');
      await expect(form.getByRole('button', { name: 'Login' })).toBeVisible();
    });

    test('all local links, images, stylesheets and scripts load', async ({ page, request }) => {
      await watchPage(page);
      await page.goto(p.path);
      const refs = await localRefs(page);
      expect(refs.length).toBeGreaterThan(0);
      expect(await brokenRefs(request, refs)).toEqual([]);
    });

    test('renders without console errors or failed requests', async ({ page }) => {
      const problems = await watchPage(page);
      await page.goto(p.path);
      await page.waitForLoadState('load');
      // the logo image and the stylesheet are really applied
      const logoWidth = await page.locator('#page-logo img').evaluate((img) => img.naturalWidth);
      expect(logoWidth).toBeGreaterThan(0);
      expect(await page.evaluate(() => typeof window.jQuery)).toBe('function');
      expect(problems).toEqual([]);
    });
  });
}

test('index.html links to the external Ulm chronicle without loading it', async ({ page }) => {
  const problems = await watchPage(page);
  await page.goto('/index.html');
  await expect(page.getByRole('link', { name: 'hier' }).first()).toHaveAttribute('href', 'schachinwuerttemberg.html');
  await expect(page.locator('a[href^="http://www.schachgeschichte-ulms"]')).toHaveCount(1);
  expect(problems).toEqual([]);
});

test('favicon and robots.txt are served', async ({ request }) => {
  expect((await request.get('/favicon.ico')).ok()).toBe(true);
  expect((await request.get('/robots.txt')).ok()).toBe(true);
});
