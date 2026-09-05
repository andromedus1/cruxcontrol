import { expect, test } from '@playwright/test';

async function clickBoardHold(page: import('@playwright/test').Page, number: number) {
  const hold = page.getByRole('button', { name: new RegExp(`^Hold ${number},`) });
  // Pointer selection belongs to the SVG's coordinate hit test. With raster
  // artwork loaded, the hold's transparent shapes intentionally don't catch clicks.
  await hold.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const bounds = await hold.boundingBox();
  if (!bounds) throw new Error(`Hold ${number} has no visible bounds`);
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(hold).not.toHaveAttribute('data-assignment', 'none');
}

async function readStoredClimbs(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('cruxcontrol-local-drafts', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('drafts').objectStore('drafts').getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            resolve(request.result as Record<string, unknown>[]);
            open.result.close();
          };
        };
      }),
  );
}

async function readStoredPlaylists(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('cruxcontrol-local-playlists', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('playlists').objectStore('playlists').getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            resolve(request.result as Record<string, unknown>[]);
            open.result.close();
          };
        };
      }),
  );
}

async function createFinishedClimb(
  page: import('@playwright/test').Page,
  name: string,
  hold: number,
) {
  await page.getByRole('button', { name: 'Create climb' }).click();
  await page.getByLabel('Name').fill(name);
  await clickBoardHold(page, hold);
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Mark finished' }).click();
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Back' }).click();
}

test('persists one climb through Draft, Finished, Trash, restore, and reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create climb' }).click();
  await page.getByLabel('Name').fill('Tidal Wave');
  await clickBoardHold(page, 1);
  await page.getByRole('radio', { name: /Advanced Light/ }).click();
  await page.getByLabel('red channel').fill('7');
  await page.getByLabel('green channel').fill('3');
  await page.getByLabel('blue channel').fill('2');
  await clickBoardHold(page, 2);
  await expect(page.locator('.save-chip')).toHaveText('saved');

  const [draft] = await readStoredClimbs(page);
  expect(draft).toMatchObject({ status: 'draft', name: 'Tidal Wave' });
  const localId = draft!.id;

  await page.getByRole('button', { name: 'Mark finished' }).click();
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'My Climbs' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tidal Wave/ })).toBeVisible();

  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Move to trash' }).click();
  await page.getByRole('button', { name: /Trash.*1 climb/ }).click();
  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();

  await page.getByRole('button', { name: /My Climbs.*1 climb/ }).click();
  await expect(page.getByRole('button', { name: /Tidal Wave/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Tidal Wave/ })).toBeVisible();

  const [restored] = await readStoredClimbs(page);
  expect(restored).toMatchObject({
    schemaVersion: 4,
    id: localId,
    status: 'finished',
    name: 'Tidal Wave',
  });
  expect(restored).not.toHaveProperty('trashedAt');
  expect(restored!.assignments).toHaveLength(2);
});

test('keeps the complete editor and persistent actions usable on a phone viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create climb' }).click();
  await expect(page.locator('.board-renderer__viewport')).toHaveAttribute('data-scale', '1');
  await expect(page.getByRole('button', { name: 'Mark finished' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect & light' })).toBeVisible();
  await page.getByRole('button', { name: /^Hold 1, Unselected/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Hold 1, Start/ })).toBeVisible();
  await expect(page.locator('.editor-actions')).toHaveCSS('position', 'fixed');
});

