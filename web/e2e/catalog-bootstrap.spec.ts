import { expect, test, type JSHandle, type Page, type Route } from '@playwright/test';
import { createSyntheticCatalogSnapshots, type SyntheticCatalogSnapshot } from './support/catalog-fixture.ts';

type HarnessStatus =
  | { status: 'empty' }
  | { status: 'ready'; receipt: { manifest: { version: number }; slot: 'a' | 'b' } }
  | { status: 'unavailable'; code: string; message: string };

type Harness = {
  status(): Promise<HarnessStatus>;
  install(): Promise<{ ok: boolean; code?: string; receipt?: { slot: string; manifest: { version: number } } }>;
  queryName(): Promise<string | null>;
  authored(): Promise<{
    climbs: Array<{ id: string; name: string }>;
    playlists: Array<{ id: string; name: string }>;
    memberships: Array<{ playlistId: string; climbId: string; position: number }>;
  }>;
  restart(fault?: 'none' | 'before-receipt' | 'after-receipt' | 'pool-init-busy'): Promise<HarnessStatus>;
  close(): Promise<void>;
};
type HarnessHandle = JSHandle<Harness>;

let snapshots: SyntheticCatalogSnapshot[];
let dispose: (() => void) | undefined;

test.beforeAll(() => {
  const fixture = createSyntheticCatalogSnapshots();
  snapshots = fixture.snapshots;
  dispose = fixture.dispose;
});

test.afterAll(() => dispose?.());

async function routeSnapshot(route: Route, snapshot: SyntheticCatalogSnapshot): Promise<void> {
  const url = new URL(route.request().url());
  if (url.pathname === '/catalog/manifest.json') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot.manifest) });
    return;
  }
  if (url.pathname === `/catalog/${snapshot.manifest.file}`) {
    await route.fulfill({ status: 200, contentType: 'application/gzip', body: snapshot.compressed });
    return;
  }
  await route.continue();
}

async function installRoutes(page: Page, selected: () => SyntheticCatalogSnapshot): Promise<void> {
  await page.route('**/catalog/**', (route) => routeSnapshot(route, selected()));
}

async function readyHarness(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as Window & { catalogHarness?: Harness }).catalogHarness));
}

async function harness(page: Page): Promise<HarnessHandle> {
  return page.evaluateHandle(() => (window as Window & { catalogHarness: Harness }).catalogHarness);
}

test('installs synthetic SQLite after consent and reopens offline without changing authored records', async ({ page }) => {
  const selected = snapshots[0];
  await installRoutes(page, () => selected);
  let binaryRequests = 0;
  let manifestRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('.db.gz')) binaryRequests += 1;
    if (request.url().endsWith('/catalog/manifest.json')) manifestRequests += 1;
  });

  await readyHarness(page);
  const api = await harness(page);
  await expect.poll(() => api.evaluate((value) => value.status())).toHaveProperty('status', 'empty');
  expect(binaryRequests).toBe(0);
  expect(manifestRequests).toBe(0);
  const authoredBefore = await api.evaluate((value) => value.authored());
  expect(authoredBefore.memberships.map((entry) => entry.climbId)).toEqual([
    'authored-climb-2', 'authored-climb-1',
  ]);

  expect(await api.evaluate((value) => value.install())).toMatchObject({ ok: true });
  expect(binaryRequests).toBe(1);
  expect(manifestRequests).toBe(1);
  await expect.poll(() => api.evaluate((value) => value.queryName())).toBe('Synthetic route v1');
  const receipt = await api.evaluate((value) => value.status());
  expect(receipt).toMatchObject({ status: 'ready', receipt: { manifest: { generatedOn: '2026-10-09' } } });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as Window & { catalogHarness?: Harness }).catalogHarness));
  const reopened = await harness(page);
  await expect.poll(() => reopened.evaluate((value) => value.status())).toHaveProperty('status', 'ready');
  await expect.poll(() => reopened.evaluate((value) => value.queryName())).toBe('Synthetic route v1');
  expect(binaryRequests).toBe(1);
  expect(manifestRequests).toBe(1);
  expect(await reopened.evaluate((value) => value.status())).toMatchObject({
    status: 'ready', receipt: { manifest: { generatedOn: '2026-10-09', sourceDataThrough: null } },
  });
  expect(await reopened.evaluate((value) => value.authored())).toEqual(authoredBefore);
  await reopened.evaluate((value) => value.close());
});

