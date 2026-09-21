import { test, expect } from '../../fixture';
import { DashboardPage, LoginPage } from '../../pages';
import { SYNTHETIC_USER } from '../../app/mock-api';

test('a synthetic user signs in and creates a task', async ({ page, appUrl }) => {
  const login = new LoginPage(page, appUrl);
  await login.open();
  await login.signIn(SYNTHETIC_USER.email, SYNTHETIC_USER.password);
  const dashboard = new DashboardPage(page);
  await expect(dashboard.heading).toBeVisible();
  await dashboard.addTask('Publish the synthetic guide');
  await expect(dashboard.tasks).toContainText('Publish the synthetic guide');
});
