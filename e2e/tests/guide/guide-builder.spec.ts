import { test, expect, type TestInfo } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type Unit = { name: string; file: string; slug: string };
type RecorderModule = {
  discoverWorkflowUnits: (root?: string) => Unit[];
  computeUnitFingerprint: (unit: Unit, options: { root: string; revision?: string }) => string;
};
type BuilderModule = {
  buildGuideSite: (options: { root: string; input: string; output: string; wantGif?: boolean; ffmpeg?: string | null }) => { output: string; guides: any[] };
};

const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
const E2E_ROOT = path.resolve(__dirname, '../../..');
const ORIGINAL_GUIDE_APP_REVISION = process.env.GUIDE_APP_REVISION;

test.beforeAll(() => {
  process.env.GUIDE_APP_REVISION = 'test-revision';
});

test.afterAll(() => {
  if (ORIGINAL_GUIDE_APP_REVISION === undefined) delete process.env.GUIDE_APP_REVISION;
  else process.env.GUIDE_APP_REVISION = ORIGINAL_GUIDE_APP_REVISION;
});

async function modules(): Promise<{ recorder: RecorderModule; builder: BuilderModule }> {
  const recorder = await dynamicImport(pathToFileURL(path.join(E2E_ROOT, 'scripts', 'record-guides.mjs')).href);
  const builder = await dynamicImport(pathToFileURL(path.join(E2E_ROOT, 'scripts', 'build-guides.mjs')).href);
  return { recorder, builder };
}

function createRoot(testInfo: TestInfo, definitions: Array<{ file: string; slug: string; audience?: string }>) {
  const root = testInfo.outputPath('app');
  mkdirSync(path.join(root, 'e2e', 'journeys'), { recursive: true });
  mkdirSync(path.join(root, 'e2e', 'guide'), { recursive: true });
  writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}');
  writeFileSync(path.join(root, 'e2e', 'guide', 'recorder.ts'), 'export const version = 1;');
  writeFileSync(path.join(root, 'e2e', 'guide', 'site.css'), readFileSync(path.join(E2E_ROOT, 'e2e', 'guide', 'site.css')));
  writeFileSync(path.join(root, 'guide.config.json'), JSON.stringify({
    productName: 'Example Product',
    siteName: 'Example Guides',
    siteDescription: 'Synthetic walkthroughs.',
    stagingDirectory: '.guide-work',
    outputDirectory: 'guides-site',
    publicationBasePath: '/docs/',
  }));
  for (const definition of definitions) {
    writeFileSync(path.join(root, 'e2e', 'journeys', definition.file), `test('Guide', async () => { guide.describe({ slug: '${definition.slug}' }); });`);
  }
  return { root, input: path.join(root, '.guide-work', 'test-run'), output: path.join(root, 'guides-site') };
}

async function checkpoint(root: string, input: string, definition: { file: string; slug: string; audience?: string }, overrides: Record<string, unknown> = {}) {
  const { recorder } = await modules();
  const unit = recorder.discoverWorkflowUnits(root).find((item) => item.slug === definition.slug)!;
  const directory = path.join(input, definition.slug);
  mkdirSync(directory, { recursive: true });
  const screenshot = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAYAAAA/xl1SAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAG4SURBVHhe7dJBaQMAEATAuoiViqn9fEsdpAY2C4GF+8xjHMzX3+/zBVcE5JSAnBKQUwJySkBOCcgpATklIKcE5JSAnBKQUx8HfPx8w1vpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UwjIFPpTCMgU+lMIyBT6UzzcUBYEpBTAnJKQE4JyCkBOSUgpwTklICcEpBTAnJKQA49X/8qff8I2ZYdAgAAAABJRU5ErkJggg==', 'base64');
  writeFileSync(path.join(directory, '01-open.png'), screenshot);
  writeFileSync(path.join(directory, 'walkthrough.webm'), 'webm');
  const manifest = {
    schemaVersion: 1,
    generatorVersion: '1.0.0',
    fingerprint: recorder.computeUnitFingerprint(unit, { root, revision: 'test-revision' }),
    slug: definition.slug,
    title: `Guide ${definition.slug}`,
    description: 'A synthetic guide description.',
    audience: definition.audience || 'Everyone',
    tags: ['synthetic'],
    project: 'guides',
    specFile: `e2e/journeys/${definition.file}`,
    sourceRevision: 'test-revision',
    startedAt: '2026-09-21T12:00:00.000Z',
    finishedAt: '2026-09-21T12:00:03.000Z',
    durationMs: 3000,
    viewport: { width: 1440, height: 900 },
    outputDir: '.',
    videoPath: 'walkthrough.webm',
    steps: [{ index: 1, title: 'Open <safe>', note: 'Review & continue.', screenshot: '01-open.png', url: 'https://example.test/', startedAt: '2026-09-21T12:00:01.000Z', durationMs: 1200 }],
    status: 'passed',
    publishable: true,
    validationErrors: [],
    ...overrides,
  };
  writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return directory;
}

