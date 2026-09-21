import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Locator } from '@playwright/test';

export const GUIDE_SCHEMA_VERSION = 1 as const;
export const GENERATOR_VERSION = '1.0.0';

export type RecordingStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted' | 'unknown';

export interface GuideMeta {
  slug?: string;
  title: string;
  description: string;
  audience: string;
  estimatedMinutes?: number;
  tags: string[];
}
export interface GuideStepOptions {
  note?: string;
  screenshot?: boolean;
  pause?: number;
  clip?: { selector: string };
  mask?: Array<string | Locator>;
}

export interface GuideStepRecord {
  index: number;
  title: string;
  note?: string;
  screenshot?: string;
  url: string;
  startedAt: string;
  durationMs: number;
}

export interface GuideManifest {
  schemaVersion: typeof GUIDE_SCHEMA_VERSION;
  generatorVersion: string;
  slug: string;
  title: string;
  description: string;
  audience: string;
  estimatedMinutes?: number;
  tags: string[];
  project: string;
  specFile: string;
  sourceRevision?: string;
  fingerprint?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  viewport: { width: number; height: number } | null;
  outputDir: string;
  videoPath?: string;
  steps: GuideStepRecord[];
  status: RecordingStatus;
  publishable: boolean;
  validationErrors: string[];
}

const RECORDING_STATUSES = new Set<RecordingStatus>([
  'passed',
  'failed',
  'timedOut',
  'skipped',
  'interrupted',
  'unknown',
]);

export function normalizeRecordingStatus(status: string | undefined): RecordingStatus {
  if (status && RECORDING_STATUSES.has(status as RecordingStatus)) return status as RecordingStatus;
  return 'unknown';
}

export function sourceRevisionFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.GITHUB_SHA || env.GIT_COMMIT || undefined;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateSlug(slug: string): string {
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
    throw new Error(`invalid guide slug: ${JSON.stringify(slug)}`);
  }
  return slug;
}

export function resolvePathWithin(root: string, ...parts: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...parts);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`resolved path is outside configured root: ${resolved}`);
  }
  return resolved;
}

export function sanitizeGuideUrl(value: string, allowedQueryParameters: string[]): string {
  try {
    const url = new URL(value);
    const allowed = new Set(allowedQueryParameters);
    url.username = '';
    url.password = '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (!allowed.has(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return '';
  }
}

export function validateGuideManifest(manifest: GuideManifest, manifestDirectory: string): string[] {
  const errors: string[] = [];
  try {
    validateSlug(manifest.slug);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'guide slug is invalid');
  }
  if (manifest.schemaVersion !== GUIDE_SCHEMA_VERSION) errors.push('schemaVersion must be 1');
  if (!manifest.generatorVersion) errors.push('generatorVersion is required');
  if (!manifest.title.trim()) errors.push('title is required');
  if (!manifest.description.trim()) errors.push('description is required');
  if (!manifest.audience.trim()) errors.push('audience is required');
  if (!manifest.project.trim()) errors.push('project is required');
  if (!manifest.specFile.trim()) errors.push('specFile is required');
  if (manifest.status !== 'passed') errors.push('recording status must be passed');
  if (manifest.steps.length === 0) errors.push('at least one step is required');
  for (const step of manifest.steps) {
    if (!step.title.trim()) errors.push(`step ${step.index} title is required`);
    if (!step.screenshot) continue;
    try {
      const screenshot = resolvePathWithin(manifestDirectory, step.screenshot);
      if (!existsSync(screenshot)) errors.push(`step ${step.index} screenshot does not exist: ${step.screenshot}`);
    } catch {
      errors.push(`step ${step.index} screenshot path is unsafe: ${step.screenshot}`);
    }
  }
  return errors;
}