test('recovers the receipt-selected slot when the worker exits on either side of activation', async ({ page }) => {
  let selected = snapshots[0];
  await installRoutes(page, () => selected);
  await readyHarness(page);
  let api = await harness(page);
  expect(await api.evaluate((value) => value.install())).toMatchObject({ ok: true });
  const authoredBefore = await api.evaluate((value) => value.authored());

  selected = snapshots[1];
  await api.evaluate((value) => value.restart('before-receipt'));
  const pendingBefore = api.evaluate((value) => value.install()).catch(() => null);
  await page.waitForFunction(() => document.body.dataset.catalogBoundary === 'before-receipt');
  await page.reload();
  await pendingBefore;
  await page.waitForFunction(() => Boolean((window as Window & { catalogHarness?: Harness }).catalogHarness));
  api = await harness(page);
  await expect.poll(() => api.evaluate((value) => value.status())).toHaveProperty('status', 'ready');
  expect(await api.evaluate((value) => value.queryName())).toBe('Synthetic route v1');
  expect((await api.evaluate((value) => value.status())).receipt?.manifest.version).toBe(1);

  await api.evaluate((value) => value.restart('after-receipt'));
  const pendingAfter = api.evaluate((value) => value.install()).catch(() => null);
  await page.waitForFunction(() => document.body.dataset.catalogBoundary === 'after-receipt');
  await page.reload();
  await pendingAfter;
  await page.waitForFunction(() => Boolean((window as Window & { catalogHarness?: Harness }).catalogHarness));
  api = await harness(page);
  await expect.poll(() => api.evaluate((value) => value.status())).toHaveProperty('status', 'ready');
  expect(await api.evaluate((value) => value.queryName())).toBe('Synthetic route v2');
  expect((await api.evaluate((value) => value.status())).receipt?.manifest.version).toBe(2);
  expect(await api.evaluate((value) => value.authored())).toEqual(authoredBefore);
  await api.evaluate((value) => value.close());
});

test('a second tab waits for the lease, then opens the committed catalog after owner close', async ({ page, context }) => {
  const selected = snapshots[0];
  await installRoutes(page, () => selected);
  await readyHarness(page);
  const owner = await harness(page);
  expect(await owner.evaluate((value) => value.install())).toMatchObject({ ok: true });

  const second = await context.newPage();
  await installRoutes(second, () => selected);
  await readyHarness(second);
  const contender = await harness(second);
  const blocked = await contender.evaluate((value) => value.status());
  expect(blocked).toMatchObject({ status: 'unavailable', code: 'busy' });

  await owner.evaluate((value) => value.close());
  const recovered = await contender.evaluate((value) => value.restart());
  expect(recovered).toMatchObject({ status: 'ready', receipt: { manifest: { version: 1 } } });
  expect(await contender.evaluate((value) => value.queryName())).toBe('Synthetic route v1');
  await contender.evaluate((value) => value.close());
});

test('retires a worker after access-handle contention and succeeds with a fresh worker', async ({ page }) => {
  const selected = snapshots[0];
  await installRoutes(page, () => selected);
  await readyHarness(page);
  let api = await harness(page);
  expect(await api.evaluate((value) => value.install())).toMatchObject({ ok: true });

  const busy = await api.evaluate((value) => value.restart('pool-init-busy'));
  expect(busy).toMatchObject({ status: 'unavailable', code: 'busy' });
  const reopened = await api.evaluate((value) => value.restart());
  expect(reopened).toMatchObject({ status: 'ready', receipt: { manifest: { version: 1 } } });
  api = await harness(page);
  expect(await api.evaluate((value) => value.queryName())).toBe('Synthetic route v1');
  await api.evaluate((value) => value.close());
});
