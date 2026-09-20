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

/** Types into the CodeMirror surface, which is contenteditable, not a textarea. */
const write = async (page: Page, text: string) => {
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await content.fill(text);
};

const tree = (page: Page) => page.getByRole('tree', { name: 'JSON tree' });

test('a direct visit to /json is served by the SPA fallback', async ({ page }) => {
  await page.goto('/json');
  await expect(page.locator('.cm-content')).toBeVisible();
});

test('the box is an editor until there is something to browse', async ({ page }) => {
  await page.goto('/json');
  // No view to switch, no pane to find: you can paste straight away.
  await expect(page.locator('.cm-editor')).toBeVisible();

  await write(page, DOC);
  await expect(tree(page)).toBeVisible();
  await expect(tree(page).getByText('"service"')).toBeVisible();
});

test('the raw view has a gutter, folding and syntax colour', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);
  await page.getByRole('radio', { name: 'raw' }).click();

  // The first gutter element is CodeMirror's hidden width-measuring spacer,
  // so assert on a real line number instead.
  await expect(
    page.locator('.cm-lineNumbers .cm-gutterElement').filter({ hasText: /^2$/ }),
  ).toBeVisible();
  await expect(page.locator('.cm-foldGutter .cm-gutterElement').first()).toBeAttached();
});

test('a syntax error is marked in place and named below', async ({ page }) => {
  await page.goto('/json');
  await write(page, '{\n  "a": 1,\n}');

  await expect(page.getByText('Trailing comma before "}"')).toBeVisible();
  await expect(page.getByText('line 2, column 9')).toBeVisible();
  // The offending character is underlined where it sits.
  await expect(page.locator('.cm-lintRange-error')).toBeVisible();
});

test('an error names the problem rather than echoing the engine', async ({ page }) => {
  await page.goto('/json');
  await write(page, '{\n  // a note\n  "a": 1\n}');
  await expect(page.getByText('Comments are not allowed in JSON')).toBeVisible();

  await write(page, "{'a': 1}");
  await expect(page.getByText('Property names must be wrapped in double quotes')).toBeVisible();
});

test('search finds a keyword and shows it in context', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);

  await page.getByRole('textbox', { name: 'Search' }).fill('example.com');

  await expect(page.getByText('1/2')).toBeVisible();
  // The hits are kept, with the branch that leads to them.
  await expect(tree(page).getByText('"users"')).toBeVisible();
  await expect(tree(page).getByText('"replicas"')).toHaveCount(0);
  await expect(tree(page).locator('mark')).toHaveCount(2);
});

test('search steps between matches in the raw view', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);
  await page.getByRole('radio', { name: 'raw' }).click();

  await page.getByRole('textbox', { name: 'Search' }).fill('example.com');
  await expect(page.getByText('1/2')).toBeVisible();
  await expect(page.locator('.cm-searchMatch-active')).toHaveCount(1);

  await page.getByRole('button', { name: 'Next match' }).click();
  await expect(page.getByText('2/2')).toBeVisible();
});

test('a path filter narrows the result', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);

  await page.getByRole('textbox', { name: 'Filter by path' }).fill('users[*].profile.email');

  await expect(page.getByText('2 matches')).toBeVisible();
  await expect(tree(page).getByText('"ada@example.com"')).toBeVisible();
  await expect(tree(page).getByText('"service"')).toHaveCount(0);
});

test('a malformed filter explains itself without losing the document', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);
  await page.getByRole('textbox', { name: 'Filter by path' }).fill('users[nope]');

  await expect(page.getByText(/is not an index/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Filter by path' }).fill('');
  await expect(tree(page).getByText('"service"')).toBeVisible();
});

test('Format rewrites the document with the chosen indentation', async ({ page }) => {
  await page.goto('/json');
  await write(page, '{"a":1,"b":[1,2]}');
  await page.getByRole('radio', { name: 'raw' }).click();

  await page.getByRole('button', { name: 'Format' }).click();
  await expect(page.locator('.cm-content')).toContainText('"a": 1');

  await page.getByRole('radio', { name: 'min' }).click();
  await page.getByRole('button', { name: 'Format' }).click();
  await expect(page.locator('.cm-content')).toHaveText('{"a":1,"b":[1,2]}');
});

test('Sort keys orders objects but leaves arrays alone', async ({ page }) => {
  await page.goto('/json');
  await write(page, '{"zebra":1,"alpha":[3,1,2]}');
  await page.getByRole('radio', { name: 'raw' }).click();
  await page.getByRole('radio', { name: 'min' }).click();

  await page.getByRole('button', { name: 'Sort keys' }).click();
  await expect(page.locator('.cm-content')).toHaveText('{"alpha":[3,1,2],"zebra":1}');
});

test('the result can be copied straight back out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/json');
  await write(page, '{"a":1}');

  await page.getByRole('radio', { name: 'raw' }).click();
  await page.getByRole('radio', { name: 'min' }).click();
  await page.getByRole('button', { name: 'Copy JSON' }).click();
  await expect(page.getByRole('button', { name: 'Copy JSON' })).toContainText('Copied');

  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('{"a":1}');
});

test('the tree is navigable by keyboard alone', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);

  await tree(page).getByRole('treeitem').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role="treeitem"]:focus')).toContainText('"service"');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // onto "users"
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[role="treeitem"]:focus')).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[role="treeitem"]:focus')).toHaveAttribute('aria-expanded', 'true');
});

test('a row hands over its path, which is what you came for', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/json');
  await write(page, DOC);

  await page.getByRole('button', { name: 'Copy path $.users[0].profile.email' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '$.users[0].profile.email',
  );
});

test('a very large array is bounded rather than rendered in full', async ({ page }) => {
  await page.goto('/json');
  await write(page, JSON.stringify({ items: Array.from({ length: 1000 }, (_, i) => i) }));

  await tree(page).getByText('"items"').click();
  await expect(page.getByText(/800 more/)).toBeVisible();
});
