import { test, expect } from '../../fixture';
import { LoginPage } from '../../pages';

test.describe('synthetic failure paths', () => {
  test('invalid credentials return an actionable message', async ({ page, appUrl }) => {
    const login = new LoginPage(page, appUrl);
    await login.open();
    await login.signIn('wrong@example.test', 'not-the-password');
    await expect(login.error).toHaveText('Use the documented synthetic credentials.');
  });

  test('service failure remains on the login page', async ({ page, appUrl }) => {
    const login = new LoginPage(page, appUrl);
    await login.open();
    await login.signIn('unavailable@example.test', 'synthetic-password');
    await expect(login.error).toHaveText('The synthetic service is temporarily unavailable.');
    await expect(page).toHaveURL(/\/login$/);
  });
});
