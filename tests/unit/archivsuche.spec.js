import { test, expect } from '@playwright/test';
import { watchPage } from './site-helpers.js';

test.describe('archivsuche.html search form', () => {
  test.beforeEach(async ({ page }) => {
    await watchPage(page);
    await page.goto('/archivsuche.html');
  });

  test('has labelled inputs for all search criteria', async ({ page }) => {
    await expect(page.getByLabel('Volltext-Suche:')).toHaveAttribute('placeholder', /Suchbegriff eingeben/);
    await expect(page.getByLabel('Zeitraum von:')).toHaveAttribute('type', 'date');
    await expect(page.getByLabel('bis:')).toHaveAttribute('type', 'date');
    await expect(page.getByLabel('Verein/Organisation:')).toHaveAttribute('name', 'verein');
    await expect(page.getByLabel('Person:')).toHaveAttribute('name', 'person');
    await expect(page.getByLabel('Ort:')).toHaveAttribute('name', 'ort');
    await expect(page.getByRole('button', { name: 'Suche starten' })).toHaveAttribute('type', 'submit');
    await expect(page.getByRole('button', { name: 'Felder löschen' })).toHaveAttribute('type', 'reset');
  });

  test('offers all document categories plus an empty "all" option', async ({ page, request }) => {
    // selectize moves the <option>s out of the native select, so read them from the served HTML
    const html = await (await request.get('/archivsuche.html')).text();
    const values = await page.evaluate((src) => {
      const doc = new DOMParser().parseFromString(src, 'text/html');
      return Array.from(doc.querySelectorAll('select#kategorie option')).map((o) => [o.value, o.textContent.trim()]);
    }, html);
    expect(values).toEqual([
      ['', 'Alle Kategorien'],
      ['rochade', 'Württemberg-Rochade'],
      ['protokolle', 'Protokolle'],
      ['satzungen', 'Satzungen & Ordnungen'],
      ['turniere', 'Turnierdokumentation'],
      ['fotos', 'Fotografien'],
      ['chroniken', 'Vereinschroniken'],
      ['ehrungen', 'Ehrungen & Auszeichnungen'],
      ['literatur', 'Schach-Literatur'],
    ]);
    expect(await page.locator('select#kategorie').evaluate((s) => s.multiple)).toBe(true);
  });

  test('turns the category select into a selectize multi-select', async ({ page }) => {
    await expect(page.locator('.selectize-control.multi')).toHaveCount(1);
    await expect(page.locator('select#kategorie')).toHaveClass(/selectized/);
  });

  test('selecting categories in the selectize widget updates the form value', async ({ page }) => {
    const input = page.locator('.selectize-control .selectize-input input');
    const dropdown = page.locator('.selectize-dropdown');
    await input.click();
    // openOnFocus: false - the list only opens once the user types
    await expect(dropdown).toBeHidden();
    await input.pressSequentially('Protok');
    await dropdown.locator('.option', { hasText: 'Protokolle' }).click();
    await input.pressSequentially('Foto');
    await dropdown.locator('.option', { hasText: 'Fotografien' }).click();
    await expect(page.locator('.selectize-input .item')).toHaveText(['Protokolle', 'Fotografien']);
    const selected = await page.locator('select#kategorie').evaluate((s) =>
      Array.from(s.selectedOptions).map((o) => o.value),
    );
    expect(selected.sort()).toEqual(['fotos', 'protokolle']);
    // hideSelected: chosen items are no longer offered
    await input.pressSequentially('Proto');
    await expect(dropdown.locator('.option[data-value="protokolle"]')).toHaveCount(0);
  });

  test('"Felder löschen" clears all text and date fields', async ({ page }) => {
    await page.getByLabel('Volltext-Suche:').fill('Landesmeisterschaft');
    await page.getByLabel('Zeitraum von:').fill('1982-06-01');
    await page.getByLabel('bis:').fill('2000-06-30');
    await page.getByLabel('Verein/Organisation:').fill('SK Stuttgart');
    await page.getByLabel('Person:').fill('Herter');
    await page.getByLabel('Ort:').fill('Ulm');
    await page.getByRole('button', { name: 'Felder löschen' }).click();
    for (const label of ['Volltext-Suche:', 'Zeitraum von:', 'bis:', 'Verein/Organisation:', 'Person:', 'Ort:']) {
      await expect(page.getByLabel(label)).toHaveValue('');
    }
  });

  test('date fields reject malformed dates', async ({ page }) => {
    const von = page.getByLabel('Zeitraum von:');
    await von.evaluate((el) => { el.value = '31.12.1999'; });
    await expect(von).toHaveValue('');
    await von.fill('1999-12-31');
    await expect(von).toHaveValue('1999-12-31');
  });

  test('submitting sends the criteria as GET parameters to the same page', async ({ page }) => {
    await page.getByLabel('Volltext-Suche:').fill('Meister*');
    await page.getByLabel('Ort:').fill('Göppingen');
    await page.getByLabel('Zeitraum von:').fill('1990-01-01');
    await page.getByRole('button', { name: 'Suche starten' }).click();
    await page.waitForURL(/volltext=/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/archivsuche.html');
    expect(url.searchParams.get('volltext')).toBe('Meister*');
    expect(url.searchParams.get('ort')).toBe('Göppingen');
    expect(url.searchParams.get('von_datum')).toBe('1990-01-01');
    expect(url.searchParams.get('bis_datum')).toBe('');
    await expect(page.getByRole('heading', { name: 'Erweiterte Archiv-Suche' })).toBeVisible();
  });

  test('lists search tips and direct links to the collections', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 6, name: 'Effektive Suchstrategien' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 6, name: 'Häufige Suchbegriffe' })).toBeVisible();
    const direct = page.locator('.news', { has: page.getByRole('heading', { name: 'Direktzugriff auf Sammlungen' }) });
    await expect(direct.getByRole('link')).toHaveText(['Württemberg-Rochade', 'Schach in Württemberg', 'Dokumentenarchiv']);
  });
});
