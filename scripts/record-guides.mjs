#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PER_GUIDE_TIMEOUT_MS = 9 * 60_000;
let activeChild = null;
let interrupted = false;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function containedPath(root, ...parts) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...parts);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`path is outside configured root: ${resolved}`);
  }
  return resolved;
}

export function discoverWorkflowUnits(root = ROOT) {
  const workflowDir = path.join(root, 'e2e', 'journeys');
  return readdirSync(workflowDir)
    .filter((name) => name.endsWith('.workflow.ts'))
    .sort()
    .map((name) => {
      const file = path.join(workflowDir, name);
      const source = readFileSync(file, 'utf8');
      const testCount = (source.match(/(?:^|\n)\s*test\s*\(/g) || []).length;
      if (testCount !== 1) throw new Error(`${name} must contain exactly one guide-producing test; found ${testCount}`);
      const slugMatch = source.match(/\bslug\s*:\s*[']([a-z0-9]+(?:-[a-z0-9]+)*)[']/);
      if (!slugMatch) throw new Error(`${name} must declare one portable guide slug`);
      return { name, file, slug: slugMatch[1] };
    });
}

export function computeUnitFingerprint(unit, options = {}) {
  const root = options.root || ROOT;
  const revision = options.revision || '';
  const inputs = [
    unit.file,
    path.join(root, 'guide.config.json'),
    path.join(root, 'package-lock.json'),
    path.join(root, 'e2e', 'guide', 'recorder.ts'),
  ];
  const hash = createHash('sha256');
  for (const file of inputs) {
    hash.update(path.relative(root, file));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  hash.update(revision);
  return hash.digest('hex');
}

export function validateCheckpoint(directory, fingerprint) {
  const errors = [];
  const manifestPath = path.join(directory, 'manifest.json');
  if (!existsSync(manifestPath)) return ['manifest.json is missing'];
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    return [`manifest.json is invalid: ${error instanceof Error ? error.message : String(error)}`];
  }
  if (manifest.fingerprint !== fingerprint) errors.push('fingerprint does not match');
  if (manifest.status !== 'passed') errors.push('recording status must be passed');
  if (manifest.publishable !== true) errors.push('manifest is not publishable');
  if (!Array.isArray(manifest.steps) || manifest.steps.length === 0) errors.push('at least one step is required');
  for (const step of manifest.steps || []) {
    if (!step.screenshot) continue;
    try {
      const screenshot = containedPath(directory, step.screenshot);
      if (!existsSync(screenshot)) errors.push(`missing screenshot: ${step.screenshot}`);
    } catch {
      errors.push(`unsafe screenshot path: ${step.screenshot}`);
    }
  }
  if (!existsSync(path.join(directory, 'walkthrough.webm'))) errors.push('walkthrough.webm is missing');
  return errors;
}

export function replaceCheckpoint(stagingRoot, temporaryDirectory, slug) {
  const finalDirectory = containedPath(stagingRoot, slug);
  const backupDirectory = containedPath(stagingRoot, `.previous-${slug}`);
  if (existsSync(backupDirectory)) rmSync(backupDirectory, { recursive: true });
  if (existsSync(finalDirectory)) renameSync(finalDirectory, backupDirectory);
  try {
    renameSync(temporaryDirectory, finalDirectory);
    if (existsSync(backupDirectory)) rmSync(backupDirectory, { recursive: true });
  } catch (error) {
    if (!existsSync(finalDirectory) && existsSync(backupDirectory)) renameSync(backupDirectory, finalDirectory);
    throw error;
  }
  return finalDirectory;
}

export function normalizePlaywrightPath(value) {
  return value.replaceAll('\\', '/');
}

function findRecordedVideo(manifest, root) {
  const candidates = [
    manifest.outputDir && path.join(manifest.outputDir, 'video.webm'),
    manifest.videoPath,
  ].filter(Boolean);
  const testResults = path.resolve(root, 'test-results');
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    const relative = path.relative(testResults, resolved);
    if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) && existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

function runPlaywrightUnit(unit, temporaryRoot, root) {
  const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
  const relativeWorkflow = normalizePlaywrightPath(path.relative(root, unit.file));
  const args = [cli, 'test', relativeWorkflow, '--project=guides', '--workers=1'];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, E2E_BACKEND: 'mock', GUIDES_OUT: temporaryRoot, GUIDE_STRICT: '1' },
      stdio: 'inherit',
      windowsHide: true,
    });
    activeChild = child;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${unit.name} exceeded the 9 minute recording timeout`));
    }, PER_GUIDE_TIMEOUT_MS);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      activeChild = null;
      if (code === 0) resolve();
      else reject(new Error(`${unit.name} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`));
    });
  });
}

async function recordUnit(unit, fingerprint, stagingRoot, root) {
  const temporaryRoot = containedPath(stagingRoot, `.tmp-${unit.slug}-${process.pid}-${Date.now()}`);
  mkdirSync(temporaryRoot, { recursive: true });
  try {
    await runPlaywrightUnit(unit, temporaryRoot, root);
    const guideDirectory = containedPath(temporaryRoot, unit.slug);
    const manifestPath = containedPath(guideDirectory, 'manifest.json');
    const manifest = readJson(manifestPath);
    const sourceVideo = findRecordedVideo(manifest, root);
    if (!sourceVideo) throw new Error(`${unit.name} did not produce a video under test-results`);
    copyFileSync(sourceVideo, containedPath(guideDirectory, 'walkthrough.webm'));
    manifest.outputDir = '.';
    manifest.videoPath = 'walkthrough.webm';
    manifest.fingerprint = fingerprint;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const errors = validateCheckpoint(guideDirectory, fingerprint);
    if (errors.length) throw new Error(`${unit.name} checkpoint is invalid: ${errors.join('; ')}`);
    replaceCheckpoint(stagingRoot, guideDirectory, unit.slug);
    rmSync(temporaryRoot, { recursive: true });
  } catch (error) {
    const failureDirectory = containedPath(stagingRoot, `.failed-${unit.slug}-${Date.now()}`);
    if (existsSync(temporaryRoot)) renameSync(temporaryRoot, failureDirectory);
    throw error;
  }
}

function installSignalHandlers() {
  const stop = () => {
    interrupted = true;
    if (activeChild) activeChild.kill();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

export async function main(args = process.argv.slice(2), options = {}) {
  const root = options.root || ROOT;
  const config = readJson(path.join(root, 'guide.config.json'));
  const workRoot = path.resolve(root, process.env.GUIDE_WORK_DIR || config.stagingDirectory);
  const runId = process.env.GUIDE_RUN_ID || 'current';
  const stagingRoot = containedPath(workRoot, runId);
  const units = discoverWorkflowUnits(root);
  const revision = process.env.GUIDE_APP_REVISION || process.env.GITHUB_SHA || '';
  console.log(`[guides] inventory: ${units.length} unit(s)`);
  for (const unit of units) console.log(`[guides]   ${unit.slug}: e2e/journeys/${unit.name}`);
  console.log(`[guides] staging: ${stagingRoot}`);
  console.log(`[guides] upper bound: ${units.length * 9} minutes (${units.length} units at less than 10 minutes each)`);
  console.log('[guides] disk: one 1440x900 WebM plus step screenshots per completed unit');
  console.log('[guides] success: every unit has a validated manifest, screenshots, fingerprint, and walkthrough.webm');
  console.log('[guides] failure: recording stops; completed checkpoints remain and .failed-* retains diagnostics');
  if (args.includes('--list')) return { units, stagingRoot };

  mkdirSync(stagingRoot, { recursive: true });
  installSignalHandlers();
  for (let index = 0; index < units.length; index += 1) {
    if (interrupted) throw new Error('guide recording interrupted');
    const unit = units[index];
    const fingerprint = computeUnitFingerprint(unit, { root, revision });
    const checkpoint = path.join(stagingRoot, unit.slug);
    if (existsSync(checkpoint) && validateCheckpoint(checkpoint, fingerprint).length === 0) {
      console.log(`[guides] resumed ${index + 1}/${units.length}: ${unit.slug}`);
      continue;
    }
    await recordUnit(unit, fingerprint, stagingRoot, root);
    console.log(`[guides] recorded ${index + 1}/${units.length}: ${unit.slug}`);
  }
  return { units, stagingRoot };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`[guides] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
