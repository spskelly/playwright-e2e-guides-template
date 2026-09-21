import { test, expect } from '../fixture';
import { DashboardPage, LoginPage } from '../pages';
import { SYNTHETIC_USER } from '../app/mock-api';

test('Create a project task', async ({ page, appUrl, guide }) => {
  guide.describe({
    slug: 'create-project-task',
    title: 'Create a project task',
    description: 'Sign in to the synthetic workspace and add a task to the project list.',
    audience: 'Template evaluators',
    estimatedMinutes: 1,
    tags: ['synthetic', 'tasks'],
  });

  const login = new LoginPage(page, appUrl);
  const dashboard = new DashboardPage(page);

  await guide.step('Open the synthetic sign-in page', async () => {
    await login.open();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  }, { note: 'The example application runs locally and contains no real user data.' });

  await guide.step('Sign in with the example account', async () => {
    await guide.sensitive(async () => {
      await login.signIn(SYNTHETIC_USER.email, SYNTHETIC_USER.password);
    });
    await expect(dashboard.heading).toBeVisible();
  }, { note: 'Sensitive entry is hidden from the video and masked in screenshots.' });

  await guide.step('Add a task to the project', async () => {
    await dashboard.addTask('Publish the synthetic guide');
    await expect(dashboard.tasks).toContainText('Publish the synthetic guide');
  }, { note: 'Use stable labels and assert the user-visible outcome.' });
});
