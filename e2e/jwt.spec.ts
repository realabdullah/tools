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

test('an unchecked signature is called unchecked, not verified', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill(SAMPLE_JWT);
  await expect(page.getByText('signature unchecked')).toBeVisible();
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

const CANONICAL =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.' +
  'KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30';
const CANONICAL_SECRET = 'a-string-secret-at-least-256-bits-long';

test('a signature is verified against a secret, in the browser', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill(CANONICAL);

  await expect(page.getByText('signature unchecked')).toBeVisible();

  await page.getByRole('textbox', { name: 'Verification key' }).fill(CANONICAL_SECRET);
  await expect(page.getByRole('status').filter({ hasText: 'Signature verified' })).toBeVisible();
});

test('the wrong secret is reported as a mismatch, not a pass', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill(CANONICAL);
  await page.getByRole('textbox', { name: 'Verification key' }).fill('wrong-secret');

  await expect(
    page.getByRole('status').filter({ hasText: 'Signature does not match this key' }),
  ).toBeVisible();
});

test('a tampered payload fails verification', async ({ page }) => {
  await page.goto('/jwt');
  const [header, , signature] = CANONICAL.split('.');
  await page
    .getByRole('textbox', { name: 'JWT' })
    .fill(`${header}.eyJzdWIiOiJhZG1pbiJ9.${signature}`);
  await page.getByRole('textbox', { name: 'Verification key' }).fill(CANONICAL_SECRET);

  await expect(
    page.getByRole('status').filter({ hasText: 'Signature does not match this key' }),
  ).toBeVisible();
});

test('a key of the wrong kind is explained', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('textbox', { name: 'JWT' }).fill(CANONICAL);
  await page
    .getByRole('textbox', { name: 'Verification key' })
    .fill('-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----');

  await expect(
    page.getByRole('status').filter({ hasText: /shared secret, not a key file/ }),
  ).toBeVisible();
});

test('the builder signs a token that the inspector then verifies', async ({ page }) => {
  await page.goto('/jwt/build');

  const token = page.getByRole('textbox', { name: 'Signed token' });
  await expect(token).toHaveValue(CANONICAL);

  // Hand it to the inspector, which checks it with the same secret.
  await page.getByRole('link', { name: 'Inspect this token' }).click();
  await expect(page).toHaveURL(/\/jwt$/);
  await page.getByRole('textbox', { name: 'Verification key' }).fill(CANONICAL_SECRET);
  await expect(page.getByRole('status').filter({ hasText: 'Signature verified' })).toBeVisible();
});

test('the builder generates a key pair for an asymmetric algorithm', async ({ page }) => {
  await page.goto('/jwt/build');
  await page.getByLabel('Signing algorithm').selectOption('ES256');
  await expect(page.getByRole('heading', { name: 'Private key' })).toBeVisible();

  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByRole('textbox', { name: 'Signing key' })).toHaveValue(/"crv": "P-256"/);

  const token = await page.getByRole('textbox', { name: 'Signed token' }).inputValue();
  expect(token.split('.')).toHaveLength(3);
});
