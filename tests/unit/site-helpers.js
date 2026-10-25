import { expect } from '@playwright/test';

// Blocks every request that leaves 127.0.0.1 and records console errors,
// page errors and failed local requests (network errors and HTTP >= 400).
export async function watchPage(page) {
  const problems = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      return route.abort();
    }
    return route.continue();
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const url = new URL(req.url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      problems.push(`requestfailed: ${req.url()}`);
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return problems;
}

// Absolute URLs of all local links, images, stylesheets and scripts of the page.
// Links to other hosts, mailto: and tel: are left out.
export async function localRefs(page, { exclude = () => false } = {}) {
  const urls = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a[href]').forEach((a) => out.push(a.href));
    document.querySelectorAll('link[href]').forEach((l) => out.push(l.href));
    document.querySelectorAll('img[src]').forEach((i) => out.push(i.src));
    document.querySelectorAll('script[src]').forEach((s) => out.push(s.src));
    return out;
  });
  const origin = new URL(page.url()).origin;
  const seen = new Set();
  for (const raw of urls) {
    if (/^(mailto|tel|javascript):/i.test(raw)) continue;
    const url = new URL(raw);
    if (url.origin !== origin) continue;
    url.hash = '';
    const key = url.toString();
    if (key === new URL(page.url()).toString().split('#')[0] && raw.includes('#')) continue;
    if (exclude(url)) continue;
    seen.add(key);
  }
  return [...seen];
}

// Requests every URL and returns those that do not answer with a 2xx status.
export async function brokenRefs(request, urls) {
  const broken = [];
  for (const url of urls) {
    const res = await request.get(url);
    if (!res.ok()) broken.push(`${res.status()} ${url}`);
  }
  return broken;
}

export const NAV_ITEMS = [
  'Willkommen',
  'Das Online-Archiv',
  'Mitmachen',
  'Suche',
  'Schach In Württemberg',
  'WürttembergRochade',
];

export async function expectNavigation(page, activeId) {
  const nav = page.locator('#navigation ul.nav > li');
  await expect(nav).toHaveCount(NAV_ITEMS.length);
  for (let i = 0; i < NAV_ITEMS.length; i++) {
    await expect(nav.nth(i).locator('a')).toHaveText(NAV_ITEMS[i]);
  }
  await expect(page.locator('#navigation li.active')).toHaveCount(1);
  await expect(page.locator('#navigation li.active')).toHaveAttribute('id', activeId);
}
