import { expect, test } from '@playwright/test';

async function storedDrafts(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const request = indexedDB.open('cruxcontrol-local-drafts', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const read = database.transaction('drafts').objectStore('drafts').getAll();
          read.onerror = () => reject(read.error);
          read.onsuccess = () => {
            resolve(read.result as Record<string, unknown>[]);
            database.close();
          };
        };
      }),
  );
}

async function patchStoredLoop(page: import('@playwright/test').Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('cruxcontrol-local-drafts', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('drafts', 'readwrite');
          const store = transaction.objectStore('drafts');
          const read = store.getAll();
          read.onerror = () => reject(read.error);
          read.onsuccess = () => {
            const draft = read.result[0] as { effectGroups: Array<Record<string, unknown>> };
            draft.effectGroups = draft.effectGroups.map((group) => ({ ...group, recipeVersion: 1, periodMs: 5_000 }));
            store.put(draft);
          };
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );
}

test('loads a saved original loop and persists explicit seamless adoption', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create climb' }).click();
  await page.getByLabel('Name').fill('Seamless proof');
  await page.locator('summary').filter({ hasText: 'Add a preset' }).click();
  await page.getByRole('button', { name: /Snake 7 lights/ }).click();
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Back' }).click();

  await patchStoredLoop(page);
  await page.reload();
  await page.getByRole('button', { name: /Drafts.*1 climb/ }).click();
  await page.getByRole('button', { name: /Seamless proof/ }).click();
  await page.getByRole('button', { name: 'Edit climb' }).click();
  await expect(page.getByText('Original loop')).toBeVisible();
  await expect(page.getByText(/Uses a 150-second loop/)).toBeVisible();
  await page.getByRole('button', { name: 'Use seamless loop' }).click();
  await expect(page.getByText('Seamless loop')).toBeVisible();
  await expect(page.locator('.save-chip')).toHaveText('saved');

  const [saved] = await storedDrafts(page);
  expect(saved?.effectGroups).toEqual([
    expect.objectContaining({ model: 'spatial', recipeVersion: 2, periodMs: 150_000 }),
  ]);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Drafts.*1 climb/ }).click();
  await page.getByRole('button', { name: /Seamless proof/ }).click();
  await page.getByRole('button', { name: 'Edit climb' }).click();
  await expect(page.getByText('Seamless loop')).toBeVisible();
  await expect(page.getByLabel('Effect cycle time')).toHaveValue('150000');
});
