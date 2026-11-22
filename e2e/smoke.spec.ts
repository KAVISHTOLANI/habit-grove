import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('create a habit, check in, view history and stats', async ({ page }) => {
  await page.goto('./');
  await snap(page, 'landing');
  await page.getByRole('link', { name: 'Create a habit' }).click();
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.getByText(/Name the habit/)).toBeVisible();
  await page.getByLabel('Habit name').fill('Read 10 pages');
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.getByText(/Created “Read 10 pages”/)).toBeVisible();

  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Check in Read 10 pages' }).click();
  await expect(page.getByTestId('today-summary')).toHaveText('1 of 1 habits done today');
  await expect(page.getByText('1 day streak')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('today-summary')).toHaveText('1 of 1 habits done today');

  await page.getByRole('link', { name: 'Read 10 pages' }).click();
  await expect(page.getByRole('grid', { name: 'Check-in calendar' })).toBeVisible();
  await page.getByRole('link', { name: 'Weekly stats' }).click();
  await expect(page.getByTestId('week-rate')).toContainText('1 of 1');

  await page.getByRole('link', { name: 'Habits' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete Read 10 pages' }).click();
  await page.getByRole('button', { name: 'Load demo habits' }).click();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByTestId('today-summary')).toBeVisible();
  await snap(page, 'today');
  await checkMobile(page);
});
