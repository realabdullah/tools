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

/**
 * Types into the CodeMirror surface, which is contenteditable, not a textarea.
 * The editor is only on screen when there is nothing to browse, so switch to
 * the raw view first whenever a document is already loaded.
 */
const write = async (page: Page, text: string) => {
  // Wait for the workspace itself first: `count()` does not auto-wait, so on a
  // lazily loaded route it would otherwise report "no editor" before mount.
  await page.getByRole('radio', { name: 'tree' }).waitFor();

  const content = page.locator('.cm-content');
  if (!(await content.isVisible())) {
    await page.getByRole('radio', { name: 'raw' }).click();
  }
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

test('indentation applies immediately, and minifying is reversible', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);
  await page.getByRole('radio', { name: 'raw' }).click();

  const lines = page.locator('.cm-line');
  const formatted = await lines.count();
  expect(formatted).toBeGreaterThan(1);

  // Choosing an indent is the whole action: there is no second button.
  await page.getByRole('radio', { name: 'min' }).click();
  await expect(lines).toHaveCount(1);

  // And it goes back, which is what "no way to make it formatted" meant.
  await page.getByRole('radio', { name: '2' }).click();
  await expect(lines).toHaveCount(formatted);
});

test('the indent control is disabled while the document cannot be parsed', async ({ page }) => {
  await page.goto('/json');
  await write(page, '{"a": 1,}');
  await page.getByRole('radio', { name: 'raw' }).click();
  await expect(page.getByRole('radio', { name: 'min' })).toBeDisabled();
});

test('search controls are real buttons, not slivers', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);
  await page.getByRole('textbox', { name: 'Search' }).fill('example.com');

  for (const name of ['Next match', 'Previous match']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(20);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(20);

    const icon = await page.getByRole('button', { name }).locator('svg').boundingBox();
    expect(icon?.width ?? 0).toBeGreaterThanOrEqual(12);
  }
});

test('a long line wraps instead of sliding under the line numbers', async ({ page }) => {
  await page.goto('/json');
  await write(page, DOC);
  await page.getByRole('radio', { name: 'raw' }).click();
  await page.getByRole('radio', { name: 'min' }).click();

  // The gutter is opaque, so scrolled content cannot show through it.
  const gutterBackground = await page
    .locator('.cm-gutters')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(gutterBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(gutterBackground).not.toBe('transparent');

  // And the content wraps, so there is nothing to scroll sideways.
  const scroller = page.locator('.cm-scroller');
  const overflow = await scroller.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
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

const BROKEN = `{
  // service config
  name: 'billing',
  replicas: 2,
  hosts: ['a.example.com', 'b.example.com',],
  limits: {rps: 100, burst: None},
}`;

const RECORDS = JSON.stringify([
  { id: 3, name: 'Grace Hopper', role: 'admin', score: 91.5 },
  { id: 1, name: 'Ada Løvelace', role: 'dev', score: 99.2, tags: ['x'] },
  { id: 2, name: 'Alan Turing', role: 'dev', score: 97 },
]);

test('a document broken several ways is repaired in one click', async ({ page }) => {
  await page.goto('/json');
  await write(page, BROKEN);

  await expect(page.getByText('Comments are not allowed in JSON')).toBeVisible();
  await page.getByRole('button', { name: 'Repair' }).click();

  const tree = page.getByRole('tree', { name: 'JSON tree' });
  await expect(tree.getByText('"billing"')).toBeVisible();
  await expect(tree.getByText('null')).toBeVisible();
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
});

test('repair is not offered for a document that already parses', async ({ page }) => {
  await page.goto('/json');
  await write(page, '{"a": 1}');
  await expect(page.getByRole('button', { name: 'Repair' })).toHaveCount(0);
});

test('an array of objects can be read as a table', async ({ page }) => {
  await page.goto('/json');
  await write(page, RECORDS);

  await page.getByRole('radio', { name: 'table' }).click();

  await expect(page.getByRole('columnheader', { name: 'name' })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(4); // header plus three records
  // A key only one record has still gets a column, and the others show empty.
  await expect(page.getByRole('columnheader', { name: 'tags' })).toBeVisible();
});

test('the table option appears only for data shaped like a table', async ({ page }) => {
  await page.goto('/json');
  await write(page, '{"a": 1}');
  await expect(page.getByRole('radio', { name: 'table' })).toHaveCount(0);

  await write(page, RECORDS);
  await expect(page.getByRole('radio', { name: 'table' })).toBeVisible();
});

test('a column sorts ascending, descending, then back to document order', async ({ page }) => {
  await page.goto('/json');
  await write(page, RECORDS);
  await page.getByRole('radio', { name: 'table' }).click();

  // The first cell of each row is the index header, so the id is the first td.
  const ids = () => page.locator('tbody tr td:nth-of-type(1)');
  await expect(ids()).toHaveText(['3', '1', '2']);

  const header = page.getByRole('button', { name: 'id' });
  await header.click();
  await expect(ids()).toHaveText(['1', '2', '3']);

  await header.click();
  await expect(ids()).toHaveText(['3', '2', '1']);

  await header.click();
  await expect(ids()).toHaveText(['3', '1', '2']);
});