test.describe('guide site builder', () => {
  test('builds one normalized Markdown, HTML, JSON, VTT, screenshot, and WebM site', async ({}, testInfo) => {
    const definitions = [
      { file: 'buyer.workflow.ts', slug: 'buyer-guide', audience: 'Buyers' },
      { file: 'admin.workflow.ts', slug: 'admin-guide', audience: 'Admins' },
    ];
    const paths = createRoot(testInfo, definitions);
    for (const definition of definitions) await checkpoint(paths.root, paths.input, definition);
    const { builder } = await modules();

    const result = builder.buildGuideSite({ ...paths, ffmpeg: null });

    expect(result.guides.map((guide) => guide.slug)).toEqual(['admin-guide', 'buyer-guide']);
    const index = readFileSync(path.join(paths.output, 'README.md'), 'utf8');
    expect(index).toContain('## Admins');
    expect(index).toContain('## Buyers');
    const json = JSON.parse(readFileSync(path.join(paths.output, 'guides.json'), 'utf8'));
    expect(json.schemaVersion).toBe(1);
    expect(json.sourceRevision).toBe('test-revision');
    expect(json.basePath).toBe('/docs/');
    expect(json.guides.map((guide: any) => guide.path)).toEqual(['admin-guide/index.html', 'buyer-guide/index.html']);
    const guide = path.join(paths.output, 'buyer-guide');
    expect(readFileSync(path.join(guide, 'README.md'), 'utf8')).toContain('Open &lt;safe&gt;');
    expect(readFileSync(path.join(guide, 'index.html'), 'utf8')).toContain('<video controls');
    expect(readFileSync(path.join(guide, 'index.html'), 'utf8')).toContain('Open &lt;safe&gt;');
    expect(readFileSync(path.join(guide, 'captions.vtt'), 'utf8')).toContain('00:00:01.000 --> 00:00:02.200');
    expect(existsSync(path.join(guide, '01-open.png'))).toBe(true);
    expect(existsSync(path.join(guide, 'walkthrough.webm'))).toBe(true);
    expect(existsSync(path.join(guide, 'manifest.json'))).toBe(false);
  });

  test('keeps WebM when ffmpeg is absent and omits optional formats', async ({}, testInfo) => {
    const definition = { file: 'one.workflow.ts', slug: 'one-guide' };
    const paths = createRoot(testInfo, [definition]);
    await checkpoint(paths.root, paths.input, definition);
    const { builder } = await modules();

    builder.buildGuideSite({ ...paths, ffmpeg: null, wantGif: true });

    expect(existsSync(path.join(paths.output, definition.slug, 'walkthrough.webm'))).toBe(true);
    expect(existsSync(path.join(paths.output, definition.slug, 'walkthrough.mp4'))).toBe(false);
    expect(existsSync(path.join(paths.output, definition.slug, 'preview.gif'))).toBe(false);
  });

  test('atomically replaces stale publish output after validation', async ({}, testInfo) => {
    const definition = { file: 'one.workflow.ts', slug: 'one-guide' };
    const paths = createRoot(testInfo, [definition]);
    await checkpoint(paths.root, paths.input, definition);
    mkdirSync(path.join(paths.output, 'removed-guide'), { recursive: true });
    writeFileSync(path.join(paths.output, 'removed-guide', 'stale.txt'), 'stale');
    const { builder } = await modules();

    builder.buildGuideSite({ ...paths, ffmpeg: null });

    expect(existsSync(path.join(paths.output, 'removed-guide'))).toBe(false);
    expect(existsSync(path.join(paths.output, 'one-guide', 'index.html'))).toBe(true);
  });

  test('rejects missing and extra checkpoint inventory', async ({}, testInfo) => {
    const definitions = [{ file: 'one.workflow.ts', slug: 'one-guide' }];
    const paths = createRoot(testInfo, definitions);
    mkdirSync(path.join(paths.input, 'extra-guide'), { recursive: true });
    const { builder } = await modules();

    expect(() => builder.buildGuideSite({ ...paths, ffmpeg: null })).toThrow(/missing: one-guide; extra: extra-guide/);
  });

  test('rejects empty workflow inventories', async ({}, testInfo) => {
    const paths = createRoot(testInfo, []);
    mkdirSync(paths.input, { recursive: true });
    const { builder } = await modules();

    expect(() => builder.buildGuideSite({ ...paths, ffmpeg: null })).toThrow(/expects no guides/);
  });

  for (const [label, overrides, expected] of [
    ['failed status', { status: 'failed' }, /recording status must be passed/],
    ['non-publishable status', { publishable: false }, /manifest is not publishable/],
    ['empty steps', { steps: [] }, /at least one step is required/],
    ['missing metadata', { description: '' }, /description is required/],
    ['unsafe slug', { slug: '../escape' }, /slug is invalid/],
  ] as const) {
    test(`rejects ${label}`, async ({}, testInfo) => {
      const definition = { file: 'one.workflow.ts', slug: 'one-guide' };
      const paths = createRoot(testInfo, [definition]);
      await checkpoint(paths.root, paths.input, definition, overrides);
      const { builder } = await modules();

      expect(() => builder.buildGuideSite({ ...paths, ffmpeg: null })).toThrow(expected);
    });
  }

  test('rejects missing and escaping screenshot references', async ({}, testInfo) => {
    const definition = { file: 'one.workflow.ts', slug: 'one-guide' };
    const paths = createRoot(testInfo, [definition]);
    const step = { index: 1, title: 'Unsafe', screenshot: '../outside.png', startedAt: '2026-09-21T12:00:01.000Z', durationMs: 1000 };
    await checkpoint(paths.root, paths.input, definition, { steps: [step] });
    const { builder } = await modules();

    expect(() => builder.buildGuideSite({ ...paths, ffmpeg: null })).toThrow(/unsafe screenshot path/);
  });

  test('rejects duplicate workflow slugs before reading checkpoints', async ({}, testInfo) => {
    const definitions = [
      { file: 'one.workflow.ts', slug: 'same-guide' },
      { file: 'two.workflow.ts', slug: 'same-guide' },
    ];
    const paths = createRoot(testInfo, definitions);
    mkdirSync(paths.input, { recursive: true });
    const { builder } = await modules();

    expect(() => builder.buildGuideSite({ ...paths, ffmpeg: null })).toThrow(/duplicate workflow slug: same-guide/);
  });

  test('leaves the previous validated site intact when a build fails', async ({}, testInfo) => {
    const definition = { file: 'one.workflow.ts', slug: 'one-guide' };
    const paths = createRoot(testInfo, [definition]);
    mkdirSync(paths.output, { recursive: true });
    writeFileSync(path.join(paths.output, 'marker.txt'), 'previous');
    await checkpoint(paths.root, paths.input, definition, { publishable: false });
    const { builder } = await modules();

    expect(() => builder.buildGuideSite({ ...paths, ffmpeg: null })).toThrow();
    expect(readFileSync(path.join(paths.output, 'marker.txt'), 'utf8')).toBe('previous');
  });

  test('restores an interrupted publish backup before validating a new build', async ({}, testInfo) => {
    const definition = { file: 'one.workflow.ts', slug: 'one-guide' };
    const paths = createRoot(testInfo, [definition]);
    mkdirSync(paths.output, { recursive: true });
    writeFileSync(path.join(paths.output, 'marker.txt'), 'previous');
    const backup = path.join(path.dirname(paths.output), `.${path.basename(paths.output)}.previous`);
    renameSync(paths.output, backup);
    await checkpoint(paths.root, paths.input, definition, { publishable: false });
    const { builder } = await modules();

    expect(() => builder.buildGuideSite({ ...paths, ffmpeg: null })).toThrow();
    expect(readFileSync(path.join(paths.output, 'marker.txt'), 'utf8')).toBe('previous');
    expect(existsSync(backup)).toBe(false);
  });
});
