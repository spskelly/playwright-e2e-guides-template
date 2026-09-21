import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test as genericGuideTest } from '../../guide/fixture';
import { Guide, slugify } from '../../guide/recorder';
import { loadGuideConfig } from '../../guide/config';
import {
  GENERATOR_VERSION,
  GUIDE_SCHEMA_VERSION,
  normalizeRecordingStatus,
  resolvePathWithin,
  sanitizeGuideUrl,
  sourceRevisionFromEnvironment,
  validateGuideManifest,
  validateSlug,
  type GuideManifest,
} from '../../guide/manifest';

test.describe('guide core characterization', () => {
  test('slugify produces stable lowercase hyphenated slugs', () => {
    expect(slugify('  Your FIRST Project: 25+ Tasks!  ')).toBe('your-first-project-25-tasks');
    expect(slugify('Already---Separated')).toBe('already-separated');
  });

  test('slugify enforces the existing 80-character limit', () => {
    const slug = slugify('A'.repeat(120));

    expect(slug).toHaveLength(80);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  test('loads application-independent config with documented path and timing overrides', ({}, testInfo) => {
    const root = testInfo.outputPath('generic-app');
    mkdirSync(root, { recursive: true });
    const configPath = path.join(root, 'guide.config.json');
    writeFileSync(configPath, JSON.stringify({
      schemaVersion: 1,
      productName: 'Example Product',
      siteName: 'Example Guides',
      siteDescription: 'Synthetic walkthroughs.',
      outputDirectory: 'site-output',
      stagingDirectory: 'recordings',
      locale: 'en-US',
      captions: {
        background: 'rgba(17,24,39,0.92)',
        foreground: '#f9fafb',
        muted: '#d1d5db',
        accent: '#f59e0b',
        bottomPx: 28
      },
      strictRecordingDefault: false,
      allowedUrlQueryParameters: ['item'],
      defaultScreenshotMasks: ['input[type="password"]'],
      publicationBasePath: '/guides/'
    }));

    const config = loadGuideConfig({
      configPath,
      env: {
        GUIDES_OUT: 'overridden-output',
        GUIDE_WORK_DIR: 'overridden-work',
        GUIDE_STEP_PAUSE: '25',
        GUIDE_SLOWMO: '10',
        GUIDE_STRICT: '1',
        GUIDE_PRODUCT_NAME: 'must-not-override-brand',
      },
    });

    expect(config.productName).toBe('Example Product');
    expect(config.outputDirectory).toBe(path.join(root, 'overridden-output'));
    expect(config.stagingDirectory).toBe(path.join(root, 'overridden-work'));
    expect(config.stepPauseMs).toBe(25);
    expect(config.slowMoMs).toBe(10);
    expect(config.strictRecording).toBe(true);
    expect(config.publicationBasePath).toBe('/guides/');
  });

  test('defines a versioned recording contract and normalizes Playwright statuses', () => {
    expect(GUIDE_SCHEMA_VERSION).toBe(1);
    expect(GENERATOR_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(normalizeRecordingStatus('passed')).toBe('passed');
    expect(normalizeRecordingStatus('timedOut')).toBe('timedOut');
    expect(normalizeRecordingStatus(undefined)).toBe('unknown');
    expect(normalizeRecordingStatus('unexpected')).toBe('unknown');
  });

  test('reads source revision only from documented CI variables', () => {
    expect(sourceRevisionFromEnvironment({ GUIDE_APP_REVISION: 'guide-revision', GITHUB_SHA: 'github-revision' })).toBe('guide-revision');
    expect(sourceRevisionFromEnvironment({ GITHUB_SHA: 'github-revision', GIT_COMMIT: 'generic-revision' })).toBe('github-revision');
    expect(sourceRevisionFromEnvironment({ GIT_COMMIT: 'generic-revision' })).toBe('generic-revision');
    expect(sourceRevisionFromEnvironment({})).toBeUndefined();
  });

  test('exports a standalone Playwright fixture without application composition', () => {
    expect(typeof genericGuideTest.extend).toBe('function');
  });

  test('accepts only portable slugs within the configured length limit', () => {
    expect(validateSlug('project-deep-dive')).toBe('project-deep-dive');
    for (const slug of ['', 'nested/slug', 'two..dots', '../escape', 'C:\\absolute', 'Upper_Case', 'a'.repeat(81)]) {
      expect(() => validateSlug(slug)).toThrow(/slug/i);
    }
  });

  test('keeps resolved paths below their configured root', ({}, testInfo) => {
    const root = testInfo.outputPath('root');
    expect(resolvePathWithin(root, 'guide', 'manifest.json')).toBe(path.join(root, 'guide', 'manifest.json'));
    expect(() => resolvePathWithin(root, '..', 'outside.json')).toThrow(/outside configured root/i);
    expect(() => resolvePathWithin(root, path.parse(root).root, 'outside.json')).toThrow(/outside configured root/i);
  });

  test('removes fragments, credentials, and unapproved URL parameters', () => {
    expect(
      sanitizeGuideUrl('https://user:secret@example.test/dashboard?token=secret&view=tasks&mode=review#private', ['view', 'mode']),
    ).toBe('https://example.test/dashboard?view=tasks&mode=review');
    expect(sanitizeGuideUrl('not a url', [])).toBe('');
  });

  test('validates publishable status, metadata, steps, and screenshots', ({}, testInfo) => {
    const guideDir = testInfo.outputPath('guide');
    mkdirSync(guideDir, { recursive: true });
    writeFileSync(path.join(guideDir, '01-open.png'), 'png fixture');
    const manifest: GuideManifest = {
      schemaVersion: 1,
      generatorVersion: '1.0.0',
      slug: 'safe-guide',
      title: 'Safe guide',
      description: 'A complete synthetic guide.',
      audience: 'Test users',
      tags: ['testing'],
      project: 'guides',
      specFile: 'e2e/journeys/safe.workflow.ts',
      startedAt: '2026-09-21T12:00:00.000Z',
      finishedAt: '2026-09-21T12:00:01.000Z',
      durationMs: 1000,
      viewport: { width: 1440, height: 900 },
      outputDir: '',
      steps: [{
        index: 1,
        title: 'Open the guide',
        screenshot: '01-open.png',
        url: 'https://example.test/dashboard',
        startedAt: '2026-09-21T12:00:00.000Z',
        durationMs: 1000,
      }],
      status: 'passed',
      publishable: false,
      validationErrors: [],
    };

    expect(validateGuideManifest(manifest, guideDir)).toEqual([]);
    expect(validateGuideManifest({ ...manifest, status: 'failed' }, guideDir)).toContain('recording status must be passed');
    expect(validateGuideManifest({ ...manifest, steps: [] }, guideDir)).toContain('at least one step is required');
    expect(validateGuideManifest({ ...manifest, description: '' }, guideDir)).toContain('description is required');
    expect(validateGuideManifest({ ...manifest, steps: [{ ...manifest.steps[0], screenshot: 'missing.png' }] }, guideDir))
      .toContain('step 1 screenshot does not exist: missing.png');
  });

  test('covers sensitive actions with an opaque video overlay and always clears it', async ({}, testInfo) => {
    const visibility: boolean[] = [];
    const page = {
      evaluate: async (_callback: unknown, visible: boolean) => {
        visibility.push(visible);
      },
    };
    const guide = new Guide(page as any, testInfo, true);

    await expect(guide.sensitive(async () => 'complete')).resolves.toBe('complete');
    expect(visibility).toEqual([true, false]);
  });
});
