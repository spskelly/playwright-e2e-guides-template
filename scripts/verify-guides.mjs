#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function requiredFile(file, errors, label) {
  if (!existsSync(file)) errors.push(`${label} is missing: ${file}`);
}

export function verifyGuideSite(siteRoot) {
  const root = path.resolve(siteRoot);
  const errors = [];
  requiredFile(path.join(root, 'README.md'), errors, 'root README');
  requiredFile(path.join(root, 'index.html'), errors, 'root index');
  requiredFile(path.join(root, 'site.css'), errors, 'site stylesheet');
  const jsonPath = path.join(root, 'guides.json');
  requiredFile(jsonPath, errors, 'guide index');
  if (errors.length) return { errors, guideCount: 0 };
  let index;
  try {
    index = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    return { errors: [`guides.json is invalid: ${error instanceof Error ? error.message : String(error)}`], guideCount: 0 };
  }
  if (index.schemaVersion !== 1) errors.push('guides.json schemaVersion must be 1');
  if (!Array.isArray(index.guides) || index.guides.length === 0) errors.push('guides.json must contain at least one guide');
  const slugs = new Set();
  for (const guide of index.guides || []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug)) errors.push(`invalid guide slug: ${guide.slug}`);
    if (slugs.has(guide.slug)) errors.push(`duplicate guide slug: ${guide.slug}`);
    slugs.add(guide.slug);
    const directory = path.join(root, guide.slug);
    requiredFile(path.join(directory, 'README.md'), errors, `${guide.slug} README`);
    requiredFile(path.join(directory, 'index.html'), errors, `${guide.slug} HTML`);
    requiredFile(path.join(directory, 'captions.vtt'), errors, `${guide.slug} captions`);
    requiredFile(path.join(directory, 'walkthrough.webm'), errors, `${guide.slug} WebM`);
    if (existsSync(path.join(directory, 'manifest.json'))) errors.push(`${guide.slug} exposes a raw manifest`);
    for (const [field, relative] of [['path', guide.path], ['readme', guide.readme], ['video', guide.video], ['captions', guide.captions], ['poster', guide.poster]]) {
      if (relative) requiredFile(path.join(root, relative), errors, `${guide.slug} ${field}`);
    }
    for (const screenshot of guide.screenshots || []) requiredFile(path.join(directory, screenshot), errors, `${guide.slug} screenshot`);
  }
  return { errors, guideCount: index.guides?.length || 0 };
}

function siteArg(args) {
  const index = args.indexOf('--site');
  return index >= 0 && args[index + 1] ? path.resolve(args[index + 1]) : path.join(ROOT, 'guides-site');
}

export function main(args = process.argv.slice(2)) {
  const site = siteArg(args);
  const result = verifyGuideSite(site);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`[guides] ${error}`);
    throw new Error(`guide site verification failed with ${result.errors.length} error(s)`);
  }
  console.log(`[guides] verified ${result.guideCount} guide(s) in ${site}`);
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try { main(); } catch (error) {
    console.error(`[guides] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
