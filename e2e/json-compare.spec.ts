import { expect, test, type Page } from '@playwright/test';

const left = (page: Page) => page.getByRole('textbox', { name: 'Left document' });
const right = (page: Page) => page.getByRole('textbox', { name: 'Right document' });

test('a direct visit to /json/compare is served by the SPA fallback', async ({ page }) => {
  await page.goto('/json/compare');
  await expect(left(page)).toBeVisible();
  await expect(right(page)).toBeVisible();
});

test('the view tabs move between the two JSON views', async ({ page }) => {
  await page.goto('/json');
  await page.getByRole('link', { name: 'Compare' }).click();
  await expect(page).toHaveURL(/\/json\/compare$/);

  await page.getByRole('link', { name: 'Inspect' }).click();
  await expect(page).toHaveURL(/\/json$/);
});

test('differences are classified and shown without asking', async ({ page }) => {
  await page.goto('/json/compare');
  await left(page).fill(JSON.stringify({ keep: 1, drop: 2, edit: 3 }));
  await right(page).fill(JSON.stringify({ keep: 1, edit: 4, gain: 5 }));

  const tree = page.getByRole('tree', { name: 'Differences' });
  await expect(tree.getByText('"drop"')).toBeVisible();
  await expect(tree.getByText('"gain"')).toBeVisible();
  await expect(tree.getByText('"edit"')).toBeVisible();

  // Unchanged keys are hidden while the scope is "changes".
  await expect(tree.getByText('"keep"')).toHaveCount(0);
  await page.getByRole('radio', { name: 'all' }).click();
  await expect(tree.getByText('"keep"')).toBeVisible();
});

test('an element inserted into an array is one addition, not a cascade', async ({ page }) => {
  await page.goto('/json/compare');
  await left(page).fill(JSON.stringify({ hosts: ['a', 'b'] }));
  await right(page).fill(JSON.stringify({ hosts: ['a', 'new', 'b'] }));

  const tree = page.getByRole('tree', { name: 'Differences' });
  await expect(tree.getByText('"new"')).toBeVisible();
  await expect(tree.getByText('added')).toHaveCount(1);
  await expect(tree.getByText('changed')).toHaveCount(0);
});

test('an edited object inside an array reads as a change, not a swap', async ({ page }) => {
  await page.goto('/json/compare');
  await left(page).fill(JSON.stringify([{ id: 1, name: 'Ada' }]));
  await right(page).fill(JSON.stringify([{ id: 1, name: 'Ada Lovelace' }]));

  const tree = page.getByRole('tree', { name: 'Differences' });
  await expect(tree.getByText('"Ada Lovelace"')).toBeVisible();
  await expect(tree.getByText('changed')).toHaveCount(1);
  await expect(tree.getByText('added')).toHaveCount(0);
  await expect(tree.getByText('removed')).toHaveCount(0);
});

test('identical documents say so', async ({ page }) => {
  await page.goto('/json/compare');
  await left(page).fill('{"a":1}');
  await right(page).fill('{"a": 1}');
  await expect(page.getByText('The two documents are identical.')).toBeVisible();
});

test('each side reports its own syntax errors', async ({ page }) => {
  await page.goto('/json/compare');
  await left(page).fill('{"a":1}');
  await right(page).fill('{"a":1,}');

  await expect(page.getByText(/Trailing comma before "}"/)).toBeVisible();
  await expect(page.getByText('Paste a document on each side to compare them.')).toBeVisible();
});
