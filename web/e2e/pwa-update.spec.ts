import { expect, test, type Page } from '@playwright/test';
import { buildPwaGenerations, type PwaGenerationBuilds } from './support/pwa-builds';
import { PwaGenerationServer } from './support/pwa-server';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

interface StoredDraft {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly revision: number;
}

interface WorkerSnapshot {
  readonly waiting: string | null;
  readonly installing: string | null;
  readonly active: string | null;
  readonly controller: string | null;
}

let builds: PwaGenerationBuilds;
let server: PwaGenerationServer;

async function workerSnapshot(page: Page): Promise<WorkerSnapshot> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      waiting: registration?.waiting?.state ?? null,
      installing: registration?.installing?.state ?? null,
      active: registration?.active?.state ?? null,
      controller: navigator.serviceWorker.controller?.scriptURL ?? null,
    };
  });
}

async function requestWorkerUpdate(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
}

async function openControlledGeneration(page: Page, generation: 'A' | 'B' | 'C'): Promise<void> {
  await page.goto(`${server.origin}/`);
  await expect(page.locator('meta[name="cruxcontrol-build-generation"]')).toHaveAttribute(
    'content',
    generation,
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await workerSnapshot(page)).controller) {
    // A newly installed worker does not control the navigation that installed
    // it. Reloading once is the observable lifecycle step that establishes the
    // controlled app client used by the update assertions below.
    await page.reload();
  }
  await expect(page.locator('meta[name="cruxcontrol-build-generation"]')).toHaveAttribute(
    'content',
    generation,
  );
  await expect
    .poll(async () => (await workerSnapshot(page)).controller, { timeout: 30_000 })
    .toContain('/sw.js');
}

async function readDrafts(page: Page): Promise<StoredDraft[]> {
  return page.evaluate(
    () =>
      new Promise<StoredDraft[]>((resolve, reject) => {
        const open = indexedDB.open('cruxcontrol-local-drafts', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const request = database.transaction('drafts').objectStore('drafts').getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            resolve(request.result as StoredDraft[]);
            database.close();
          };
        };
      }),
  );
}

