import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type Unit = { name: string; file: string; slug: string };
type RecorderModule = {
  discoverWorkflowUnits: (root?: string) => Unit[];
  computeUnitFingerprint: (unit: Unit, options?: { root?: string; revision?: string }) => string;
  validateCheckpoint: (directory: string, fingerprint: string) => string[];
  replaceCheckpoint: (stagingRoot: string, temporaryDirectory: string, slug: string) => string;
};

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<RecorderModule>;

async function loadRecorder(): Promise<RecorderModule> {
  return dynamicImport(pathToFileURL(path.resolve(__dirname, '../../../scripts/record-guides.mjs')).href);
}

function createSyntheticRoot(root: string, workflows: Record<string, string>): void {
  mkdirSync(path.join(root, 'e2e', 'journeys'), { recursive: true });
  mkdirSync(path.join(root, 'e2e', 'guide'), { recursive: true });
  writeFileSync(path.join(root, 'guide.config.json'), JSON.stringify({ stagingDirectory: '.guide-work' }));
  writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}');
  writeFileSync(path.join(root, 'e2e', 'guide', 'recorder.ts'), 'export const version = 1;');
  for (const [name, source] of Object.entries(workflows)) {
    writeFileSync(path.join(root, 'e2e', 'journeys', name), source);
  }
}

test.describe('guide recording orchestration', () => {
  test('discovers one declared guide per workflow file in stable order', async ({}, testInfo) => {
    const root = testInfo.outputPath('app');
    createSyntheticRoot(root, {
      'z-last.workflow.ts': "test('Last', async () => { guide.describe({ slug: 'last-guide' }); });",
      'a-first.workflow.ts': "test('First', async () => { guide.describe({ slug: 'first-guide' }); });",
    });
    const recorder = await loadRecorder();

    expect(recorder.discoverWorkflowUnits(root).map(({ name, slug }) => ({ name, slug }))).toEqual([
      { name: 'a-first.workflow.ts', slug: 'first-guide' },
      { name: 'z-last.workflow.ts', slug: 'last-guide' },
    ]);
  });

  test('rejects workflow files that contain more than one guide test', async ({}, testInfo) => {
    const root = testInfo.outputPath('app');
    createSyntheticRoot(root, {
      'two.workflow.ts': "test('One', async () => { guide.describe({ slug: 'one' }); });\ntest('Two', async () => {});",
    });
    const recorder = await loadRecorder();

    expect(() => recorder.discoverWorkflowUnits(root)).toThrow(/exactly one guide-producing test; found 2/);
  });

  test('fingerprints workflow, config, lock, recorder, and optional revision inputs', async ({}, testInfo) => {
    const root = testInfo.outputPath('app');
    createSyntheticRoot(root, {
      'one.workflow.ts': "test('One', async () => { guide.describe({ slug: 'one' }); });",
    });
    const recorder = await loadRecorder();
    const unit = recorder.discoverWorkflowUnits(root)[0];
    const first = recorder.computeUnitFingerprint(unit, { root, revision: 'revision-a' });

    writeFileSync(unit.file, `${readFileSync(unit.file, 'utf8')}\n// changed`);
    const changedWorkflow = recorder.computeUnitFingerprint(unit, { root, revision: 'revision-a' });
    const changedRevision = recorder.computeUnitFingerprint(unit, { root, revision: 'revision-b' });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(changedWorkflow).not.toBe(first);
    expect(changedRevision).not.toBe(changedWorkflow);
  });

  test('resumes only complete checkpoints with matching fingerprints and media', async ({}, testInfo) => {
    const directory = testInfo.outputPath('checkpoint');
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, '01-open.png'), 'png');
    writeFileSync(path.join(directory, 'walkthrough.webm'), 'webm');
    writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      fingerprint: 'abc',
      status: 'passed',
      publishable: true,
      steps: [{ index: 1, screenshot: '01-open.png' }],
    }));
    const recorder = await loadRecorder();

    expect(recorder.validateCheckpoint(directory, 'abc')).toEqual([]);
    expect(recorder.validateCheckpoint(directory, 'stale')).toContain('fingerprint does not match');
  });

  test('replaces stale checkpoints only after a complete temporary unit exists', async ({}, testInfo) => {
    const staging = testInfo.outputPath('staging');
    const current = path.join(staging, 'example-guide');
    const temporary = path.join(staging, '.tmp-example');
    mkdirSync(current, { recursive: true });
    mkdirSync(temporary, { recursive: true });
    writeFileSync(path.join(current, 'marker.txt'), 'old');
    writeFileSync(path.join(temporary, 'marker.txt'), 'new');
    const recorder = await loadRecorder();

    const replaced = recorder.replaceCheckpoint(staging, temporary, 'example-guide');

    expect(readFileSync(path.join(replaced, 'marker.txt'), 'utf8')).toBe('new');
  });
});
