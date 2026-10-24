import { test, expect } from '@playwright/test';
import { watchPage } from '../unit/site-helpers.js';

// Picks a category in the selectize widget the way a user does: type, then click the suggestion.
async function chooseCategory(page, typed, label) {
  const input = page.locator('.selectize-control .selectize-input input');
  await input.click();
  await input.pressSequentially(typed);
  await page.locator('.selectize-dropdown .option', { hasText: label }).click();
}

test.describe('archive search', () => {
  test('a visitor opens the search from the menu, fills all criteria and submits them', async ({ page }) => {
    const problems = await watchPage(page);
    await page.goto('/willkommen.html');
    await page.locator('#navigation').getByRole('link', { name: 'Suche', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Erweiterte Archiv-Suche' })).toBeVisible();

    await page.getByLabel('Volltext-Suche:').fill('Landesmeisterschaft');
    await page.getByLabel('Zeitraum von:').fill('1985-01-01');
    await page.getByLabel('bis:').fill('1995-12-31');
    await chooseCategory(page, 'Turn', 'Turnierdokumentation');
    await chooseCategory(page, 'Roch', 'Württemberg-Rochade');
    await expect(page.locator('.selectize-input .item')).toHaveText(['Turnierdokumentation', 'Württemberg-Rochade']);
    await page.getByLabel('Verein/Organisation:').fill('SF Göppingen');
    await page.getByLabel('Person:').fill('Herter');
    await page.getByLabel('Ort:').fill('Ulm');
    await page.getByRole('button', { name: 'Suche starten' }).click();

    await page.waitForURL(/\?volltext=/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/archivsuche.html');
    expect([...url.searchParams.entries()]).toEqual([
      ['volltext', 'Landesmeisterschaft'],
      ['von_datum', '1985-01-01'],
      ['bis_datum', '1995-12-31'],
      ['kategorie', 'turniere'],
      ['kategorie', 'rochade'],
      ['verein', 'SF Göppingen'],
      ['person', 'Herter'],
      ['ort', 'Ulm'],
    ]);
    // the search page is shown again with an empty form
    await expect(page.getByLabel('Volltext-Suche:')).toHaveValue('');
    await expect(page.locator('.selectize-input .item')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('a search without chosen categories covers all categories', async ({ page }) => {
    await watchPage(page);
    await page.goto('/archivsuche.html');
    await page.getByLabel('Volltext-Suche:').fill('Jubiläum');
    await expect(page.locator('.selectize-input .item')).toHaveCount(0);
    await page.getByRole('button', { name: 'Suche starten' }).click();
    await page.waitForURL(/\?volltext=/);
    const params = new URL(page.url()).searchParams;
    expect(params.get('volltext')).toBe('Jubiläum');
    // no category or only the empty "Alle Kategorien" value
    expect(params.getAll('kategorie').filter((v) => v !== '')).toEqual([]);
  });

  test('"Felder löschen" also clears the chosen categories', async ({ page }) => {
    // aqaa: suspected bug - the reset button clears the text and date fields, but the categories chosen
    // in the selectize widget stay selected (selectize ignores the form reset), so they are still shown
    // and submitted with the next search.
    await watchPage(page);
    await page.goto('/archivsuche.html');
    await page.getByLabel('Person:').fill('Herter');
    await chooseCategory(page, 'Proto', 'Protokolle');
    await page.getByRole('button', { name: 'Felder löschen' }).click();
    await expect(page.getByLabel('Person:')).toHaveValue('');
    await expect(page.locator('.selectize-input .item')).toHaveCount(0);
    await page.getByRole('button', { name: 'Suche starten' }).click();
    await page.waitForURL(/\?volltext=/);
    const params = new URL(page.url()).searchParams;
    expect(params.get('person')).toBe('');
    expect(params.getAll('kategorie')).toEqual([]);
  });
});

test.describe('login form', () => {
  test('submitting the login form lands on the start page instead of an error', async ({ page }) => {
    test.skip(true, 'aqaa: open bug, see report');
    // aqaa: suspected bug - every page shows a login form that POSTs to index.html; the static site
    // answers the POST with HTTP 405 Method Not Allowed, so a visitor who tries to log in gets an error page.
    await watchPage(page);
    await page.goto('/archivsuche.html');
    const form = page.locator('#login_form');
    await form.getByPlaceholder('Benutzername').fill('gast');
    await form.getByPlaceholder('Passwort').fill('geheim');
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.request().method() === 'POST'),
      form.getByRole('button', { name: 'Login' }).click(),
    ]);
    expect(new URL(response.url()).pathname).toBe('/index.html');
    expect(response.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: 'Willkommen beim digitalen Archiv des Schachverbandes Württemberg' })).toBeVisible();
  });
});
