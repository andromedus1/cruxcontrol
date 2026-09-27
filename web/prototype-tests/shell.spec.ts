import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixturePath = fileURLToPath(
  new URL('../../prototypes/ios/fixtures/synthetic-library.json', import.meta.url),
);
type TestWindow = Window & { workerRegistrationAttempts: number };

test('packaged assets restore the synthetic library without registering a worker', async ({ page }) => {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // Detect attempts as well as successful registrations: a missing sw.js must
  // not hide a broken packaged startup behind a failed registration.
  await page.addInitScript(() => {
    const testWindow = window as TestWindow;
    testWindow.workerRegistrationAttempts = 0;
    navigator.serviceWorker.register = () => {
      testWindow.workerRegistrationAttempts += 1;
      throw new Error('Packaged startup attempted service-worker registration');
    };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Create climb' })).toBeVisible();
  expect(await page.evaluate(() => (window as TestWindow).workerRegistrationAttempts)).toBe(0);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back up & restore' }).click();
  await page.locator('#library-backup-file').setInputFiles(fixturePath);
  await page.getByRole('button', { name: 'Add 4 climbs & 2 playlists' }).click();
  await expect(page.getByRole('heading', { name: 'Recovery complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: /Prototype finish A/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Prototype finish B/ })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Back up & restore' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download library backup' }).click();
  const file = await (await downloaded).path();
  if (!file) throw new Error('Backup did not produce a file');
  const exported = JSON.parse(await readFile(file, 'utf8'));
  // Match full authored records, recipes and ordered entries, not just counts.
  expect(exported.drafts).toEqual(expect.arrayContaining(fixture.drafts));
  expect(exported.drafts).toHaveLength(fixture.drafts.length);
  expect(exported.playlists).toEqual(expect.arrayContaining(fixture.playlists));
  expect(exported.playlists).toHaveLength(fixture.playlists.length);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBe(0);
  expect(await page.evaluate(() => (window as TestWindow).workerRegistrationAttempts)).toBe(0);
  expect(pageErrors).toEqual([]);
});
