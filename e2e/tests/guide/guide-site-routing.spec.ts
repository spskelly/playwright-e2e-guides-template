import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
const ROOT = path.resolve(__dirname, '../../..');

test('maps the configured publication base path to local site files', async () => {
  const routing = await dynamicImport(pathToFileURL(path.join(ROOT, 'scripts', 'guide-site-routing.mjs')).href);

  expect(routing.stripPublicationBasePath('/docs/', '/docs/')).toBe('/');
  expect(routing.stripPublicationBasePath('/docs/site.css', '/docs/')).toBe('/site.css');
  expect(routing.stripPublicationBasePath('/docs/create-project-task/', '/docs/')).toBe('/create-project-task/');
  expect(routing.stripPublicationBasePath('/other/site.css', '/docs/')).toBeNull();
  expect(routing.localGuideUrl(4173, '/docs/')).toBe('http://127.0.0.1:4173/docs/');
});
