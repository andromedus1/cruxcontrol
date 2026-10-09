import { expect, test, type Page } from '@playwright/test';
import { createSyntheticCatalogSnapshots } from './support/catalog-fixture';

type StoredRecord = Record<string, unknown>;

async function clickBoardHold(page: Page, number: number) {
  const hold = page.getByRole('button', { name: new RegExp(`^Hold ${number},`) });
  await hold.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const bounds = await hold.boundingBox();
  if (!bounds) throw new Error(`Hold ${number} has no visible bounds`);
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(hold).not.toHaveAttribute('data-assignment', 'none');
}

async function createFinishedClimb(page: Page, name: string, holdNumber: number) {
  await page.getByRole('button', { name: 'Create climb' }).click();
  await page.getByLabel('Name').fill(name);
  await clickBoardHold(page, holdNumber);
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Mark finished' }).click();
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Back' }).click();
}

async function readStore(page: Page, database: string, store: string): Promise<StoredRecord[]> {
  return page.evaluate(
    ({ database, store }) => new Promise<StoredRecord[]>((resolve, reject) => {
      const open = indexedDB.open(database, 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction(store).objectStore(store).getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          resolve(request.result as StoredRecord[]);
          db.close();
        };
      };
    }),
    { database, store },
  );
}

async function writeRow(page: Page, database: string, store: string, row: StoredRecord) {
  await page.evaluate(
    ({ database, store, row }) => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(database, 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction(store, 'readwrite');
        transaction.objectStore(store).put(row);
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onabort = () => { db.close(); reject(transaction.error); };
      };
    }),
    { database, store, row },
  );
}