async function waitForDraft(page: Page, name: string): Promise<StoredDraft> {
  let match: StoredDraft | undefined;
  await expect
    .poll(
      async () => {
        match = (await readDrafts(page)).find((draft) => draft.name === name);
        return Boolean(match);
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  if (!match) throw new Error(`Could not find persisted climb ${name}`);
  return match;
}

function updateControl(page: Page) {
  return page.getByRole('complementary', { name: 'Application update' });
}

test.beforeAll(async () => {
  // This hook compiles three production generations; CI needs a build budget
  // independent of the ordinary per-test hook default.
  test.setTimeout(180_000);
  builds = await buildPwaGenerations();
  server = new PwaGenerationServer(builds);
  await server.start();
});

test.afterAll(async () => {
  await server?.close();
  await builds?.cleanup();
});

test('preserves a climb across legacy auto-update, safe waiting, and explicit safe apply', async ({
  browser,
}) => {
  // The fixture proves the build contract before browser state is involved:
  // every output is a generated Workbox worker and each precache revision is
  // distinct, while B/C carry inert source-generation markers.
  expect(new Set([builds.A.workerHash, builds.B.workerHash, builds.C.workerHash]).size).toBe(3);
  expect(builds.A.workerSource).toMatch(/precacheAndRoute/);
  expect(builds.B.workerSource).toMatch(/precacheAndRoute/);
  expect(builds.C.workerSource).toMatch(/precacheAndRoute/);
  expect(builds.B.marker).toBe('B');
  expect(builds.C.marker).toBe('C');

  const context = await browser.newContext();
  try {
    const pageA = await context.newPage();
    await openControlledGeneration(pageA, 'A');
    await expect(pageA.getByRole('heading', { name: 'My Climbs' })).toBeVisible();

    await pageA.getByRole('button', { name: 'Create climb' }).click();
    await pageA.getByLabel('Name', { exact: true }).fill('Cross-build climb');
    await expect(pageA.locator('.save-chip')).toHaveText('saved');
    const savedOnA = await waitForDraft(pageA, 'Cross-build climb');
    await pageA.getByRole('button', { name: 'Mark finished' }).click();
    await expect(pageA.locator('.save-chip')).toHaveText('saved');
    await pageA.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(pageA.getByRole('heading', { name: 'My Climbs' })).toBeVisible();

    // A is the historical autoUpdate app. B must install as a real waiting
    // worker while this A client remains open and its rendered generation stays A.
    server.switchGeneration('B');
    await requestWorkerUpdate(pageA);
    await expect
      .poll(async () => (await workerSnapshot(pageA)).waiting, { timeout: 30_000 })
      .toBe('installed');
    await expect
      .poll(
        () => pageA.locator('meta[name="cruxcontrol-build-generation"]').getAttribute('content'),
        { timeout: 5_000 },
      )
      .toBe('A');
    await expect(pageA.getByRole('heading', { name: 'My Climbs' })).toBeVisible();

    // Closing the only A client allows B to activate naturally. The same browser
    // context and origin retain IndexedDB while the server keeps its port.
    await pageA.close();
    const pageB = await context.newPage();
    await openControlledGeneration(pageB, 'B');
    await expect(pageB.getByRole('button', { name: /Cross-build climb/ })).toBeVisible();
    const savedOnB = await waitForDraft(pageB, 'Cross-build climb');
    expect(savedOnB.id).toBe(savedOnA.id);

    // C arrives through the native registration.update() path. Exercise Later
    // and the accessible re-open entry before testing the safety gates.
    server.switchGeneration('C');
    await requestWorkerUpdate(pageB);
    await expect
      .poll(async () => (await workerSnapshot(pageB)).waiting, { timeout: 30_000 })
      .toBe('installed');
    const control = updateControl(pageB);
    await expect(control).toContainText('CruxControl update available');
    await control.getByRole('button', { name: 'Later', exact: true }).click();
    await expect(
      control.getByRole('button', { name: 'Update available', exact: true }),
    ).toBeVisible();
    await control.getByRole('button', { name: 'Update available', exact: true }).click();
    await expect(
      control.getByRole('button', { name: 'Update and reload', exact: true }),
    ).toBeVisible();

    // An open editor remains a conservative update block even after its current
    // autosave settles, so applying cannot interrupt the editing surface.
    await pageB.getByRole('button', { name: /Cross-build climb/ }).click();
    await pageB.getByRole('button', { name: 'Edit climb', exact: true }).click();
    await expect(pageB.getByLabel('Name', { exact: true })).toBeVisible();
    await pageB.getByLabel('Name', { exact: true }).fill('Cross-build climb edited');
    await expect(pageB.locator('.save-chip')).toHaveText('saved');
    await expect(
      control.getByRole('button', { name: 'Update and reload', exact: true }),
    ).toBeDisabled();
    await expect(control).toContainText(
      'Finish saving your climb and return to the library before updating.',
    );
    await pageB.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(pageB.getByRole('heading', { name: 'My Climbs' })).toBeVisible();
    await expect(pageB.getByRole('button', { name: /Cross-build climb edited/ })).toBeVisible();

    // The playlist editor reports unsaved metadata to the same coordinator.
    await pageB.getByRole('button', { name: /Lists.*0 lists/ }).click();
    await pageB.getByLabel('New list', { exact: true }).fill('Update projects');
    await pageB.getByRole('button', { name: 'Create list', exact: true }).click();
    await expect(pageB.getByRole('button', { name: /Update projects.*0 climbs/ })).toBeVisible();
    await pageB.getByLabel('List name', { exact: true }).fill('Update projects edited');
    await expect(
      pageB.getByRole('button', { name: 'Update and reload', exact: true }),
    ).toBeDisabled();
    await expect(control).toContainText('Save your list changes before updating.');
    await pageB.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(pageB.locator('.playlist-metadata [role="status"]')).toHaveText('Saved');

    // Opening the backup surface is itself a safety block for its full lifetime.
    await pageB.getByRole('button', { name: 'Back up & restore', exact: true }).click();
    await expect(
      pageB.getByRole('heading', { name: 'Back up & restore', exact: true }),
    ).toBeVisible();
    await expect(
      pageB.getByRole('button', { name: 'Update and reload', exact: true }),
    ).toBeDisabled();
    await expect(control).toContainText(
      'Wait for your backup or restore to finish before updating.',
    );
    await pageB.getByRole('button', { name: 'Close backup and restore', exact: true }).click();

    // A second B client holds a shared Web Lock lease. The first requester must
    // remain protected when its exclusive ifAvailable request loses the race.
    const pageB2 = await context.newPage();
    await openControlledGeneration(pageB2, 'B');
    await expect(
      pageB.getByRole('button', { name: 'Update and reload', exact: true }),
    ).toBeEnabled();
    await pageB.getByRole('button', { name: 'Update and reload', exact: true }).click();
    await expect(control).toContainText(
      'Close your other CruxControl tabs, then try updating again.',
    );
    await expect(pageB.locator('meta[name="cruxcontrol-build-generation"]')).toHaveAttribute(
      'content',
      'B',
    );
    await pageB2.close();

    // Once the competing lease is gone, the explicit requester applies C. The
    // coordinator reloads only this requester after target controllerchange.
    await expect(
      pageB.getByRole('button', { name: 'Update and reload', exact: true }),
    ).toBeEnabled();
    await pageB.getByRole('button', { name: 'Update and reload', exact: true }).click();
    await expect(pageB.locator('meta[name="cruxcontrol-build-generation"]')).toHaveAttribute(
      'content',
      'C',
      { timeout: 30_000 },
    );
    await expect(pageB.getByRole('heading', { name: 'My Climbs' })).toBeVisible();
    const savedOnC = await waitForDraft(pageB, 'Cross-build climb edited');
    expect(savedOnC.id).toBe(savedOnA.id);
    expect(savedOnC.status).toBe('finished');
  } finally {
    await context.close();
  }
});

// Delay only the invocation of a real native exclusive request. Both requesters
// must release their shared leases before either races for the exclusive lease;
// all grant/deny results and callback lifetimes remain browser-owned.
async function installLockBarrier(page: Page, mode: 'shared' | 'exclusive', atStartup = false) {
  const install = (mode: 'shared' | 'exclusive') => {
    if (mode === 'shared' && sessionStorage.getItem('crux-test-admission-used')) return;
    if (mode === 'shared') sessionStorage.setItem('crux-test-admission-used', '1');
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gate = { requested: false, release };
    (window as unknown as { cruxLockBarrier: typeof gate }).cruxLockBarrier = gate;
    const nativeRequest = navigator.locks.request.bind(navigator.locks);
    Object.defineProperty(navigator.locks, 'request', {
      value: async (name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) => {
        if (name === 'cruxcontrol-app' && options.mode === mode) {
          gate.requested = true;
          await ready;
        }
        return nativeRequest(name, options, callback);
      },
    });
  };
  if (atStartup) await page.addInitScript(install, mode);
  else await page.evaluate(install, mode);
}

test('protects simultaneous update requesters and a new tab during real activation', async ({
  browser,
}) => {
  const context = await browser.newContext();
  server.switchGeneration('B');
  server.holdActivation();
  try {
    const first = await context.newPage();
    await openControlledGeneration(first, 'B');
    await first.getByRole('button', { name: 'Create climb', exact: true }).click();
    await first.getByLabel('Name', { exact: true }).fill('Concurrent update climb');
    await expect(first.locator('.save-chip')).toHaveText('saved');
    const saved = await waitForDraft(first, 'Concurrent update climb');
    await first.getByRole('button', { name: 'Back', exact: true }).click();

    const second = await context.newPage();
    await openControlledGeneration(second, 'B');
    server.switchGeneration('C');
    await requestWorkerUpdate(first);
    const requesters = [first, second];
    for (const page of requesters) {
      await expect(
        updateControl(page).getByRole('button', { name: 'Update and reload', exact: true }),
      ).toBeEnabled();
      await installLockBarrier(page, 'exclusive');
    }

    // Start an old B navigation but hold its first shared request before the
    // native call. Releasing that scheduling barrier during real activation
    // makes the new app request actual browser admission behind the exclusive
    // lease, with its old controller identity already captured.
    const newcomer = await context.newPage();
    await installLockBarrier(newcomer, 'shared', true);
    await newcomer.goto(server.origin + '/');
    await newcomer.waitForFunction(
      () =>
        (window as unknown as { cruxLockBarrier: { requested: boolean } }).cruxLockBarrier
          .requested,
    );

    await Promise.all(
      requesters.map((page) =>
        updateControl(page).getByRole('button', { name: 'Update and reload', exact: true }).click(),
      ),
    );
    for (const page of requesters) {
      await page.waitForFunction(
        () =>
          (window as unknown as { cruxLockBarrier: { requested: boolean } }).cruxLockBarrier
            .requested,
      );
    }
    await Promise.all(
      requesters.map((page) =>
        page.evaluate(() =>
          (window as unknown as { cruxLockBarrier: { release(): void } }).cruxLockBarrier.release(),
        ),
      ),
    );
    await expect.poll(() => server.activationPending).toBe(true);

    // Workbox received the real activation message, and its native skipWaiting
    // call is held by the fixture scheduling gate. One actual lease is exclusive
    // and the losing requester has queued its shared reacquisition.
    await expect
      .poll(() =>
        first.evaluate(async () => {
          const state = await navigator.locks.query();
          return {
            exclusive: state.held?.filter(
              (lock) => lock.name === 'cruxcontrol-app' && lock.mode === 'exclusive',
            ).length,
            pending: state.pending?.filter(
              (lock) => lock.name === 'cruxcontrol-app' && lock.mode === 'shared',
            ).length,
          };
        }),
      )
      .toEqual({ exclusive: 1, pending: 1 });

    await newcomer.evaluate(() =>
      (window as unknown as { cruxLockBarrier: { release(): void } }).cruxLockBarrier.release(),
    );
    await expect(newcomer.getByText('Opening your local climbs…', { exact: true })).toBeVisible();
    await expect(newcomer.getByRole('button', { name: 'Create climb', exact: true })).toHaveCount(
      0,
    );
    await expect
      .poll(() =>
        first.evaluate(
          async () =>
            (await navigator.locks.query()).pending?.filter(
              (lock) => lock.name === 'cruxcontrol-app' && lock.mode === 'shared',
            ).length,
        ),
      )
      .toBe(2);

    server.releaseActivation();
    const marker = (page: Page) =>
      page.locator('meta[name="cruxcontrol-build-generation"]').getAttribute('content');
    await expect
      .poll(
        async () =>
          (await Promise.all(requesters.map(marker))).filter((value) => value === 'C').length,
        { timeout: 30_000 },
      )
      .toBe(1);
    const winner = (await marker(first)) === 'C' ? first : second;
    const loser = winner === first ? second : first;
    for (const page of [loser, newcomer]) {
      await expect(
        updateControl(page).getByRole('button', { name: 'Reload to continue', exact: true }),
      ).toBeVisible();
      expect(await marker(page)).toBe('B');
      expect((await waitForDraft(page, 'Concurrent update climb')).id).toBe(saved.id);
    }
    // The already-open loser keeps an inert workspace; a never-admitted new
    // tab has no workspace at all. Inert elements remain queryable by role,
    // but the browser must refuse focus and interaction.
    await expect(loser.locator('main.climb-workspace')).toHaveAttribute('inert', '');
    const blockedCreate = loser.getByRole('button', { name: 'Create climb', exact: true });
    await blockedCreate.evaluate((element) => (element as HTMLElement).focus());
    await expect(blockedCreate).not.toBeFocused();
    await expect(newcomer.getByRole('button', { name: 'Create climb', exact: true })).toHaveCount(
      0,
    );
    expect((await waitForDraft(winner, 'Concurrent update climb')).id).toBe(saved.id);

    // Only an explicit action may admit either old JavaScript tab after its
    // controller changed; both then reopen the same saved record under C.
    for (const page of [loser, newcomer]) {
      await updateControl(page)
        .getByRole('button', { name: 'Reload to continue', exact: true })
        .click();
      await expect(page.locator('meta[name="cruxcontrol-build-generation"]')).toHaveAttribute(
        'content',
        'C',
      );
      await expect(page.getByRole('heading', { name: 'My Climbs' })).toBeVisible();
      expect((await waitForDraft(page, 'Concurrent update climb')).id).toBe(saved.id);
    }
  } finally {
    server.releaseActivation();
    await context.close();
  }
});
