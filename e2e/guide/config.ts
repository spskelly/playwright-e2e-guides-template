import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface GuideCaptionConfig {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  bottomPx: number;
}
export interface GuideConfigFile {
  schemaVersion: 1;
  productName: string;
  siteName: string;
  siteDescription: string;
  outputDirectory: string;
  stagingDirectory: string;
  locale: string;
  captions: GuideCaptionConfig;
  strictRecordingDefault: boolean;
  allowedUrlQueryParameters: string[];
  defaultScreenshotMasks: string[];
  publicationBasePath: string;
}

export interface GuideConfig extends Omit<GuideConfigFile, 'outputDirectory' | 'stagingDirectory'> {
  configPath: string;
  rootDirectory: string;
  outputDirectory: string;
  stagingDirectory: string;
  stepPauseMs: number;
  slowMoMs: number;
  strictRecording: boolean;
}

export interface LoadGuideConfigOptions {
  configPath?: string;
  env?: Record<string, string | undefined>;
}

function timingValue(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`);
  return parsed;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`guide config ${name} must be a non-empty string`);
  return value;
}

function resolveConfiguredPath(root: string, value: string): string {
  return path.resolve(root, value);
}

function booleanValue(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  throw new Error(`${name} must be 0, 1, true, or false`);
}

export function loadGuideConfig(options: LoadGuideConfigOptions = {}): GuideConfig {
  const configPath = path.resolve(options.configPath || path.join(__dirname, '..', '..', 'guide.config.json'));
  const rootDirectory = path.dirname(configPath);
  const env = options.env || process.env;
  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as GuideConfigFile;

  if (parsed.schemaVersion !== 1) throw new Error(`unsupported guide config schema version: ${String(parsed.schemaVersion)}`);
  requireString(parsed.productName, 'productName');
  requireString(parsed.siteName, 'siteName');
  requireString(parsed.siteDescription, 'siteDescription');
  requireString(parsed.locale, 'locale');
  requireString(parsed.outputDirectory, 'outputDirectory');
  requireString(parsed.stagingDirectory, 'stagingDirectory');
  if (!parsed.captions || typeof parsed.captions !== 'object') throw new Error('guide config captions must be an object');
  if (!Array.isArray(parsed.allowedUrlQueryParameters)) throw new Error('guide config allowedUrlQueryParameters must be an array');
  if (!Array.isArray(parsed.defaultScreenshotMasks)) throw new Error('guide config defaultScreenshotMasks must be an array');

  return {
    ...parsed,
    configPath,
    rootDirectory,
    outputDirectory: resolveConfiguredPath(rootDirectory, env.GUIDES_OUT || parsed.outputDirectory),
    stagingDirectory: resolveConfiguredPath(rootDirectory, env.GUIDE_WORK_DIR || parsed.stagingDirectory),
    stepPauseMs: timingValue(env.GUIDE_STEP_PAUSE, 1100, 'GUIDE_STEP_PAUSE'),
    slowMoMs: timingValue(env.GUIDE_SLOWMO, 250, 'GUIDE_SLOWMO'),
    strictRecording: booleanValue(env.GUIDE_STRICT, parsed.strictRecordingDefault, 'GUIDE_STRICT'),
  };
}
