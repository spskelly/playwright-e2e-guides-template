export function normalizePublicationBasePath(value) {
  if (!value || value === '/') return '/';
  return `/${String(value).replace(/^\/+|\/+$/g, '')}/`;
}

export function stripPublicationBasePath(pathname, configuredBasePath) {
  const basePath = normalizePublicationBasePath(configuredBasePath);
  if (basePath === '/') return pathname;
  if (pathname === basePath.slice(0, -1) || pathname === basePath) return '/';
  if (!pathname.startsWith(basePath)) return null;
  return `/${pathname.slice(basePath.length)}`;
}

export function localGuideUrl(port, configuredBasePath) {
  return `http://127.0.0.1:${port}${normalizePublicationBasePath(configuredBasePath)}`;
}
