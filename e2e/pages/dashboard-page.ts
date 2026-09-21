import type { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  get heading() {
    return this.page.getByRole('heading', { name: 'Project tasks' });
  }

  get tasks() {
    return this.page.getByRole('list', { name: 'Tasks' });
  }

  async addTask(title: string): Promise<void> {
    await this.page.getByLabel('New task').fill(title);
    await this.page.getByRole('button', { name: 'Add task' }).click();
  }
}