test('persists multi-list membership, manual order, and Trash-safe resolution', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await createFinishedClimb(page, 'Tidal Wave', 1);
  await createFinishedClimb(page, 'Moon Arete', 2);

  await page.getByRole('button', { name: /Lists.*0 lists/ }).click();
  await page.getByLabel('New list').fill('Projects');
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('button', { name: /Projects.*0 climbs/ })).toBeVisible();
  await page.getByLabel('New list').fill('Warmups');
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('button', { name: /Warmups.*0 climbs/ })).toBeVisible();

  await page.getByRole('button', { name: /My Climbs.*2 climbs/ }).click();
  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  await page.getByRole('button', { name: 'Add to lists' }).click();
  await page.getByRole('checkbox', { name: 'Projects' }).check();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' }).first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Warmups' }).check();
  await expect(page.getByRole('checkbox', { name: 'Warmups' })).toBeChecked();
  await page.getByRole('button', { name: 'Close lists' }).click();

  await page.getByRole('button', { name: /Moon Arete/ }).click();
  await page.getByRole('button', { name: 'Add to lists' }).click();
  await page.getByRole('checkbox', { name: 'Projects' }).check();
  await expect(page.getByRole('checkbox', { name: 'Projects' })).toBeChecked();
  await page.getByRole('button', { name: 'Close lists' }).click();

  await page.getByRole('button', { name: /Lists.*2 lists/ }).click();
  await page.getByRole('button', { name: /Projects.*2 climbs/ }).click();
  await page.getByRole('button', { name: 'Move up Moon Arete' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await expect(page.locator('.playlist-entries li strong')).toHaveText([
    'Moon Arete',
    'Tidal Wave',
  ]);

  const [projectsBeforeTrash] = (await readStoredPlaylists(page)).filter(
    (value) => value.name === 'Projects',
  );
  const referencesBeforeTrash = projectsBeforeTrash!.entries;

  await page.getByRole('button', { name: /My Climbs.*2 climbs/ }).click();
  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Move to trash' }).click();
  await page.getByRole('button', { name: /Lists.*2 lists/ }).click();
  await page.getByRole('button', { name: /Projects.*2 climbs/ }).click();
  const unavailable = page.locator('.playlist-entries li').filter({ hasText: 'Tidal Wave' });
  await expect(unavailable.getByText('In Trash')).toBeVisible();
  await expect(unavailable.getByRole('button', { name: 'View Tidal Wave' })).toBeDisabled();
  const [projectsInTrash] = (await readStoredPlaylists(page)).filter(
    (value) => value.name === 'Projects',
  );
  expect(projectsInTrash!.entries).toEqual(referencesBeforeTrash);

  await page.getByRole('button', { name: /Trash.*1 climb/ }).click();
  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByRole('button', { name: /My Climbs.*2 climbs/ })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Lists.*2 lists/ }).click();
  await page.getByRole('button', { name: /Projects.*2 climbs/ }).click();
  await expect(page.locator('.playlist-entries li strong')).toHaveText([
    'Moon Arete',
    'Tidal Wave',
  ]);
  const restored = page.locator('.playlist-entries li').filter({ hasText: 'Tidal Wave' });
  await expect(restored.getByText('Available')).toBeVisible();
  await expect(restored.getByRole('button', { name: 'View Tidal Wave' })).toBeEnabled();
  const [projectsAfterRestore] = (await readStoredPlaylists(page)).filter(
    (value) => value.name === 'Projects',
  );
  expect(projectsAfterRestore!.entries).toEqual(referencesBeforeTrash);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Play list' }).click();
  await expect(page.getByText('1 of 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moon Arete' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Light this climb' })).toBeDisabled();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('2 of 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tidal Wave' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const [projectsDuringPlay] = (await readStoredPlaylists(page)).filter(
    (value) => value.name === 'Projects',
  );
  expect(projectsDuringPlay!.entries).toEqual(referencesBeforeTrash);
  expect(
    Object.keys(projectsDuringPlay!).some((key) => /position|session|playing|current/i.test(key)),
  ).toBe(false);

  await page.reload();
  await page.getByRole('button', { name: /Lists.*2 lists/ }).click();
  await page.getByRole('button', { name: /Projects.*2 climbs/ }).click();
  await page.getByRole('button', { name: 'Play list' }).click();
  await expect(page.getByText('1 of 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moon Arete' })).toBeVisible();
});

