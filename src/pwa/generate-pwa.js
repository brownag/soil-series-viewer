/**
 * Offline PWA manifest (`manifest.json`), service worker (`sw.js`), and
 * HTML integration snippet generators for soil-series-viewer.
 */

export const DEFAULT_STATIC_PATHS = Object.freeze([
  "",
  "index.html",
  "manifest.json",
  "styles/usdastyle.css",
  "styles/home.css",
  "styles/taxonomy.css",
  "client/home-app.js",
  "client/search-engine.js",
  "client/strip-svg.js",
  "client/taxonomy-app.js",
  "client/glossary-app.js",
  "client/fulltext-search.js",
  "client/profile-interactive.js",
  "taxonomy/index.html",
  "glossary/index.html",
]);

export const DEFAULT_DYNAMIC_PATHS = Object.freeze([
  "data/search-index.json",
  "data/taxonomy-tree.json",
  "data/kst-criteria.json",
  "data/glossary.json",
]);

const DEFAULT_ICON_SVG_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E" +
  "%3Crect fill='%231a472a' width='192' height='192'/%3E" +
  "%3Ctext x='96' y='122' font-size='76' fill='white' text-anchor='middle' font-weight='bold'%3EOSD%3C/text%3E" +
  "%3C/svg%3E";

const HTML_ATTR_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeAttr(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ATTR_ESCAPE_MAP[ch]);
}

function normalizePrefix(prefix = "./") {
  if (prefix === null || prefix === undefined) {
    return "./";
  }
  const str = String(prefix);
  if (str === "" || str.endsWith("/")) {
    return str;
  }
  return `${str}/`;
}

/**
 * Build a pretty-printed Web App Manifest (`manifest.json`) string.
 *
 * @param {object} [options]
 * @returns {string}
 */
export function buildWebManifest(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const manifest = {
    name: opts.name ?? "Official Soil Series Descriptions",
    short_name: opts.short_name ?? opts.shortName ?? "Soil OSD",
    version: opts.version ?? "1.0.0",
    description:
      opts.description ??
      "USDA-NRCS Official Soil Series Descriptions & Series Classification",
    start_url: opts.start_url ?? opts.startUrl ?? "./",
    scope: opts.scope ?? "./",
    display: opts.display ?? "standalone",
    orientation: opts.orientation ?? "portrait-primary",
    theme_color: opts.theme_color ?? opts.themeColor ?? "#1a472a",
    background_color: opts.background_color ?? opts.backgroundColor ?? "#ffffff",
    icons: Array.isArray(opts.icons)
      ? opts.icons
      : [
          {
            src: DEFAULT_ICON_SVG_DATA_URI,
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
    categories: Array.isArray(opts.categories)
      ? opts.categories
      : ["education", "productivity"],
    prefer_related_applications:
      opts.prefer_related_applications ?? opts.preferRelatedApplications ?? false,
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Build a relative-base Service Worker (`sw.js`) string.
 *
 * @param {object} [options]
 * @param {string} [options.cacheVersion="v1"]
 * @param {readonly string[]} [options.staticPaths=DEFAULT_STATIC_PATHS]
 * @param {readonly string[]} [options.dynamicPaths=DEFAULT_DYNAMIC_PATHS]
 * @returns {string}
 */
export function buildServiceWorker(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const cacheVersion = String(opts.cacheVersion ?? "v1");
  const staticPaths = Array.isArray(opts.staticPaths)
    ? [...opts.staticPaths]
    : [...DEFAULT_STATIC_PATHS];
  const dynamicPaths = Array.isArray(opts.dynamicPaths)
    ? [...opts.dynamicPaths]
    : [...DEFAULT_DYNAMIC_PATHS];

  const versionLiteral = JSON.stringify(cacheVersion);
  const staticPathsLiteral = JSON.stringify(staticPaths, null, 2);
  const dynamicPathsLiteral = JSON.stringify(dynamicPaths, null, 2);

  return `/**
 * Service Worker: Official Soil Series Descriptions
 *
 * Caching strategies:
 * - STATIC (shell HTML, CSS, client JS, manifest): Cache-first
 * - DYNAMIC (index/taxonomy/glossary JSON & OSD pages): Network-first with cache fallback
 *
 * Update CACHE_VERSION when static files change.
 */

const CACHE_VERSION = ${versionLiteral};
const STATIC_CACHE = 'static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'dynamic-' + CACHE_VERSION;

// Resolve relative to SW location so it works at any deploy subpath
const BASE = new URL('./', self.location).href;

const STATIC_PATHS = ${staticPathsLiteral};

const DYNAMIC_PATHS = ${dynamicPathsLiteral};

const STATIC_URLS = STATIC_PATHS.map((p) => new URL(p, BASE).href);
const DYNAMIC_URLS = DYNAMIC_PATHS.map((p) => new URL(p, BASE).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
      .catch((error) => console.error('Cache install failed:', error))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => {
            const isStatic = name.startsWith('static-') && name !== STATIC_CACHE;
            const isDynamic = name.startsWith('dynamic-') && name !== DYNAMIC_CACHE;
            return isStatic || isDynamic;
          })
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;
  // Skip cross-origin or out-of-scope requests
  if (!request.url.startsWith(BASE)) return;

  // Static assets: cache-first
  if (STATIC_URLS.includes(request.url)) {
    event.respondWith(
      caches.match(request)
        .then((response) => response || fetchAndCache(request, STATIC_CACHE))
        .catch(() => new Response('Resource not found', { status: 404 }))
    );
    return;
  }

  // Dynamic data assets: network-first with cache fallback
  if (DYNAMIC_URLS.includes(request.url)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // OSD pages and other in-scope assets: network-first with cache fallback
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

function fetchAndCache(request, cacheName) {
  return fetch(request).then((response) => {
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  });
}

function networkFirst(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then(
        (cached) => cached || new Response('Resource not found', { status: 404 })
      )
    );
}
`;
}

/**
 * Render `<link rel="manifest">` and `<meta name="theme-color">` tags for `<head>`.
 *
 * @param {string} [prefix="./"]
 * @returns {string}
 */
export function renderPwaHeadTags(prefix = "./") {
  const hrefPrefix = escapeAttr(normalizePrefix(prefix));
  return `<link rel="manifest" href="${hrefPrefix}manifest.json">\n  <meta name="theme-color" content="#1a472a">`;
}

/**
 * Render an inline `<script>` registering `sw.js` on `window` `load`.
 *
 * @param {string} [prefix="./"]
 * @returns {string}
 */
export function renderSwRegisterScript(prefix = "./") {
  const swHrefLiteral = JSON.stringify(`${normalizePrefix(prefix)}sw.js`).replace(
    /</g,
    "\\u003c"
  );
  return [
    `<script>`,
    `  if ('serviceWorker' in navigator) {`,
    `    window.addEventListener('load', function () {`,
    `      navigator.serviceWorker.register(${swHrefLiteral}).catch(function () {});`,
    `    });`,
    `  }`,
    `</script>`,
  ].join("\n");
}
