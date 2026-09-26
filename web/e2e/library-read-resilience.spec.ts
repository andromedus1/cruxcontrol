import { expect, test } from '@playwright/test';

test('keeps healthy climbs and Trash usable beside unreadable climbs and lists without rewriting evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create climb' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Healthy saved climb');
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Mark finished' }).click();
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  const evidence = await page.evaluate(async () => {
    const unreadable = { id: 'unreadable-climb', schemaVersion: 999, sourceEvidence: 'retain exactly' };
    const brokenList = { id: 'unreadable-list', schemaVersion: 999, updatedOrder: ['2099', 'unreadable-list'] };
    for (const [databaseName, storeName, value] of [
      ['cruxcontrol-local-drafts', 'drafts', unreadable],
      ['cruxcontrol-local-playlists', 'playlists', brokenList],
    ] as const) {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(databaseName, 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put(value);
          tx.oncomplete = () => { open.result.close(); resolve(); };
          tx.onabort = () => { open.result.close(); reject(tx.error); };
        };
      });
    }
    return { unreadable, brokenList };
  });

  await page.reload();
  await expect(page.getByText('Healthy saved climb', { exact: true })).toBeVisible();
  await expect(page.getByText(/unreadable-climb:/)).toBeVisible();
  await page.getByText('Healthy saved climb', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
  await page.getByRole('button', { name: /Trash.*1 climb/ }).click();
  await expect(page.getByText('Healthy saved climb', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Lists/ }).click();
  await expect(page.getByRole('button', { name: 'Retry loading lists' })).toBeVisible();

  const stored = await page.evaluate(async () => {
    const result: unknown[] = [];
    for (const [databaseName, storeName, key] of [
      ['cruxcontrol-local-drafts', 'drafts', 'unreadable-climb'],
      ['cruxcontrol-local-playlists', 'playlists', 'unreadable-list'],
    ]) {
      result.push(await new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open(databaseName!, 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const read = open.result.transaction(storeName!).objectStore(storeName!).get(key!);
          read.onerror = () => { open.result.close(); reject(read.error); };
          read.onsuccess = () => { open.result.close(); resolve(read.result); };
        };
      }));
    }
    return result;
  });
  expect(stored).toEqual([evidence.unreadable, evidence.brokenList]);
});
