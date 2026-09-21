#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeUnitFingerprint, discoverWorkflowUnits, validateCheckpoint } from './record-guides.mjs';
import { verifyGuideSite } from './verify-guides.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function containedPath(root, ...parts) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...parts);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`path is outside configured root: ${resolved}`);
  return resolved;
}

function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function markdown(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function duration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

function vttTime(milliseconds) {
  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(safe % 1000).padStart(3, '0')}`;
}

function captions(manifest) {
  const recordingStart = Date.parse(manifest.startedAt);
  const lines = ['WEBVTT', ''];
  for (const step of manifest.steps) {
    const start = Math.max(0, Date.parse(step.startedAt) - recordingStart);
    lines.push(String(step.index), `${vttTime(start)} --> ${vttTime(start + Math.max(step.durationMs || 0, 1000))}`, step.title);
    if (step.note) lines.push(step.note);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function normalizeBasePath(value) {
  if (!value) return '';
  if (value.includes('..') || value.includes('://')) throw new Error(`invalid publicationBasePath: ${value}`);
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

function siteLink(basePath, ...parts) {
  const trailing = parts.at(-1) === '' ? '/' : '';
  return `${basePath || '/'}${parts.filter(Boolean).map((part) => encodeURIComponent(part)).join('/')}${trailing}`;
}

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8', windowsHide: true });
  return found.status === 0 && found.stdout.trim() ? found.stdout.trim().split(/\r?\n/)[0] : null;
}

function optionalMedia(ffmpeg, webm, directory, wantGif) {
  const media = { webm: 'walkthrough.webm' };
  if (!ffmpeg) return media;
  const mp4 = path.join(directory, 'walkthrough.mp4');
  const result = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], { windowsHide: true });
  if (result.status === 0 && existsSync(mp4)) media.mp4 = 'walkthrough.mp4';
  if (wantGif) {
    const gif = path.join(directory, 'preview.gif');
    const gifResult = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-t', '20', '-i', webm, '-vf', 'fps=6,scale=720:-1:flags=lanczos', gif], { windowsHide: true });
    if (gifResult.status === 0 && existsSync(gif)) media.gif = 'preview.gif';
  }
  return media;
}

function guideMarkdown(guide) {
  const lines = [`# ${markdown(guide.title)}`, '', markdown(guide.description), '', `**Audience:** ${markdown(guide.audience)} | **Duration:** ${duration(guide.durationMs)} | **Topics:** ${guide.tags.map(markdown).join(', ')}`, '', '**Video:** [WebM](./walkthrough.webm)', '', '## Steps', ''];
  for (const step of guide.steps) {
    lines.push(`### ${step.index}. ${markdown(step.title)}`, '');
    if (step.note) lines.push(markdown(step.note), '');
    if (step.screenshot) lines.push(`![${markdown(step.title)}](./${step.screenshot})`, '');
  }
  lines.push('---', '', `_Source: \`${markdown(guide.specFile)}\`${guide.sourceRevision ? ` at \`${markdown(guide.sourceRevision)}\`` : ''}._`, '');
  return lines.join('\n');
}

function guideHtml(guide, config, basePath) {
  const steps = guide.steps.map((step) => `<section class="step"><h2><span>${step.index}</span> ${html(step.title)}</h2>${step.note ? `<p>${html(step.note)}</p>` : ''}${step.screenshot ? `<img src="${siteLink(basePath, guide.slug, step.screenshot)}" alt="${html(step.title)}">` : ''}</section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(guide.title)} | ${html(config.siteName)}</title><link rel="stylesheet" href="${siteLink(basePath, 'site.css')}"></head><body><header><nav aria-label="Guide navigation"><a href="${basePath || '/'}">All guides</a></nav><p class="eyebrow">${html(config.productName)}</p><h1>${html(guide.title)}</h1><p>${html(guide.description)}</p><p class="meta">For ${html(guide.audience)} | ${duration(guide.durationMs)}</p></header><main><video controls preload="metadata" src="${siteLink(basePath, guide.slug, 'walkthrough.webm')}"><track kind="captions" src="${siteLink(basePath, guide.slug, 'captions.vtt')}" srclang="en" label="English" default></video>${steps}</main><footer>Recorded from <code>${html(guide.specFile)}</code></footer></body></html>`;
}

function rootMarkdown(guides, config) {
  const lines = [`# ${markdown(config.siteName)}`, '', markdown(config.siteDescription), ''];
  const audiences = [...new Set(guides.map((guide) => guide.audience))].sort();
  for (const audience of audiences) {
    lines.push(`## ${markdown(audience)}`, '');
    for (const guide of guides.filter((item) => item.audience === audience)) lines.push(`- [${markdown(guide.title)}](./${guide.slug}/README.md) - ${markdown(guide.description)}`);
    lines.push('');
  }
  return lines.join('\n');
}

