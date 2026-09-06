import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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

async function writeRows(
  page: import('@playwright/test').Page,
  database: string,
  store: string,
  rows: StoredRecord[],
) {
  await page.evaluate(
    ({ database, store, rows }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(database, 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const transaction = open.result.transaction(store, 'readwrite');
          for (const row of rows) transaction.objectStore(store).put(row);
          transaction.oncomplete = () => {
            open.result.close();
            resolve();
          };
          transaction.onabort = () => {
            open.result.close();
            reject(transaction.error);
          };
        };
      }),
    { database, store, rows },
  );
}
const sorted = (rows: StoredRecord[]) =>
  [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));

// Enrich actual UI-created records with historical storage shapes. Export must
// normalize only the file, leaving every old source row byte-for-byte unchanged.
function preservationFixture(climb: StoredRecord, list: StoredRecord) {
  const ids = [
    String(climb.id),
    ...[602, 603, 604].map((n) => `00000000-0000-4000-8000-000000000${n}`),
  ];
  const dates = { createdAt: '2019-01-01T00:00:00.000Z', updatedAt: '2020-01-02T00:00:00.000Z' };
  const base = {
    ...climb,
    ...dates,
    revision: 9,
    updatedOrder: [dates.updatedAt, ids[0]],
    trashedAt: '2020-01-03T00:00:00.000Z',
    metadata: { grade: '6B', description: 'Preserve old project notes', setterNotes: 'Quiet feet' },
  };
  const spatial = {
    model: 'spatial',
    target: { scope: 'unused', include: [], exclude: [] },
    seed: 17,
    intensity: 0.8,
    footprint: 3,
    periodMs: 120000,
  };
  const current = {
    ...base,
    effectGroups: [
      {
        ...spatial,
        id: 'backup-original',
        recipeVersion: 1,
        periodMs: 5000,
        palette: [28, 192],
        recipe: { kind: 'snake', direction: 'reverse', bodyLength: 3 },
      },
      {
        ...spatial,
        id: 'backup-seamless',
        recipeVersion: 2,
        palette: [22, 43],
        recipe: { kind: 'ocean-tide', direction: 'out', foam: 0.4 },
      },
      {
        ...spatial,
        id: 'backup-bee',
        recipeVersion: 2,
        footprint: 5,
        palette: [244, 71],
        recipe: { kind: 'bumblebee', hoverFraction: 0.35 },
      },
    ],
  };
  const historical = [1, 2, 3].map((schemaVersion, index) => {
    const row: StoredRecord = {
      ...base,
      schemaVersion,
      id: ids[index + 1],
      updatedOrder: [dates.updatedAt, ids[index + 1]],
      name: ['Unlisted old climb', 'Old hold effect', 'Old Trash'][index],
      effectGroups: [],
    };
    if (schemaVersion < 3) {
      delete row.status;
      delete row.trashedAt;
    }
    if (schemaVersion === 1) {
      delete row.effectGroups;
      row.installationId = 'home:other-wall';
    }
    if (schemaVersion === 2)
      row.effectGroups = [
        { id: 'old-pulse', kind: 'pulse', palette: [28], periodMs: 2000, intensity: 0.6 },
      ];
    return row;
  });
  const first = {
    ...list,
    notes: 'Preserve order and unavailable references',
    entries: [
      { kind: 'local', id: ids[0] },
      {
        kind: 'provider',
        id: {
          provider: 'kilter',
          sourceId: 'unavailable-remote',
          layoutRevision: 'kilter-fullride-7x10-v1',
        },
      },
      { kind: 'local', id: '00000000-0000-4000-8000-000000000699' },
    ],
  };
  const secondId = '00000000-0000-4000-8000-000000000605';
  const second = {
    ...list,
    id: secondId,
    updatedOrder: [list.updatedAt, secondId],
    name: 'Shared membership',
    entries: [
      { kind: 'local', id: ids[0] },
      { kind: 'local', id: ids[2] },
    ],
  };
  return { drafts: [current, ...historical], playlists: [first, second] };
}

