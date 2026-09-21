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

test('decoded JSON is laid out, with the raw bytes one click away', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('radio', { name: 'decode' }).click();
  // {"sub":"123","scopes":["read","write"]}
  await input(page).fill('eyJzdWIiOiIxMjMiLCJzY29wZXMiOlsicmVhZCIsIndyaXRlIl19');

  await expect(output(page)).toHaveValue(
    '{\n  "sub": "123",\n  "scopes": [\n    "read",\n    "write"\n  ]\n}',
  );

  await page.getByRole('radio', { name: 'raw' }).click();
  await expect(output(page)).toHaveValue('{"sub":"123","scopes":["read","write"]}');
});

test('the layout toggle stays out of the way for text that is not JSON', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('radio', { name: 'decode' }).click();
  await input(page).fill(SAMPLE_BASE64);

  await expect(output(page)).toHaveValue(SAMPLE_TEXT);
  await expect(page.getByRole('radio', { name: 'pretty' })).toHaveCount(0);
});

test('JSON can be laid out before it is encoded', async ({ page }) => {
  await page.goto('/base64');
  await input(page).fill('{"sub":"123","ok":true}');

  await page.getByRole('button', { name: 'Format the JSON being encoded' }).click();
  await expect(input(page)).toHaveValue('{\n  "sub": "123",\n  "ok": true\n}');

  // And it is offered only when there is JSON to lay out.
  await input(page).fill('just some plain text');
  await expect(page.getByRole('button', { name: 'Format the JSON being encoded' })).toHaveCount(0);
});

/** A 12x12 PNG, small enough to inline and real enough to decode. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAJ0lEQVR42mP8z8BQz0AEYBxVSF' +
  '+FjLgU/idCIeOowtGgGVU4HBQCAI5OIRUUmvUgAAAAAElFTkSuQmCC';

test('Base64 that decodes to bytes offers the file, not an error', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('radio', { name: 'decode' }).click();
  await input(page).fill(PNG_BASE64);

  await expect(page.getByRole('heading', { name: 'Bytes' })).toBeVisible();
  // The type and size are reported, across two elements.
  await expect(page.getByText(/png/)).toBeVisible();
  await expect(page.getByText('96 B')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

  // The image is decoded and shown, not merely described.
  const preview = page.getByRole('img', { name: 'Decoded image' });
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(12);
});

test('a data URI is understood as well as bare Base64', async ({ page }) => {
  await page.goto('/base64');
  await page.getByRole('radio', { name: 'decode' }).click();
  await input(page).fill('data:text/plain;base64,aGVsbG8gZnJvbSB0aGUgdGVybWluYWw=');

  await expect(output(page)).toHaveValue(SAMPLE_TEXT);
});

test('a file becomes a data URI, which can be wrapped for MIME', async ({ page }) => {
  await page.goto('/base64');

  await page.getByRole('button', { name: 'Choose a file' }).click();
  await page.setInputFiles('input[type="file"]', {
    name: 'swatch.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  });

  await expect(page.getByRole('heading', { name: 'File' })).toBeVisible();
  await expect(page.getByText('swatch.png')).toBeVisible();
  await expect(output(page)).toHaveValue(/^data:image\/png;base64,/);

  // The raw form drops the URI prefix.
  await page.getByRole('radio', { name: 'raw' }).click();
  await expect(output(page)).not.toHaveValue(/^data:/);

  // Wrapping is exactly a line break every 76 characters, losing nothing.
  const single = await output(page).inputValue();
  await page.getByRole('radio', { name: '76' }).click();
  const wrapped = await output(page).inputValue();

  expect(wrapped.split('\n').join('')).toBe(single);
  expect(Math.max(...wrapped.split('\n').map((line) => line.length))).toBeLessThanOrEqual(76);
});
