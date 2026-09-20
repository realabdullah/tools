import { expect, test } from '@playwright/test';

test('the root offers the tools that exist, with their URLs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /JWT/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Base64/ })).toBeVisible();
});

test('a direct visit to /jwt is served by the SPA fallback', async ({ page }) => {
  await page.goto('/jwt');
  await expect(page.getByRole('textbox', { name: 'JWT' })).toBeVisible();
});

test('a direct visit to /base64 is served by the SPA fallback', async ({ page }) => {
  await page.goto('/base64');
  await expect(page.getByRole('textbox', { name: 'Text to encode' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Base64 output' })).toBeVisible();
});

test('reloading a deep link keeps the user there', async ({ page }) => {
  await page.goto('/base64');
  await page.reload();
  await expect(page).toHaveURL(/\/base64$/);
  await expect(page.getByRole('textbox', { name: 'Base64 output' })).toBeVisible();
});

test('an unknown route explains itself instead of breaking', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByText('No tool lives here yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to start' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('browser history moves between workspaces', async ({ page }) => {
  await page.goto('/jwt');
  await page.goto('/base64');
  await page.goBack();
  await expect(page).toHaveURL(/\/jwt$/);
  await expect(page.getByRole('textbox', { name: 'JWT' })).toBeVisible();
});
