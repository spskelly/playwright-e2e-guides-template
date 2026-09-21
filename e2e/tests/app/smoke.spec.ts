import { test, expect } from '../../fixture';

test.describe('synthetic application smoke', () => {
  test('home page links to sign in', async ({ page, appUrl }) => {
    await page.goto(appUrl);
    await expect(page.getByRole('heading', { name: 'Example Workspace' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open sign in' })).toHaveAttribute('href', '/login');
  });

  test('login page exposes labeled controls', async ({ page, appUrl }) => {
    await page.goto(appUrl + '/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password');
  });
});
