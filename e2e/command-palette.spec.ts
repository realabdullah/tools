import { expect, test } from '@playwright/test';
import { SAMPLE_JWT } from './fixtures';

test('the keyboard shortcut opens the palette and navigates', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');

  const search = page.getByRole('combobox');
  await expect(search).toBeFocused();

  await search.fill('base');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/base64$/);
  await expect(page.getByRole('textbox', { name: 'Base64' })).toBeVisible();
});

test('arrow keys move the selection', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/base64$/);
});

test('escape closes the palette and leaves the route alone', async ({ page }) => {
  await page.goto('/jwt');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('combobox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox')).toBeHidden();
  await expect(page).toHaveURL(/\/jwt$/);
});

test('pasting a token into the palette resolves it to the JWT workspace', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill(SAMPLE_JWT);

  await expect(page.getByRole('option', { name: /Inspect as a JWT/ })).toBeVisible();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/jwt$/);
  // The token travelled with the navigation and is already decoded.
  await expect(page.getByText('"Ada Løvelace"')).toBeVisible();
});

test('a query with no match says so', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill('sqlite');
  await expect(page.getByText(/Nothing matches/)).toBeVisible();
});
