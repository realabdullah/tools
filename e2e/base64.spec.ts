import { expect, test } from '@playwright/test';
import { SAMPLE_BASE64, SAMPLE_TEXT } from './fixtures';

test('typing text encodes it as you go', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('textbox', { name: 'Plain text' }).fill(SAMPLE_TEXT);
  await expect(page.getByRole('textbox', { name: 'Base64' })).toHaveValue(SAMPLE_BASE64);
});

test('pasting Base64 decodes it as you go', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('textbox', { name: 'Base64' }).fill(SAMPLE_BASE64);
  await expect(page.getByRole('textbox', { name: 'Plain text' })).toHaveValue(SAMPLE_TEXT);
});

test('there is no convert button to press', async ({ page }) => {
  await page.goto('/base64');
  await expect(page.getByRole('button', { name: /convert/i })).toHaveCount(0);
});

test('switching to the URL-safe alphabet re-encodes', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('textbox', { name: 'Plain text' }).fill('subjects?=/+~');
  await expect(page.getByRole('textbox', { name: 'Base64' })).toHaveValue('c3ViamVjdHM/PS8rfg==');

  await page.getByRole('radio', { name: 'url' }).click();
  await expect(page.getByRole('textbox', { name: 'Base64' })).toHaveValue('c3ViamVjdHM_PS8rfg');
});

test('Unicode survives a round trip', async ({ page }) => {
  await page.goto('/base64');
  const text = page.getByRole('textbox', { name: 'Plain text' });
  const base64 = page.getByRole('textbox', { name: 'Base64' });

  await text.fill('🚀 Ada Løvelace 東京');
  const encoded = await base64.inputValue();

  await text.fill('');
  await base64.fill(encoded);
  await expect(text).toHaveValue('🚀 Ada Løvelace 東京');
});

test('invalid Base64 is explained rather than swallowed', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('textbox', { name: 'Base64' }).fill('not valid base64!!');
  await expect(page.getByText(/Not Base64/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Plain text' })).toHaveValue('');
});

test('the result can be copied straight back out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/base64');
  await page.getByRole('textbox', { name: 'Plain text' }).fill(SAMPLE_TEXT);

  await page.getByRole('button', { name: 'Copy Base64' }).click();
  await expect(page.getByRole('button', { name: 'Copy Base64' })).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SAMPLE_BASE64);
});

test('large input stays responsive', async ({ page }) => {
  await page.goto('/base64');
  const text = 'ü'.repeat(50_000);
  await page.getByRole('textbox', { name: 'Plain text' }).fill(text);
  await expect(page.getByRole('textbox', { name: 'Base64' })).not.toHaveValue('');
});
