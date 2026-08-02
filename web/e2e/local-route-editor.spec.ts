import { expect, test } from '@playwright/test';

test('autosaves, reloads, reopens, and edits semantic and custom hold state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create your first climb' }).click();
  await page.getByLabel('Name').fill('Tidal Wave');
  await page.getByRole('button', { name: /^Hold 1, Unselected/ }).click();
  await page.getByRole('radio', { name: /Advanced Light/ }).click();
  await page.getByLabel('red channel').fill('7');
  await page.getByLabel('green channel').fill('3');
  await page.getByLabel('blue channel').fill('2');
  await page.getByRole('button', { name: /^Hold 2,/ }).click();
  await expect(page.locator('.board-renderer__viewport')).toHaveAttribute('data-scale', '1');
  await expect(page.locator('.save-chip')).toHaveText('saved');

  await page.reload();
  await expect(page.getByRole('button', { name: /Tidal Wave/ })).toBeVisible();
  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  await page.getByRole('button', { name: 'Edit climb' }).click();
  await expect(page.getByRole('heading', { name: 'Tidal Wave' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Hold 1, Start/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Hold 2, Custom #FF6DAA$/ })).toBeVisible();

  await page.getByRole('radio', { name: /Finish/ }).click();
  await page.getByRole('button', { name: /^Hold 1, Start/ }).click();
  await page.getByRole('radio', { name: /Advanced Light/ }).click();
  await page.getByLabel('green channel').fill('6');
  await page.getByRole('button', { name: /^Hold 2, Custom/ }).click();
  await expect(page.locator('.save-chip')).toHaveText('saved');

  await page.reload();
  await page.getByRole('button', { name: /Tidal Wave/ }).click();
  await page.getByRole('button', { name: 'Edit climb' }).click();
  await expect(page.getByRole('button', { name: /^Hold 1, Finish/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Hold 2, Custom #24DBAA$/ })).toBeVisible();
});

test('keeps the complete editor and persistent actions usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create your first climb' }).click();
  await expect(page.locator('.board-renderer__viewport')).toHaveAttribute('data-scale', '2.5');
  await expect(page.getByRole('button', { name: 'Save now' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect & light' })).toBeVisible();
  await page.getByRole('button', { name: /^Hold 1, Unselected/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Hold 1, Start/ })).toBeVisible();
  await expect(page.locator('.editor-actions')).toHaveCSS('position', 'fixed');
});
