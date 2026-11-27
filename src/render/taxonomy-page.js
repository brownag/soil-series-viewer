/**
 * HTML renderer for the soil-series-viewer Taxonomy Explorer page (`taxonomy/index.html`).
 * Produces USDA-styled markup matching `src/styles/taxonomy.css` and hydrates
 * via the browser ES module `../assets/taxonomy-app.js`.
 */

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

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

/**
 * Render the complete static Taxonomy Explorer HTML document (`taxonomy/index.html`).
 *
 * @param {object} [options={}]
 * @param {string} [options.cssHref="../usdastyle.css"]
 * @param {string} [options.taxonomyCssHref="../taxonomy.css"]
 * @param {string} [options.appScriptHref="../assets/taxonomy-app.js"]
 * @param {number} [options.totalSeries=0]
 * @param {number} [options.classifiedSeries=0]
 * @param {string} [options.title="Soil Taxonomy Explorer — USDA-NRCS Soil Series Viewer"]
 * @param {string} [options.subtitle]
 * @returns {string}
 */
export function renderTaxonomyPage(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const cssHref = opts.cssHref ?? "../usdastyle.css";
  const taxonomyCssHref = opts.taxonomyCssHref ?? "../taxonomy.css";
  const appScriptHref = opts.appScriptHref ?? "../assets/taxonomy-app.js";
  const totalSeries =
    typeof opts.totalSeries === "number" && Number.isFinite(opts.totalSeries)
      ? opts.totalSeries
      : 0;
  const classifiedSeries =
    typeof opts.classifiedSeries === "number" && Number.isFinite(opts.classifiedSeries)
      ? opts.classifiedSeries
      : 0;
  const title = opts.title ?? "Soil Taxonomy Explorer — USDA-NRCS Soil Series Viewer";
  const subtitle =
    opts.subtitle ??
    "Browse the 5-rank USDA Soil Taxonomy hierarchy and Keys to Soil Taxonomy (13th ed., 2022) criteria.";

  const initialStatus =
    totalSeries > 0
      ? `Loading taxonomy tree (${classifiedSeries.toLocaleString("en-US")} classified of ${totalSeries.toLocaleString("en-US")} series)...`
      : "Loading taxonomy tree...";

  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head>`,
    `  <meta charset="utf-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1">`,
    `  <title>${escapeHtml(title)}</title>`,
    `  <link rel="stylesheet" href="${escapeHtml(cssHref)}">`,
    `  <link rel="stylesheet" href="${escapeHtml(taxonomyCssHref)}">`,
    `</head>`,
    `<body>`,
    `  <div class="tax-page">`,
    `    <header class="tax-header">`,
    `      <div class="tax-header-bar">`,
    `        <h1 class="tax-title">${escapeHtml(title)}</h1>`,
    `        <nav class="tax-nav" aria-label="Primary navigation">`,
    `          <a href="../index.html">All Series</a>`,
    `          <a href="./index.html" aria-current="page">Taxonomy Explorer</a>`,
    `          <a href="../glossary/index.html">Glossary &amp; Features</a>`,
    `        </nav>`,
    `      </div>`,
    `      <div class="tax-subtitle">${escapeHtml(subtitle)}</div>`,
    `    </header>`,
    `    <main id="taxonomy-app" class="tax-main" aria-label="Soil Taxonomy Explorer">`,
    `      <nav id="tax-breadcrumbs" class="tax-breadcrumbs" aria-label="Taxonomy breadcrumb"></nav>`,
    `      <div id="tax-status" class="tax-status" role="status" aria-live="polite">${escapeHtml(initialStatus)}</div>`,
    `      <section id="tax-criteria" class="tax-criteria" aria-label="Keys to Soil Taxonomy criteria" hidden></section>`,
    `      <section id="tax-children" class="tax-children" aria-label="Taxonomic categories"></section>`,
    `      <section id="tax-series" class="tax-series" aria-label="Member soil series" hidden></section>`,
    `    </main>`,
    `    <footer class="tax-footer">USDA-NRCS National Cooperative Soil Survey &mdash; Keys to Soil Taxonomy (13th ed., 2022) &amp; Series Classification</footer>`,
    `  </div>`,
    `  <script type="module" src="${escapeHtml(appScriptHref)}"></script>`,
    `</body>`,
    `</html>`,
    ``,
  ].join("\n");
}
