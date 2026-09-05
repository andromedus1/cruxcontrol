import { expect, test } from '@playwright/test';

test('keeps the session screen-awake choice through editor and list navigation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        async request() {
          const lock = new EventTarget() as EventTarget & { released: boolean; release(): Promise<void> };
          lock.released = false;
          lock.release = async () => {
            lock.released = true;
            lock.dispatchEvent(new Event('release'));
          };
          return lock;
        },
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('checkbox', { name: 'Keep screen awake' });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(page.getByText(/^Screen awake\./)).toBeVisible();

  await page.getByRole('button', { name: 'Create climb' }).click();
  await expect(toggle).toBeChecked();
  await page.getByLabel('Name', { exact: true }).fill('Screen-awake session');
  await expect(page.locator('.save-chip')).toHaveText('saved');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: /Lists.*0 lists/ }).click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText(/^Screen awake\./)).toBeVisible();

  await toggle.uncheck();
  await expect(page.getByText(/^Prevent automatic screen timeout/)).toBeVisible();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await page.getByRole('button', { name: /Drafts.*1 climb/ }).click();
  await expect(page.getByRole('button', { name: /Screen-awake session/ })).toBeVisible();
});
