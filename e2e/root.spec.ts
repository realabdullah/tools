import { expect, test } from '@playwright/test';
import { SAMPLE_BASE64, SAMPLE_JWT, SAMPLE_TEXT } from './fixtures';

test('pasting a token at the root resolves to the JWT workspace', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox');
  await input.fill(SAMPLE_JWT);

  await expect(page.getByRole('button', { name: /Inspect as a JWT/ })).toBeVisible();
  await input.press('Enter');

  await expect(page).toHaveURL(/\/jwt$/);
  await expect(page.getByText('"Ada Løvelace"')).toBeVisible();
});

test('pasting Base64 at the root offers to decode it', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox');
  await input.fill(SAMPLE_BASE64);

  await page.getByRole('button', { name: /Decode from Base64/ }).click();

  await expect(page).toHaveURL(/\/base64$/);
  // The handed-over value is Base64, so the workspace opens in decode.
  await expect(page.getByRole('radio', { name: 'decode' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('textbox', { name: 'Text output' })).toHaveValue(SAMPLE_TEXT);
});

test('ordinary text offers to encode it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox').fill('just some words');
  await expect(page.getByRole('button', { name: /Encode to Base64/ })).toBeVisible();
});

test('pasted content never reaches the URL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox').fill(SAMPLE_JWT);
  await page.getByRole('button', { name: /Inspect as a JWT/ }).click();

  await expect(page).toHaveURL(/\/jwt$/);
  expect(page.url()).not.toContain('eyJ');
});