function rootHtml(guides, config, basePath) {
  const cards = guides.map((guide) => `<article><p class="eyebrow">${html(guide.audience)}</p><h2><a href="${siteLink(basePath, guide.slug, '')}">${html(guide.title)}</a></h2><p>${html(guide.description)}</p><p class="meta">${guide.steps.length} steps | ${duration(guide.durationMs)}</p></article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(config.siteName)}</title><meta name="description" content="${html(config.siteDescription)}"><link rel="stylesheet" href="${siteLink(basePath, 'site.css')}"></head><body><header><p class="eyebrow">${html(config.productName)}</p><h1>${html(config.siteName)}</h1><p>${html(config.siteDescription)}</p></header><main class="grid">${cards}</main></body></html>`;
}

function parseArgs(args, root, config) {
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const runId = process.env.GUIDE_RUN_ID || 'current';
  return {
    input: path.resolve(value('--input') || path.join(root, process.env.GUIDE_WORK_DIR || config.stagingDirectory, runId)),
    output: path.resolve(value('--output') || path.join(root, config.outputDirectory)),
    wantGif: args.includes('--gif') || process.env.GUIDES_GIF === '1',
  };
}

function validateManifestFields(manifest) {
  const errors = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.slug || '')) errors.push('slug is invalid');
  for (const field of ['title', 'description', 'audience', 'project', 'specFile']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) errors.push(`${field} is required`);
  }
  if (!Array.isArray(manifest.tags)) errors.push('tags must be an array');
  return errors;
}

