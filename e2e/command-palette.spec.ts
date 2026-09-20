import { expect, test } from '@playwright/test';
import { SAMPLE_JWT } from './fixtures';

test('the keyboard shortcut opens the palette and navigates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Base64/ })).toBeVisible();
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
  await expect(page.getByRole('link', { name: /Base64/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');

  const options = page.getByRole('option');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(options.first()).toHaveAttribute('aria-selected', 'false');

  // Wraps around rather than stopping at the end.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(options.last()).toHaveAttribute('aria-selected', 'true');
});

test('a tool’s views are reachable from the palette', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Base64/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');

  await page.getByRole('combobox').fill('diff');
  await page.getByRole('option', { name: /JSON · Compare/ }).click();
  await expect(page).toHaveURL(/\/json\/compare$/);
});

test('escape closes the palette and leaves the route alone', async ({ page }) => {
  await page.goto('/jwt');
  // The shortcut is a document listener, so wait until the app is mounted.
  await expect(page.getByRole('textbox', { name: 'JWT' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('combobox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox')).toBeHidden();
  await expect(page).toHaveURL(/\/jwt$/);
});

test('pasting a token into the palette resolves it to the JWT workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Base64/ })).toBeVisible();
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
  await expect(page.getByRole('link', { name: /Base64/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill('sqlite');
  await expect(page.getByText(/Nothing matches/)).toBeVisible();
});
