import { expect, test } from '@playwright/test';

test('creates, colors, saves, and reopens a local Fullride draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create your first climb' }).click();
  await page.getByLabel('Name').fill('Tidal Wave');
  await page.getByRole('radio', { name: /Advanced Light/ }).click();
  await page.getByLabel('red channel').fill('7');
  await page.getByLabel('green channel').fill('3');
  await page.getByLabel('blue channel').fill('2');
  await page.getByRole('button', { name: /^Hold 1,/ }).click();
  await page.getByRole('button', { name: 'Save now' }).click();
  await expect(page.locator('.save-chip')).toHaveText('saved');

  await page.reload();
  await expect(page.getByRole('button', { name: /Tidal Wave/ })).toBeVisible();
  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  await page.getByRole('button', { name: 'Edit climb' }).click();
  await expect(page.getByRole('heading', { name: 'Tidal Wave' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Hold 1, Custom/ })).toBeVisible();
});
