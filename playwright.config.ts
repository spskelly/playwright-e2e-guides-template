import { defineConfig, devices } from '@playwright/test';
import type { GuideOptions } from './e2e/guide/fixture';

const guideMode = process.env.GUIDE_CAPTIONS !== '0';

export default defineConfig<GuideOptions>({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'contracts',
      testDir: './e2e/tests/guide',
      testMatch: '**/*.spec.ts',
    },
    {
      name: 'example-app',
      testDir: './e2e/tests/app',
      testMatch: '**/*.spec.ts',
    },
    {
      name: 'journeys',
      testDir: './e2e/journeys',
      testMatch: '**/*.workflow.ts',
      use: {
        guideMode: false,
        video: 'off',
      },
    },
    {
      name: 'guides',
      testDir: './e2e/journeys',
      testMatch: '**/*.workflow.ts',
      fullyParallel: false,
      workers: 1,
      use: {
        guideMode,
        video: 'on',
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          slowMo: Number(process.env.GUIDE_SLOWMO || 250),
        },
      },
    },
  ],
});