test('downloads a complete Trash/list backup and restores it idempotently', async ({
  page,
  browser,
}) => {
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
  const initialClimbs = await readStore(page, 'cruxcontrol-local-drafts', 'drafts');
  const fixture = preservationFixture(initialClimbs[0]!, sourceLists[0]!);
  await writeRows(page, 'cruxcontrol-local-drafts', 'drafts', fixture.drafts);
  await writeRows(page, 'cruxcontrol-local-playlists', 'playlists', fixture.playlists);
  await page.reload();
  expect(sorted(await readStore(page, 'cruxcontrol-local-drafts', 'drafts'))).toEqual(
    sorted(fixture.drafts),
  );
  const sourceId = initialClimbs[0]!.id;
  const sourceRevision = 9;

  await page.getByRole('button', { name: 'Back up & restore' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download library backup' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  if (!filePath) throw new Error('Backup download did not produce a file');
  const downloaded = JSON.parse(await readFile(filePath, 'utf8')) as {
    drafts: StoredRecord[];
    playlists: StoredRecord[];
  };
  expect(downloaded.drafts).toHaveLength(4);
  expect(downloaded.playlists).toHaveLength(2);
  expect(sorted(await readStore(page, 'cruxcontrol-local-drafts', 'drafts'))).toEqual(
    sorted(fixture.drafts),
  );
  expect(sorted(await readStore(page, 'cruxcontrol-local-playlists', 'playlists'))).toEqual(
    sorted(fixture.playlists),
  );
  expect(downloaded.drafts.every((row) => row.schemaVersion === 4)).toBe(true);
  expect(downloaded.drafts.find((row) => row.id === sourceId)).toMatchObject({
    metadata: fixture.drafts[0]!.metadata,
    trashedAt: '2020-01-03T00:00:00.000Z',
    effectGroups: fixture.drafts[0]!.effectGroups,
  });
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  const second = await browser.newContext();
  const restoredPage = await second.newPage();
  await restoredPage.setViewportSize({ width: 390, height: 844 });
  await restoredPage.goto('/');
  await restoredPage.getByRole('button', { name: 'Back up & restore' }).click();
  await restoredPage.locator('#library-backup-file').setInputFiles(filePath);
  await expect(restoredPage.getByText('Climbs in backup')).toBeVisible();
  await expect(
    restoredPage.getByRole('button', { name: 'Add 4 climbs & 2 playlists' }),
  ).toBeVisible();
  await restoredPage.getByRole('button', { name: 'Add 4 climbs & 2 playlists' }).click();
  await expect(restoredPage.getByRole('heading', { name: 'Recovery complete' })).toBeVisible();

  const restoredClimbs = await readStore(restoredPage, 'cruxcontrol-local-drafts', 'drafts');
  const restoredLists = await readStore(restoredPage, 'cruxcontrol-local-playlists', 'playlists');
  expect(sorted(restoredClimbs)).toEqual(sorted(downloaded.drafts));
  expect(sorted(restoredLists)).toEqual(sorted(downloaded.playlists));
  expect(restoredClimbs.find((row) => row.id === sourceId)).toMatchObject({
    id: sourceId,
    revision: sourceRevision,
    name: 'Backup climb',
  });
  expect(restoredClimbs.filter((row) => row.trashedAt === '2020-01-03T00:00:00.000Z')).toHaveLength(
    2,
  );
  expect(restoredLists.find((row) => row.id === sourceListId)?.entries).toEqual(
    fixture.playlists[0]!.entries,
  );

  await restoredPage.keyboard.press('Escape');
  await expect(restoredPage.getByRole('button', { name: 'Back up & restore' })).toBeFocused();
  await restoredPage.reload();
  expect(sorted(await readStore(restoredPage, 'cruxcontrol-local-drafts', 'drafts'))).toEqual(
    sorted(downloaded.drafts),
  );
  expect(sorted(await readStore(restoredPage, 'cruxcontrol-local-playlists', 'playlists'))).toEqual(
    sorted(downloaded.playlists),
  );
  await restoredPage.getByRole('button', { name: 'Back up & restore' }).click();
  await restoredPage.locator('#library-backup-file').setInputFiles(filePath);
  await expect(restoredPage.getByText('Everything in this backup is already here.')).toBeVisible();
  await expect(restoredPage.getByRole('button', { name: /Add .*climbs/ })).toHaveCount(0);
  expect(sorted(await readStore(restoredPage, 'cruxcontrol-local-drafts', 'drafts'))).toEqual(
    sorted(downloaded.drafts),
  );
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
        transaction.oncomplete = () => {
          open.result.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, sourceId);
  await restoredPage.getByRole('button', { name: 'Back up & restore' }).click();
  await restoredPage.locator('#library-backup-file').setInputFiles(filePath);
  await expect(restoredPage.getByText('Recovery is paused. Nothing was added.')).toBeVisible();
  await expect(restoredPage.getByText('Backup climb')).toBeVisible();
  expect(
    (await readStore(restoredPage, 'cruxcontrol-local-drafts', 'drafts')).find(
      (row) => row.id === sourceId,
    ),
  ).toMatchObject({ name: 'Edited after recovery' });
  expect(sorted(await readStore(restoredPage, 'cruxcontrol-local-playlists', 'playlists'))).toEqual(
    sorted(downloaded.playlists),
  );
  await second.close();
});
