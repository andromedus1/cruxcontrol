import { expect, test } from '@playwright/test';

test('keeps the supplied screenshot review usable at an Android phone viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Import Kilter screenshots' }).click();
  await page.getByRole('button', { name: 'Load supplied 16' }).click();

  await expect(page.getByText('Screenshot 1 of 16')).toBeVisible();
  await expect(page.getByLabel('Climb name')).toHaveValue('Figure 5-?');
  await expect(page.locator('.screenshot-import-board .board-renderer__viewport')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  expect(
    await page
      .locator('.screenshot-import-dialog')
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Screenshot 2 of 16')).toBeVisible();
  await expect(page.getByLabel('Climb name')).toHaveValue('Wake up, matt 4');
});
