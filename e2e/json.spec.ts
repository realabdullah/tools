import { expect, test, type Page } from '@playwright/test';

const DOC = JSON.stringify(
  {
    service: 'billing',
    replicas: 2,
    users: [
      { name: 'Ada Løvelace', profile: { email: 'ada@example.com' } },
      { name: 'Grace Hopper', profile: { email: 'grace@example.com' } },
    ],
  },
  null,
  2,
);

const source = (page: Page) => page.getByRole('textbox', { name: 'JSON source' });

test('a direct visit to /json is served by the SPA fallback', async ({ page }) => {
  await page.goto('/json');
  await expect(source(page)).toBeVisible();
});

test('pasting a document renders it as a tree with no action to take', async ({ page }) => {
  await page.goto('/json');
  await source(page).fill(DOC);

  const tree = page.getByRole('tree', { name: 'JSON tree' });
  await expect(tree.getByText('"service"')).toBeVisible();
  await expect(tree.getByText('"Ada Løvelace"')).toBeVisible();
  // Nested containers are summarised rather than dumped.
  await expect(tree.getByText('[ 2 items ]')).toBeVisible();
});

test('a syntax error is named and located, and can be jumped to', async ({ page }) => {
  await page.goto('/json');
  await source(page).fill('{\n  "a": 1,\n}');

  await expect(page.getByText('Trailing comma before "}"')).toBeVisible();

  const jump = page.getByRole('button', { name: /line 2, column 9/ });
  await expect(jump).toBeVisible();
  await jump.click();

  // The caret lands on the offending character, not merely near it.
  const selected = await source(page).evaluate((element) => {
    const area = element as HTMLTextAreaElement;
    return area.value.slice(area.selectionStart, area.selectionEnd);
  });
  expect(selected).toBe(',');
});

test('an error names the problem rather than echoing the engine', async ({ page }) => {
  await page.goto('/json');
  await source(page).fill('{\n  // a note\n  "a": 1\n}');
  await expect(page.getByText('Comments are not allowed in JSON')).toBeVisible();

  await source(page).fill("{'a': 1}");
  await expect(page.getByText('Property names must be wrapped in double quotes')).toBeVisible();
});

test('a path filter narrows the result', async ({ page }) => {
  await page.goto('/json');
  await source(page).fill(DOC);

  await page.getByRole('textbox', { name: 'Filter by path' }).fill('users[*].profile.email');

  await expect(page.getByText('2 matches')).toBeVisible();
  const tree = page.getByRole('tree', { name: 'JSON tree' });
  await expect(tree.getByText('"ada@example.com"')).toBeVisible();
  await expect(tree.getByText('"service"')).toHaveCount(0);
});

test('a malformed filter explains itself without losing the document', async ({ page }) => {
  await page.goto('/json');
  await source(page).fill(DOC);
  await page.getByRole('textbox', { name: 'Filter by path' }).fill('users[nope]');

  await expect(page.getByText(/is not an index/)).toBeVisible();
  await expect(source(page)).toHaveValue(DOC);
});

test('the raw view formats, and "min" is simply the tightest indent', async ({ page }) => {
  await page.goto('/json');
  await source(page).fill('{"a":1,"b":[1,2]}');

  await page.getByRole('radio', { name: 'raw' }).click();
  await expect(page.locator('pre')).toContainText('"a": 1');

  await page.getByRole('radio', { name: 'min' }).click();
  await expect(page.locator('pre')).toHaveText('{"a":1,"b":[1,2]}');
});

test('the result can be copied straight back out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/json');
  await source(page).fill('{"a":1}');

  // The indent control lives with the raw view, where its effect is visible.
  await page.getByRole('radio', { name: 'raw' }).click();
  await page.getByRole('radio', { name: 'min' }).click();
  await page.getByRole('button', { name: 'Copy result' }).click();
  await expect(page.getByRole('button', { name: 'Copy result' })).toContainText('Copied');

  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('{"a":1}');
});

test('the tree is navigable by keyboard alone', async ({ page }) => {
  await page.goto('/json');
  await source(page).fill(DOC);

  const tree = page.getByRole('tree', { name: 'JSON tree' });
  await tree.getByRole('treeitem').first().focus();

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role="treeitem"]:focus')).toContainText('"service"');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // onto "users"
  await page.keyboard.press('ArrowLeft'); // collapse it
  await expect(page.locator('[role="treeitem"]:focus')).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('ArrowRight'); // and open it again
  await expect(page.locator('[role="treeitem"]:focus')).toHaveAttribute('aria-expanded', 'true');
});

test('a row hands over its path, which is what you came for', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/json');
  await source(page).fill(DOC);

  await page.getByRole('button', { name: 'Copy path $.users[0].profile.email' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '$.users[0].profile.email',
  );
});

test('a very large array is bounded rather than rendered in full', async ({ page }) => {
  await page.goto('/json');
  await source(page).fill(JSON.stringify({ items: Array.from({ length: 1000 }, (_, i) => i) }));

  // The expansion budget leaves it closed; opening it shows a capped window.
  await page.getByRole('tree').getByText('"items"').click();
  await expect(page.getByText(/800 more/)).toBeVisible();
});
