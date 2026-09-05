import { expect, test } from '@playwright/test';

type StoredRecord = Record<string, unknown>;

async function readStore(page: import('@playwright/test').Page, database: string, store: string) {
  return page.evaluate(
    ({ database, store }) =>
      new Promise<StoredRecord[]>((resolve, reject) => {
        const open = indexedDB.open(database, 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction(store).objectStore(store).getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            resolve(request.result as StoredRecord[]);
            open.result.close();
          };
        };
      }),
    { database, store },
  );
}

async function clickHold(page: import('@playwright/test').Page) {
  const hold = page.getByRole('button', { name: /^Hold 1,/ });
  await hold.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const bounds = await hold.boundingBox();
  if (!bounds) throw new Error('Hold 1 has no visible bounds');
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

test('downloads a complete Trash/list backup and restores it idempotently', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create climb' }).click();
  await page.getByLabel('Name').fill('Backup climb');
  await clickHold(page);
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Mark finished' }).click();
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /Lists.*0 lists/ }).click();
  await page.getByLabel('New list').fill('Backup list');
  await page.getByRole('button', { name: 'Create list' }).click();
  await page.getByRole('button', { name: /My Climbs.*1 climb/ }).click();
  await page.getByRole('button', { name: /Backup climb/ }).click();
  await page.getByRole('button', { name: 'Add to lists' }).click();
  await page.getByRole('checkbox', { name: 'Backup list' }).check();
  await page.getByRole('button', { name: 'Close lists' }).click();
  const sourceLists = await readStore(page, 'cruxcontrol-local-playlists', 'playlists');
  const sourceListId = sourceLists[0]!.id;
  await page.getByRole('button', { name: /Backup climb/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Move to trash' }).click();
  const sourceClimbs = await readStore(page, 'cruxcontrol-local-drafts', 'drafts');
  const sourceId = sourceClimbs[0]!.id;
  const sourceRevision = sourceClimbs[0]!.revision;

  await page.getByRole('button', { name: 'Back up & restore' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download library backup' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  if (!filePath) throw new Error('Backup download did not produce a file');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  const second = await browser.newContext();
  const restoredPage = await second.newPage();
  await restoredPage.setViewportSize({ width: 390, height: 844 });
  await restoredPage.goto('/');
  await restoredPage.getByRole('button', { name: 'Back up & restore' }).click();
  await restoredPage.locator('#library-backup-file').setInputFiles(filePath);
  await expect(restoredPage.getByText('Climbs in backup')).toBeVisible();
  await expect(restoredPage.getByRole('button', { name: 'Add 1 climbs & 1 playlists' })).toBeVisible();
  await restoredPage.getByRole('button', { name: 'Add 1 climbs & 1 playlists' }).click();
  await expect(restoredPage.getByRole('heading', { name: 'Recovery complete' })).toBeVisible();

  const restoredClimbs = await readStore(restoredPage, 'cruxcontrol-local-drafts', 'drafts');
  const restoredLists = await readStore(restoredPage, 'cruxcontrol-local-playlists', 'playlists');
  expect(restoredClimbs).toHaveLength(1);
  expect(restoredLists).toHaveLength(1);
  expect(restoredClimbs[0]).toMatchObject({ id: sourceId, revision: sourceRevision, name: 'Backup climb' });
  expect(restoredClimbs[0]).toHaveProperty('trashedAt');
  expect(restoredLists[0]).toMatchObject({ id: sourceListId, entries: [{ kind: 'local', id: sourceId }] });

  await restoredPage.getByRole('button', { name: 'Close', exact: true }).click();
  await restoredPage.getByRole('button', { name: 'Back up & restore' }).click();
  await restoredPage.locator('#library-backup-file').setInputFiles(filePath);
  await expect(restoredPage.getByText('Everything in this backup is already here.')).toBeVisible();
  expect(restoredPage.getByRole('button', { name: /Add .*climbs/ })).toHaveCount(0);
  await restoredPage.getByRole('button', { name: 'Close', exact: true }).click();

  await restoredPage.evaluate((id) => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('cruxcontrol-local-drafts', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const transaction = open.result.transaction('drafts', 'readwrite');
        const request = transaction.objectStore('drafts').get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const value = request.result as StoredRecord;
          value.name = 'Edited after recovery';
          transaction.objectStore('drafts').put(value);
        };
        transaction.oncomplete = () => { open.result.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, sourceId);
  await restoredPage.getByRole('button', { name: 'Back up & restore' }).click();
  await restoredPage.locator('#library-backup-file').setInputFiles(filePath);
  await expect(restoredPage.getByText('Recovery is paused. Nothing was added.')).toBeVisible();
  await expect(restoredPage.getByText('Backup climb')).toBeVisible();
  expect((await readStore(restoredPage, 'cruxcontrol-local-drafts', 'drafts'))[0]).toMatchObject({ name: 'Edited after recovery' });
  await second.close();
});
