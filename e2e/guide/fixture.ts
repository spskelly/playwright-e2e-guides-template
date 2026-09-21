import { test as base, expect } from '@playwright/test';
import { Guide } from './recorder';

export type GuideOptions = {
  guideMode: boolean;
};

export type GuideFixtures = {
  guide: Guide;
};

export const test = base.extend<GuideFixtures & GuideOptions>({
  guideMode: [false, { option: true }],

  guide: [
    async ({ page, guideMode }, use, testInfo) => {
      const guide = new Guide(page, testInfo, guideMode);
      await guide.install();
      await use(guide);
      await guide.finish(testInfo.status);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from '@playwright/test';
export type { Guide } from './recorder';
export type { GuideManifest, GuideMeta, GuideStepOptions, GuideStepRecord } from './manifest';
