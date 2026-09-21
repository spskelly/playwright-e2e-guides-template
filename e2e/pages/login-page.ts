import type { Page } from '@playwright/test';

export class LoginPage {
  constructor(
    private readonly page: Page,
    private readonly appUrl: string,
  ) {}

  async open(): Promise<void> {
    await this.page.goto(this.appUrl + '/login');
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }

  get error() {
    return this.page.getByRole('alert');
  }
}