function sorted(rows: StoredRecord[]) {
  return [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function displaySize(bytes: number) {
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  if (bytes < 1_000) return `${formatter.format(bytes)} B`;
  if (bytes < 1_000_000) return `${formatter.format(bytes / 1_000)} KB`;
  return `${formatter.format(bytes / 1_000_000)} MB`;
}

test('installs only with consent, browses offline, and preserves the authored library', async ({
  page,
  context,
}) => {
  const fixture = createSyntheticCatalogSnapshots();
  const snapshot = fixture.snapshots[0]!;
  const catalogRequests: string[] = [];
  const catalogWorkers: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/catalog/')) catalogRequests.push(pathname);
  });
  page.on('worker', (worker) => {
    const pathname = new URL(worker.url()).pathname;
    if (pathname.includes('catalog.worker')) catalogWorkers.push(pathname);
  });
  await page.route('**/catalog/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/catalog/manifest.json') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(snapshot.manifest),
      });
    } else if (pathname === `/catalog/${snapshot.manifest.file}`) {
      await route.fulfill({ status: 200, contentType: 'application/gzip', body: snapshot.compressed });
    } else {
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByRole('button', { name: 'Create climb' }).click();
    await page.getByLabel('Name').fill('Synthetic draft');
    await clickBoardHold(page, 1);
    await expect(page.locator('.save-chip')).toHaveText('saved');
    await page.getByRole('button', { name: 'Back' }).click();
    await createFinishedClimb(page, 'Synthetic finished one', 2);
    await createFinishedClimb(page, 'Synthetic finished two', 3);
    await createFinishedClimb(page, 'Synthetic trash', 4);

    await page.getByRole('button', { name: /My Climbs.*3 climbs/ }).click();
    await page.getByRole('button', { name: /Synthetic trash/ }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Move to trash' }).click();

    await page.getByRole('button', { name: /^Lists/ }).click();
    await page.getByLabel('New list').fill('Synthetic warmup');
    await page.getByRole('button', { name: 'Create list' }).click();
    for (const name of ['Synthetic finished one', 'Synthetic finished two']) {
      await page.getByRole('button', { name: /My Climbs.*2 climbs/ }).click();
      await page.getByRole('button', { name: new RegExp(name) }).click();
      await page.getByRole('button', { name: 'Add to lists' }).click();
      await page.getByRole('checkbox', { name: 'Synthetic warmup' }).check();
      await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
      await page.getByRole('button', { name: 'Close lists' }).click();
    }

    const storedClimbs = await readStore(page, 'cruxcontrol-local-drafts', 'drafts');
    const draft = storedClimbs.find((row) => row.name === 'Synthetic draft');
    if (!draft) throw new Error('Synthetic draft was not saved');
    await writeRow(page, 'cruxcontrol-local-drafts', 'drafts', {
      ...draft,
      effectGroups: [{
        model: 'spatial',
        id: 'synthetic-preserved-effect',
        recipeVersion: 2,
        recipe: { kind: 'ocean-tide', direction: 'in', foam: 0.25 },
        seed: 17,
        palette: [22, 43, 62, 191, 232],
        periodMs: 120000,
        intensity: 1,
        footprint: 12,
        target: { scope: 'unused', include: [], exclude: [] },
      }],
    });
    await page.reload();
    const authoredBefore = {
      climbs: sorted(await readStore(page, 'cruxcontrol-local-drafts', 'drafts')),
      playlists: sorted(await readStore(page, 'cruxcontrol-local-playlists', 'playlists')),
    };
    expect(authoredBefore.climbs.map((row) => row.status).sort()).toEqual(['draft', 'finished', 'finished', 'finished']);
    expect(authoredBefore.climbs.filter((row) => row.trashedAt)).toHaveLength(1);
    expect(authoredBefore.climbs.find((row) => row.name === 'Synthetic draft')?.effectGroups).toHaveLength(1);
    expect(authoredBefore.playlists[0]?.entries).toHaveLength(2);
    const orderedMembership = authoredBefore.playlists[0]?.entries;

    expect(catalogWorkers).toEqual([]);
    await page.getByRole('navigation', { name: 'Workspace destinations' }).getByRole('button', { name: 'Kilter', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Install the catalog to browse', exact: true }).first()).toBeVisible();
    await expect.poll(() => catalogWorkers.length).toBe(1);
    expect(catalogRequests).toEqual([]);
    await page.getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByRole('heading', { name: 'Legacy Kilter catalog' })).toBeFocused();
    await expect(page.getByText(`${displaySize(snapshot.manifest.bytesGzipped)} download · ${displaySize(snapshot.manifest.bytesRaw)} catalog data per snapshot.`)).toBeVisible();
    await expect(page.getByText(`Two slots retain the active and previous snapshots. At this size, two raw copies use ${displaySize(snapshot.manifest.bytesRaw * 2)} of storage, plus metadata and temporary installation space.`)).toBeVisible();
    await expect(page.getByText(/Source freshness: unknown/)).toBeVisible();
    expect(catalogRequests).toEqual(['/catalog/manifest.json']);
    expect(catalogRequests).not.toContain(`/catalog/${snapshot.manifest.file}`);

    await page.getByRole('button', { name: `Download ${displaySize(snapshot.manifest.bytesGzipped)}` }).click();
    await expect(page.getByText('Available offline on this device.')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('region', { name: 'Catalog source' }).getByText('Legacy Kilter', { exact: true })).toBeVisible();
    expect(catalogRequests).toEqual([
      '/catalog/manifest.json',
      `/catalog/${snapshot.manifest.file}`,
    ]);
    await expect.poll(async () => ({
      climbs: sorted(await readStore(page, 'cruxcontrol-local-drafts', 'drafts')),
      playlists: sorted(await readStore(page, 'cruxcontrol-local-playlists', 'playlists')),
    })).toEqual(authoredBefore);
    expect((await readStore(page, 'cruxcontrol-local-playlists', 'playlists'))[0]?.entries).toEqual(orderedMembership);
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.getByLabel('Filter Legacy Kilter climbs')).toBeVisible();
    await expect(page.getByRole('button', { name: /Synthetic route v1/ })).toBeVisible();
    await expect(page.getByText('Page 1 · 1 climb on this page')).toBeVisible();
    await page.getByLabel('Name').fill('not a synthetic route');
    await expect(page.getByText('No climbs match these filters')).toBeVisible();
    await page.getByLabel('Name').fill('Synthetic route');
    await expect(page.getByRole('button', { name: /Synthetic route v1/ })).toBeVisible();
    await page.getByLabel('Grade').selectOption({ label: 'V1' });
    await expect(page.getByRole('button', { name: /Synthetic route v1/ })).toBeVisible();
    await page.getByLabel('Angle').selectOption('45');
    await expect(page.getByText('No climbs match these filters')).toBeVisible();
    await page.getByLabel('Angle').selectOption('40');
    await expect(page.getByRole('button', { name: /Synthetic route v1/ })).toBeVisible();
    await page.getByRole('button', { name: 'Reset filters' }).click();

    await page.getByRole('button', { name: /Synthetic route v1/ }).click();
    const details = page.getByRole('dialog', { name: 'Synthetic route v1 details' });
    await expect(details).toBeVisible();
    await expect(details.getByText('Legacy Kilter · read only')).toBeVisible();
    await expect(details.getByText('Fixture description')).toBeVisible();
    await expect(details.getByLabel('Board preview')).toBeVisible();
    await expect(details.getByText('1', { exact: true })).toBeVisible();
    expect(catalogRequests).toHaveLength(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(details).toBeVisible();
    await expect.poll(() => details.evaluate((dialog) => dialog.matches(':modal'))).toBe(true);
    await page.getByRole('button', { name: 'Close climb details' }).click();
    await expect(details).toHaveCount(0);
    await page.getByRole('button', { name: 'Manage' }).click();
    const manage = page.getByRole('dialog', { name: 'Legacy Kilter catalog' });
    await expect(manage).toBeVisible();
    await expect.poll(() => manage.evaluate((dialog) => dialog.matches(':modal'))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Done' }).click();

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    expect({
      climbs: sorted(await readStore(page, 'cruxcontrol-local-drafts', 'drafts')),
      playlists: sorted(await readStore(page, 'cruxcontrol-local-playlists', 'playlists')),
    }).toEqual(authoredBefore);
    const precachedUrls = await page.evaluate(async () => {
      const keys = await caches.keys();
      const requests = await Promise.all(keys.map(async (key) =>
        (await (await caches.open(key)).keys()).map((request) => request.url),
      ));
      return requests.flat();
    });
    expect(precachedUrls.some((url) => /\/catalog\/.*\.(?:db|db\.gz|gz)(?:\?|$)/i.test(url))).toBe(false);

    await page.unroute('**/catalog/**');
    await context.setOffline(true);
    await page.reload();
    const destinations = page.getByRole('navigation', { name: 'Workspace destinations' });
    await expect(destinations.getByRole('button', { name: 'Kilter', exact: true })).toBeVisible();
    await destinations.getByRole('button', { name: 'Kilter', exact: true }).click();
    await expect(page.getByRole('button', { name: /Synthetic route v1/ })).toBeVisible();
    await page.getByRole('button', { name: /Synthetic route v1/ }).click();
    await expect(page.getByRole('dialog', { name: 'Synthetic route v1 details' })).toBeVisible();
    expect(catalogRequests).toEqual([
      '/catalog/manifest.json',
      `/catalog/${snapshot.manifest.file}`,
    ]);
    expect({
      climbs: sorted(await readStore(page, 'cruxcontrol-local-drafts', 'drafts')),
      playlists: sorted(await readStore(page, 'cruxcontrol-local-playlists', 'playlists')),
    }).toEqual(authoredBefore);
  } finally {
    fixture.dispose();
  }
});
