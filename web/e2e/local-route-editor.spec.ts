import { expect, test } from '@playwright/test';

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

test('persists one climb through Draft, Finished, Trash, restore, and reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create climb' }).click();
  await page.getByLabel('Name').fill('Tidal Wave');
  await page.getByRole('button', { name: /^Hold 1, Unselected/ }).click();
  await page.getByRole('radio', { name: /Advanced Light/ }).click();
  await page.getByLabel('red channel').fill('7');
  await page.getByLabel('green channel').fill('3');
  await page.getByLabel('blue channel').fill('2');
  await page.getByRole('button', { name: /^Hold 2,/ }).click();
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
  await page.getByRole('button', { name: 'Restore' }).click();

  await page.getByRole('button', { name: /My Climbs.*1 climb/ }).click();
  await expect(page.getByRole('button', { name: /Tidal Wave/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Tidal Wave/ })).toBeVisible();

  const [restored] = await readStoredClimbs(page);
  expect(restored).toMatchObject({
    schemaVersion: 3,
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