test('exports and imports a two-climb list as fresh persistent local copies', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await createFinishedClimb(page, 'Tidal Wave', 1);
  await createFinishedClimb(page, 'Moon Arete', 2);

  await page.getByRole('button', { name: /Lists.*0 lists/ }).click();
  await page.getByLabel('New list').fill('Portable projects');
  await page.getByRole('button', { name: 'Create list' }).click();

  await page.getByRole('button', { name: /My Climbs.*2 climbs/ }).click();
  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  await page.getByRole('button', { name: 'Add to lists' }).click();
  await page.getByRole('checkbox', { name: 'Portable projects' }).check();
  await expect(page.getByRole('checkbox', { name: 'Portable projects' })).toBeChecked();
  await page.getByRole('button', { name: 'Close lists' }).click();

  await page.getByRole('button', { name: /Moon Arete/ }).click();
  await page.getByRole('button', { name: 'Add to lists' }).click();
  await page.getByRole('checkbox', { name: 'Portable projects' }).check();
  await expect(page.getByRole('checkbox', { name: 'Portable projects' })).toBeChecked();
  await page.getByRole('button', { name: 'Close lists' }).click();

  await page.getByRole('button', { name: /Lists.*1 list/ }).click();
  await page.getByRole('button', { name: /Portable projects.*2 climbs/ }).click();
  const climbsBefore = await readStoredClimbs(page);
  const [sourcePlaylist] = (await readStoredPlaylists(page)).filter(
    ({ name }) => name === 'Portable projects',
  );
  expect(sourcePlaylist).toBeDefined();

  await page.getByRole('button', { name: 'Share list' }).click();
  await expect(page.getByRole('heading', { name: 'Share list' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download file' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Portable projects.cruxplaylist.json');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  await page.getByRole('button', { name: 'Close sharing' }).click();

  await page.getByRole('button', { name: 'Import list' }).click();
  await page.getByLabel('Playlist file').setInputFiles(downloadPath!);
  await expect(page.getByRole('heading', { name: 'Portable projects' })).toBeVisible();
  await expect(page.getByText('New local climb copies').locator('..')).toContainText('2');
  expect(await readStoredClimbs(page)).toHaveLength(2);
  expect(await readStoredPlaylists(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'Import as new list' }).click();
  await expect(page.getByRole('button', { name: /Portable projects.*2 climbs/ })).toHaveCount(2);

  const climbsAfter = await readStoredClimbs(page);
  const playlistsAfter = (await readStoredPlaylists(page)).filter(
    ({ name }) => name === 'Portable projects',
  );
  expect(climbsAfter).toHaveLength(4);
  expect(playlistsAfter).toHaveLength(2);
  const importedPlaylist = playlistsAfter.find(({ id }) => id !== sourcePlaylist!.id)!;
  const originalIds = (sourcePlaylist!.entries as { kind: string; id: string }[]).map(
    ({ id }) => id,
  );
  const importedIds = (importedPlaylist.entries as { kind: string; id: string }[]).map(
    ({ id }) => id,
  );
  expect(importedIds).toHaveLength(2);
  expect(importedIds.every((id) => !originalIds.includes(id))).toBe(true);
  const climbsById = new Map(climbsAfter.map((climb) => [climb.id, climb]));
  const originalById = new Map(climbsBefore.map((climb) => [climb.id, climb]));
  expect(importedIds.map((id) => climbsById.get(id)?.name)).toEqual(
    originalIds.map((id) => originalById.get(id)?.name),
  );
  expect(importedIds.map((id) => climbsById.get(id)?.status)).toEqual(
    originalIds.map((id) => originalById.get(id)?.status),
  );
  expect(importedIds.map((id) => climbsById.get(id)?.assignments)).toEqual(
    originalIds.map((id) => originalById.get(id)?.assignments),
  );

  await page.reload();
  await page.getByRole('button', { name: /Lists.*2 lists/ }).click();
  await expect(page.getByRole('button', { name: /Portable projects.*2 climbs/ })).toHaveCount(2);
  expect(
    (await readStoredPlaylists(page)).filter(({ name }) => name === 'Portable projects'),
  ).toHaveLength(2);
});