export function buildGuideSite(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const config = readJson(path.join(root, 'guide.config.json'));
  const parsed = options.input && options.output ? options : parseArgs(options.args || [], root, config);
  const input = path.resolve(parsed.input);
  const output = path.resolve(parsed.output);
  if (!existsSync(input)) throw new Error(`guide input does not exist: ${input}`);
  if (input === output) throw new Error('guide input and publish output must be different directories');
  const parent = path.dirname(output);
  const basename = path.basename(output);
  const backup = containedPath(parent, `.${basename}.previous`);
  mkdirSync(parent, { recursive: true });
  if (existsSync(backup) && !existsSync(output)) renameSync(backup, output);
  if (existsSync(backup) && existsSync(output)) rmSync(backup, { recursive: true });
  const basePath = normalizeBasePath(config.publicationBasePath);
  const units = discoverWorkflowUnits(root);
  if (units.length === 0) throw new Error('workflow inventory expects no guides');
  const workflowSlugs = new Set();
  for (const unit of units) {
    if (workflowSlugs.has(unit.slug)) throw new Error(`duplicate workflow slug: ${unit.slug}`);
    workflowSlugs.add(unit.slug);
  }
  const actual = readdirSync(input, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort();
  const expected = units.map((unit) => unit.slug).sort();
  const missing = expected.filter((slug) => !actual.includes(slug));
  const extra = actual.filter((slug) => !expected.includes(slug));
  if (missing.length || extra.length) throw new Error(`guide inventory mismatch; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`);

  const revision = process.env.GUIDE_APP_REVISION || process.env.GITHUB_SHA || '';
  const manifests = [];
  const seen = new Set();
  for (const unit of units) {
    const directory = containedPath(input, unit.slug);
    const fingerprint = computeUnitFingerprint(unit, { root, revision });
    const errors = validateCheckpoint(directory, fingerprint);
    if (errors.length) throw new Error(`${unit.slug} is not publishable: ${errors.join('; ')}`);
    const manifest = readJson(path.join(directory, 'manifest.json'));
    const fieldErrors = validateManifestFields(manifest);
    if (fieldErrors.length) throw new Error(`${unit.slug} manifest is invalid: ${fieldErrors.join('; ')}`);
    if (manifest.slug !== unit.slug) throw new Error(`${unit.slug} manifest declares slug ${manifest.slug}`);
    if (seen.has(manifest.slug)) throw new Error(`duplicate guide slug: ${manifest.slug}`);
    seen.add(manifest.slug);
    manifests.push({ directory, manifest });
  }

  const staging = containedPath(parent, `.${basename}.staging-${process.pid}`);
  if (existsSync(staging)) rmSync(staging, { recursive: true });
  mkdirSync(staging, { recursive: true });
  const ffmpeg = Object.hasOwn(parsed, 'ffmpeg') ? parsed.ffmpeg : findFfmpeg();
  const guides = [];
  try {
    copyFileSync(path.join(root, 'e2e', 'guide', 'site.css'), path.join(staging, 'site.css'));
    for (const { directory, manifest } of manifests) {
      const target = containedPath(staging, manifest.slug);
      mkdirSync(target, { recursive: true });
      const screenshots = [];
      for (const step of manifest.steps) {
        if (!step.screenshot) continue;
        copyFileSync(containedPath(directory, step.screenshot), containedPath(target, step.screenshot));
        screenshots.push(step.screenshot);
      }
      const sourceWebm = containedPath(directory, 'walkthrough.webm');
      const targetWebm = containedPath(target, 'walkthrough.webm');
      copyFileSync(sourceWebm, targetWebm);
      const media = optionalMedia(ffmpeg, targetWebm, target, parsed.wantGif);
      const guide = { ...manifest, screenshots, media };
      writeFileSync(path.join(target, 'captions.vtt'), captions(manifest));
      writeFileSync(path.join(target, 'README.md'), guideMarkdown(guide));
      writeFileSync(path.join(target, 'index.html'), guideHtml(guide, config, basePath));
      guides.push(guide);
    }
    guides.sort((a, b) => a.slug.localeCompare(b.slug));
    const generatedAt = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() : new Date().toISOString();
    const revisions = [...new Set(guides.map((guide) => guide.sourceRevision).filter(Boolean))];
    if (revisions.length > 1) throw new Error(`guide source revisions differ: ${revisions.join(', ')}`);
    const summaries = guides.map((guide) => ({
      slug: guide.slug,
      title: guide.title,
      description: guide.description,
      audience: guide.audience,
      tags: guide.tags,
      durationMs: guide.durationMs,
      steps: guide.steps.length,
      path: `${guide.slug}/index.html`,
      readme: `${guide.slug}/README.md`,
      video: `${guide.slug}/${guide.media.mp4 || guide.media.webm}`,
      captions: `${guide.slug}/captions.vtt`,
      poster: guide.screenshots[0] ? `${guide.slug}/${guide.screenshots[0]}` : null,
      screenshots: guide.screenshots,
    }));
    writeFileSync(path.join(staging, 'README.md'), rootMarkdown(guides, config));
    writeFileSync(path.join(staging, 'index.html'), rootHtml(guides, config, basePath));
    writeFileSync(path.join(staging, 'guides.json'), JSON.stringify({ schemaVersion: 1, generatedAt, sourceRevision: revisions[0] || null, basePath, guides: summaries }, null, 2));
    const verification = verifyGuideSite(staging);
    if (verification.errors.length) throw new Error(`staged guide site is invalid: ${verification.errors.join('; ')}`);
    if (existsSync(backup)) rmSync(backup, { recursive: true });
    if (existsSync(output)) renameSync(output, backup);
    try {
      renameSync(staging, output);
      if (existsSync(backup)) rmSync(backup, { recursive: true });
    } catch (error) {
      if (!existsSync(output) && existsSync(backup)) renameSync(backup, output);
      throw error;
    }
    return { output, guides: summaries };
  } catch (error) {
    if (existsSync(staging)) rmSync(staging, { recursive: true });
    throw error;
  }
}

export function main(args = process.argv.slice(2)) {
  const config = readJson(path.join(ROOT, 'guide.config.json'));
  const result = buildGuideSite({ root: ROOT, ...parseArgs(args, ROOT, config) });
  console.log(`[guides] built ${result.guides.length} guide(s) in ${result.output}`);
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try { main(); } catch (error) {
    console.error(`[guides] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
