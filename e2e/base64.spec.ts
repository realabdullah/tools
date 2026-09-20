import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_BASE64, SAMPLE_TEXT } from './fixtures';

const input = (page: Page) => page.getByRole('textbox', { name: /to (encode|decode)$/ });
const output = (page: Page) => page.getByRole('textbox', { name: /output$/ });

test('typing text encodes it as you go', async ({ page }) => {
  await page.goto('/base64');
  await input(page).fill(SAMPLE_TEXT);
  await expect(output(page)).toHaveValue(SAMPLE_BASE64);
});

test('the input is always on the left and the output on the right', async ({ page }) => {
  await page.goto('/base64');
  await expect(page.getByRole('textbox', { name: 'Text to encode' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Base64 output' })).toBeVisible();

  await page.getByRole('radio', { name: 'decode' }).click();
  await expect(page.getByRole('textbox', { name: 'Base64 to decode' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Text output' })).toBeVisible();
});

test('the output is not editable — it is a result', async ({ page }) => {
  await page.goto('/base64');
  await input(page).fill('hello');
  await expect(output(page)).toHaveAttribute('readonly', '');
});

test('choosing decode turns Base64 back into text', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('radio', { name: 'decode' }).click();
  await input(page).fill(SAMPLE_BASE64);
  await expect(output(page)).toHaveValue(SAMPLE_TEXT);
});

test('swapping round-trips: the result becomes the input', async ({ page }) => {
  await page.goto('/base64');
  await input(page).fill(SAMPLE_TEXT);

  await page.getByRole('button', { name: 'Swap to decode' }).click();

  await expect(page.getByRole('radio', { name: 'decode' })).toHaveAttribute('aria-checked', 'true');
  await expect(input(page)).toHaveValue(SAMPLE_BASE64);
  await expect(output(page)).toHaveValue(SAMPLE_TEXT);
});

test('there is no convert button to press', async ({ page }) => {
  await page.goto('/base64');
  await expect(page.getByRole('button', { name: /convert/i })).toHaveCount(0);
});

test('the URL-safe alphabet is offered only when Base64 is being written', async ({ page }) => {
  await page.goto('/base64');
  await input(page).fill('subjects?=/+~');
  await expect(output(page)).toHaveValue('c3ViamVjdHM/PS8rfg==');

  await page.getByRole('radio', { name: 'url' }).click();
  await expect(output(page)).toHaveValue('c3ViamVjdHM_PS8rfg');

  // Decoding accepts either alphabet without being told, so the control goes.
  await page.getByRole('radio', { name: 'decode' }).click();
  await expect(page.getByRole('radio', { name: 'url' })).toHaveCount(0);
});

test('Unicode survives a round trip', async ({ page }) => {
  await page.goto('/base64');
  await input(page).fill('🚀 Ada Løvelace 東京');
  await page.getByRole('button', { name: 'Swap to decode' }).click();
  await expect(output(page)).toHaveValue('🚀 Ada Løvelace 東京');
});

test('invalid Base64 is explained rather than swallowed', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('radio', { name: 'decode' }).click();
  await input(page).fill('not valid base64!!');

  await expect(page.getByText(/Not Base64/)).toBeVisible();
  await expect(output(page)).toHaveValue('');
});

test('the result can be copied straight back out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/base64');
  await input(page).fill(SAMPLE_TEXT);

  await page.getByRole('button', { name: 'Copy base64' }).click();
  await expect(page.getByRole('button', { name: 'Copy base64' })).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SAMPLE_BASE64);
});

test('large input stays responsive', async ({ page }) => {
  await page.goto('/base64');
  await input(page).fill('ü'.repeat(50_000));
  await expect(output(page)).not.toHaveValue('');
});
