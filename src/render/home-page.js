/**
 * HTML renderer for the soil-series-viewer home page (`index.html`).
 * Produces USDA-styled markup matching `src/styles/home.css` and hydrates
 * via the browser ES module `./assets/home-app.js`.
 */

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Facet `<select>` definitions matching `src/index/search-index.js` and
 * `src/client/search-engine.js`.
 */
export const FACET_FIELDS = Object.freeze([
  Object.freeze({ name: "status", label: "Series Status", primary: true }),
  Object.freeze({ name: "order", label: "Taxonomic Order", primary: true }),
  Object.freeze({ name: "suborder", label: "Suborder", primary: true }),
  Object.freeze({ name: "grtgroup", label: "Great Group", primary: true }),
  Object.freeze({ name: "subgrp", label: "Subgroup", primary: true }),
  Object.freeze({ name: "state", label: "State / Area", primary: true }),
  Object.freeze({ name: "partsize", label: "Particle Size", primary: false }),
  Object.freeze({ name: "minalogy", label: "Mineralogy", primary: false }),
  Object.freeze({ name: "ceactcl", label: "CEC Activity Class", primary: false }),
  Object.freeze({ name: "reaction", label: "Reaction Class", primary: false }),
  Object.freeze({ name: "tempcl", label: "Temperature Class", primary: false }),
  Object.freeze({ name: "mlraoffice", label: "MLRA Office", primary: false }),
]);

/**
 * Escape special HTML characters in text and attribute values.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

function renderFacetSelectGroup(field) {
  const selectId = `facet-${field.name}`;
  return [
    `            <div class="facet-group">`,
    `              <label class="facet-label" for="${escapeHtml(selectId)}">${escapeHtml(field.label)}</label>`,
    `              <select id="${escapeHtml(selectId)}" class="facet-select" name="${escapeHtml(field.name)}" data-facet="${escapeHtml(field.name)}">`,
    `                <option value="">All</option>`,
    `              </select>`,
    `            </div>`,
  ].join("\n");
}

/**
 * Render the complete static home page HTML document (`index.html`).
 *
 * @param {object} [options]
 * @param {string} [options.usdaCssHref="./usdastyle.css"]
 * @param {string} [options.homeCssHref="./home.css"]
 * @param {string} [options.appScriptSrc="./assets/home-app.js"]
 * @param {string} [options.title="Official Soil Series Descriptions & Series Classification"]
 * @param {string} [options.subtitle]
 * @param {number|null} [options.totalCount=null]
 * @returns {string} Complete HTML document
 */
export function renderHomePage(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const usdaCssHref = opts.usdaCssHref ?? "./usdastyle.css";
  const homeCssHref = opts.homeCssHref ?? "./home.css";
  const appScriptSrc = opts.appScriptSrc ?? "./assets/home-app.js";
  const title =
    opts.title ?? "Official Soil Series Descriptions & Series Classification";
  const subtitle =
    opts.subtitle ??
    "USDA-NRCS Soil Series Viewer — Search by series name or filter by Soil Classification taxonomy.";
  const initialStatus =
    typeof opts.totalCount === "number" && Number.isFinite(opts.totalCount)
      ? `Loading ${opts.totalCount.toLocaleString("en-US")} series...`
      : "Loading series index...";

  const primaryFacetHtml = FACET_FIELDS.filter((field) => field.primary)
    .map(renderFacetSelectGroup)
    .join("\n");
  const secondaryFacetHtml = FACET_FIELDS.filter((field) => !field.primary)
    .map(renderFacetSelectGroup)
    .join("\n");

  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head>`,
    `  <meta charset="utf-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1">`,
    `  <title>${escapeHtml(title)}</title>`,
    `  <link rel="stylesheet" href="${escapeHtml(usdaCssHref)}">`,
    `  <link rel="stylesheet" href="${escapeHtml(homeCssHref)}">`,
    `</head>`,
    `<body>`,
    `  <div class="home-page">`,
    `    <header class="home-header">`,
    `      <div class="home-header-bar">`,
    `        <h1 class="home-title">${escapeHtml(title)}</h1>`,
    `      </div>`,
    `      <div class="home-subtitle">${escapeHtml(subtitle)}</div>`,
    `    </header>`,
    `    <section class="home-toolbar" aria-label="Series search and status">`,
    `      <div class="home-search-group">`,
    `        <label class="home-search-label" for="series-search">Series Name:</label>`,
    `        <input`,
    `          id="series-search"`,
    `          class="home-search-input"`,
    `          type="search"`,
    `          name="q"`,
    `          placeholder="Search series (e.g. ANTI*, ?ARGO, muscatune)"`,
    `          aria-describedby="series-search-hint"`,
    `          autocomplete="off"`,
    `        >`,
    `        <span id="series-search-hint" class="home-search-hint">Supports wildcards <code>*</code> (any chars) and <code>?</code> (single char), or fuzzy matching.</span>`,
    `      </div>`,
    `      <div class="home-toolbar-actions">`,
    `        <span id="home-status" class="home-status" role="status" aria-live="polite">${escapeHtml(initialStatus)}</span>`,
    `        <button id="home-clear-btn" class="home-clear-btn" type="button">Clear filters</button>`,
    `      </div>`,
    `    </section>`,
    `    <div class="home-layout">`,
    `      <aside class="home-facets" aria-label="Classification facets">`,
    `        <div class="home-facets-header">`,
    `          <span>Filter Classification</span>`,
    `        </div>`,
    `        <div class="home-facets-body">`,
    primaryFacetHtml,
    `          <details class="facet-collapse" open>`,
    `            <summary>Family &amp; Regional Facets</summary>`,
    `            <div class="home-facets-body">`,
    secondaryFacetHtml,
    `            </div>`,
    `          </details>`,
    `          <div class="facet-checkbox-row">`,
    `            <input id="facet-benchmark" type="checkbox" name="benchmark" data-facet="benchmark">`,
    `            <label for="facet-benchmark">Benchmark series only</label>`,
    `          </div>`,
    `        </div>`,
    `      </aside>`,
    `      <main class="home-results" aria-label="Soil series gallery">`,
    `        <div id="gallery-grid" class="gallery-grid" aria-busy="true"></div>`,
    `        <div id="home-empty-state" class="home-empty-state" hidden>No soil series match the current search and facet filters.</div>`,
    `        <div id="gallery-more-wrap" class="home-toolbar-actions" hidden>`,
    `          <button id="gallery-load-more" class="home-clear-btn" type="button">Load more series</button>`,
    `          <div id="gallery-sentinel" aria-hidden="true"></div>`,
    `        </div>`,
    `      </main>`,
    `    </div>`,
    `    <footer class="home-footer">USDA-NRCS National Cooperative Soil Survey &mdash; Official Soil Series Descriptions &amp; Series Classification</footer>`,
    `  </div>`,
    `  <script type="module" src="${escapeHtml(appScriptSrc)}"></script>`,
    `</body>`,
    `</html>`,
    ``,
  ].join("\n");
}
