import { expect, test } from '@playwright/test';
import { SAMPLE_JWT } from './fixtures';

test('pasting a token decodes it with no action to take', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill(SAMPLE_JWT);

  await expect(page.getByText('"HS256"')).toBeVisible();
  await expect(page.getByText('"Ada Løvelace"')).toBeVisible();

  // Claims are annotated, not replaced: the raw value stays, with a reading.
  const expRow = page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'exp' }) });
  await expect(expRow).toContainText('4102444800');
  await expect(expRow).toContainText('Expires at');
});

test('the interface never implies the signature was checked', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill(SAMPLE_JWT);
  await expect(page.getByText('Decoded only — the signature is not verified')).toBeVisible();
});

test('a malformed token explains the problem', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill('this-is-not-a-token');
  await expect(page.getByText(/Not a JWT/)).toBeVisible();
});

test('a broken payload still shows the header it could read', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill('eyJhbGciOiJIUzI1NiJ9.****.sig');
  await expect(page.getByText('"HS256"')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /not valid Base64URL/ })).toBeVisible();
});

test('an unsigned token is called out', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill('eyJhbGciOiJub25lIn0.eyJhIjoxfQ.');
  await expect(page.getByText(/alg "none"/)).toBeVisible();
});

test('the payload can be copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill(SAMPLE_JWT);

  await page.getByRole('button', { name: 'Copy Payload' }).click();
  await expect(page.getByRole('button', { name: 'Copy Payload' })).toContainText('Copied');

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('"Ada Løvelace"');
});
