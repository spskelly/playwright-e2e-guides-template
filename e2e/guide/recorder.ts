/** Application-independent Playwright guide recorder. */
import { test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadGuideConfig } from './config';
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
  type GuideMeta,
  type GuideStepOptions,
  type GuideStepRecord,
} from './manifest';

export type { GuideManifest, GuideMeta, GuideStepOptions, GuideStepRecord } from './manifest';

const GUIDE_CONFIG = loadGuideConfig();
export const GUIDES_OUT_DIR = GUIDE_CONFIG.outputDirectory;

const CAPTION_INIT_SCRIPT = `
(() => {
  const THEME = ${JSON.stringify(GUIDE_CONFIG.captions)};
  const KEY = '__playwrightGuideCaption';
  function render() {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch {}
    let el = document.getElementById('playwright-guide-caption');
    if (!data) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'playwright-guide-caption';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:' + THEME.bottomPx + 'px', 'transform:translateX(-50%)',
        'max-width:min(920px, 86vw)', 'padding:14px 22px', 'border-radius:14px',
        'background:' + THEME.background, 'color:' + THEME.foreground, 'z-index:2147483647',
        'font:15px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        'box-shadow:0 12px 40px rgba(0,0,0,0.45)', 'pointer-events:none',
        'backdrop-filter:blur(6px)', 'border:1px solid rgba(255,255,255,0.12)',
      ].join(';');
      (document.body || document.documentElement).appendChild(el);
    }
    const stepLabel = data.index ? '<span style="display:inline-block;min-width:26px;height:26px;border-radius:13px;background:' + THEME.accent + ';color:#111;font-weight:700;text-align:center;line-height:26px;margin-right:10px;font-size:13px">' + data.index + '</span>' : '';
    el.innerHTML = stepLabel + '<strong style="font-size:16px">' + data.title + '</strong>' + (data.note ? '<div style="margin-top:6px;color:' + THEME.muted + '">' + data.note + '</div>' : '');
  }
  window.__playwrightGuideSetCaption = (payload) => {
    try { sessionStorage.setItem(KEY, payload ? JSON.stringify(payload) : ''); } catch {}
    if (!payload) { try { sessionStorage.removeItem(KEY); } catch {} }
    render();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  new MutationObserver(() => {
    if (!document.getElementById('playwright-guide-caption')) render();
  }).observe(document.documentElement, { childList: true, subtree: false });
})();
`;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] as string,
  );
}
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export class Guide {
  readonly enabled: boolean;
  private meta: Partial<GuideMeta> = {};
  private steps: GuideStepRecord[] = [];
  private startedAt = new Date();
  private recordingErrors: string[] = [];
  private captionsOn = process.env.GUIDE_CAPTIONS !== '0';
  private stepPause = GUIDE_CONFIG.stepPauseMs;

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
    enabled: boolean,
  ) {
    this.enabled = enabled;
  }

  async install(): Promise<void> {
    if (!this.enabled || !this.captionsOn) return;
    await this.page.addInitScript(CAPTION_INIT_SCRIPT);
  }

  describe(meta: GuideMeta): void {
    this.meta = { ...this.meta, ...meta };
  }

  get slug(): string {
    return validateSlug(this.meta.slug || slugify(this.testInfo.title));
  }

  get outDir(): string {
    return resolvePathWithin(GUIDES_OUT_DIR, this.slug);
  }

  private async setCaption(index: number, title: string, note?: string): Promise<void> {
    if (!this.enabled || !this.captionsOn) return;
    try {
      await this.page.evaluate(
        ({ index, title, note }) => {
          const pageWindow = window as typeof window & { __playwrightGuideSetCaption?: (payload: unknown) => void };
          pageWindow.__playwrightGuideSetCaption?.({ index, title, note });
        },
        { index, title: escapeHtml(title), note: note ? escapeHtml(note) : undefined },
      );
    } catch {
      // Navigation can temporarily replace the page execution context.
    }
  }

  async clearCaption(): Promise<void> {
    if (!this.enabled || !this.captionsOn) return;
    try {
      await this.page.evaluate(() => {
        const pageWindow = window as typeof window & { __playwrightGuideSetCaption?: (payload: unknown) => void };
        pageWindow.__playwrightGuideSetCaption?.(null);
      });
    } catch {
      // A closing or navigating page does not need caption cleanup.
    }
  }

  private screenshotMasks(options: GuideStepOptions) {
    return [...GUIDE_CONFIG.defaultScreenshotMasks, ...(options.mask || [])].map((mask) =>
      typeof mask === 'string' ? this.page.locator(mask) : mask,
    );
  }

  private async setSensitiveOverlay(visible: boolean): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.page.evaluate((show) => {
        const id = 'playwright-guide-sensitive-overlay';
        document.getElementById(id)?.remove();
        if (!show) return;
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.cssText = 'position:fixed;inset:0;background:#111827;z-index:2147483646;pointer-events:none';
        (document.body || document.documentElement).appendChild(overlay);
      }, visible);
    } catch (error) {
      const message = `could not ${visible ? 'enable' : 'clear'} sensitive-content overlay`;
      this.recordingErrors.push(message);
      if (GUIDE_CONFIG.strictRecording) throw error;
    }
  }

  async sensitive<T>(action: () => Promise<T>): Promise<T> {
    if (!this.enabled) return action();
    await this.setSensitiveOverlay(true);
    try {
      return await action();
    } finally {
      await this.setSensitiveOverlay(false);
    }
  }

  async step<T>(title: string, action: () => Promise<T>, options: GuideStepOptions = {}): Promise<T> {
    const index = this.steps.length + 1;
    const started = Date.now();
    return test.step(title, async () => {
      await this.setCaption(index, title, options.note);
      const result = await action();
      let screenshot: string | undefined;
      if (this.enabled) {
        await this.page.waitForTimeout(options.pause ?? this.stepPause);
        if (options.screenshot !== false) {
          mkdirSync(this.outDir, { recursive: true });
          const file = `${String(index).padStart(2, '0')}-${slugify(title)}.png`;
          const target = resolvePathWithin(this.outDir, file);
          try {
            const mask = this.screenshotMasks(options);
            if (options.clip) await this.page.locator(options.clip.selector).first().screenshot({ path: target, mask });
            else await this.page.screenshot({ path: target, fullPage: false, mask });
            screenshot = file;
            await this.testInfo.attach(`step-${index}`, { path: target, contentType: 'image/png' });
          } catch (error) {
            const message = `step ${index} screenshot failed`;
            this.recordingErrors.push(message);
            if (GUIDE_CONFIG.strictRecording) throw error;
          }
        }
      }
      this.steps.push({
        index,
        title,
        note: options.note,
        screenshot,
        url: this.safeUrl(),
        startedAt: new Date(started).toISOString(),
        durationMs: Date.now() - started,
      });
      return result;
    });
  }

  private safeUrl(): string {
    try {
      return sanitizeGuideUrl(this.page.url(), GUIDE_CONFIG.allowedUrlQueryParameters);
    } catch {
      return '';
    }
  }

  async finish(status: string | undefined): Promise<GuideManifest | null> {
    if (!this.enabled) return null;
    mkdirSync(this.outDir, { recursive: true });
    let videoPath: string | undefined;
    try {
      const video = this.page.video();
      if (video) videoPath = await video.path();
    } catch {
      videoPath = undefined;
    }
    const finishedAt = new Date();
    const manifest: GuideManifest = {
      schemaVersion: GUIDE_SCHEMA_VERSION,
      generatorVersion: GENERATOR_VERSION,
      slug: this.slug,
      title: this.meta.title || this.testInfo.title,
      description: this.meta.description || '',
      audience: this.meta.audience || '',
      estimatedMinutes: this.meta.estimatedMinutes,
      tags: this.meta.tags || [],
      project: this.testInfo.project.name,
      specFile: path.relative(GUIDE_CONFIG.rootDirectory, this.testInfo.file),
      sourceRevision: sourceRevisionFromEnvironment(),
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - this.startedAt.getTime(),
      viewport: this.page.viewportSize(),
      outputDir: this.testInfo.outputDir,
      videoPath,
      steps: this.steps,
      status: normalizeRecordingStatus(status),
      publishable: false,
      validationErrors: [],
    };
    manifest.validationErrors = [...this.recordingErrors, ...validateGuideManifest(manifest, this.outDir)];
    manifest.publishable = manifest.validationErrors.length === 0;
    const file = resolvePathWithin(this.outDir, 'manifest.json');
    writeFileSync(file, JSON.stringify(manifest, null, 2));
    await this.testInfo.attach('guide-manifest', { path: file, contentType: 'application/json' });
    if (GUIDE_CONFIG.strictRecording && !manifest.publishable) {
      throw new Error(`guide recording is not publishable: ${manifest.validationErrors.join('; ')}`);
    }
    return manifest;
  }
}
