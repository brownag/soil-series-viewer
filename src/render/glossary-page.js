/**
 * HTML renderer for the Soil Taxonomy Glossary & Diagnostic Features page
 * (`taxonomy/glossary.html`).
 */

import { renderPwaHeadTags, renderSwRegisterScript } from "../pwa/generate-pwa.js";

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape special HTML characters in untrusted text and attribute values.
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
 * Render the complete static HTML5 page for the Soil Taxonomy Glossary.
 *
 * @param {object} [options]
 * @param {string} [options.cssHref="../usdastyle.css"]
 * @param {string} [options.taxonomyCssHref="../taxonomy.css"]
 * @param {string} [options.appScriptHref="../assets/glossary-app.js"]
 * @param {number} [options.totalTerms=0]
 * @param {string} [options.title="Soil Taxonomy Glossary & Diagnostic Features"]
 * @returns {string}
 */
export function renderGlossaryPage(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const cssHref = opts.cssHref ?? "../usdastyle.css";
  const taxonomyCssHref = opts.taxonomyCssHref ?? "../taxonomy.css";
  const appScriptHref = opts.appScriptHref ?? "../assets/glossary-app.js";
  const totalTerms =
    typeof opts.totalTerms === "number" && Number.isFinite(opts.totalTerms)
      ? opts.totalTerms
      : 0;
  const title = opts.title ?? "Soil Taxonomy Glossary & Diagnostic Features";

  const initialCount =
    totalTerms > 0
      ? `Loading ${totalTerms.toLocaleString("en-US")} terms...`
      : "0 terms";

  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head>`,
    `  <meta charset="utf-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1">`,
    `  ${renderPwaHeadTags("../")}`,
    `  <title>${escapeHtml(title)}</title>`,
    `  <link rel="stylesheet" href="${escapeHtml(cssHref)}">`,
    `  <link rel="stylesheet" href="${escapeHtml(taxonomyCssHref)}">`,
    `</head>`,
    `<body class="cUSDABackground">`,
    `  <div id="glossary-app" class="taxonomy-page cLightBody">`,
    `    <nav class="osd-chrome no-print" aria-label="Primary navigation">`,
    `      <div class="taxonomy-nav-links">`,
    `        <a class="osd-home-link" href="../index.html">All Series</a>`,
    `        <a class="osd-home-link" href="../taxonomy/index.html">Taxonomy Tree</a>`,
    `      </div>`,
    `      <span>USDA-NRCS Soil Taxonomy Reference</span>`,
    `    </nav>`,
    `    <header class="taxonomy-header">`,
    `      <h1 class="osd-title">${escapeHtml(title)}</h1>`,
    `      <p class="taxonomy-subtitle">Search diagnostic horizons, soil materials, and Soil Survey terminology from Keys to Soil Taxonomy (2014) and NCSS glossary sources.</p>`,
    `    </header>`,
    `    <section class="glossary-toolbar" aria-label="Glossary search and filters">`,
    `      <div class="glossary-control">`,
    `        <label for="glossary-search">Search:</label>`,
    `        <input`,
    `          id="glossary-search"`,
    `          class="glossary-search-input"`,
    `          type="search"`,
    `          name="q"`,
    `          placeholder="Filter terms or definitions..."`,
    `          autocomplete="off"`,
    `        >`,
    `      </div>`,
    `      <div class="glossary-control">`,
    `        <label for="glossary-group">Group:</label>`,
    `        <select id="glossary-group" class="glossary-group-select" name="group">`,
    `          <option value="">All groups</option>`,
    `        </select>`,
    `      </div>`,
    `      <div class="glossary-toolbar-actions">`,
    `        <button id="glossary-clear" class="glossary-clear-btn" type="button">Clear</button>`,
    `        <span id="glossary-count" class="glossary-count" role="status" aria-live="polite">${escapeHtml(initialCount)}</span>`,
    `      </div>`,
    `    </section>`,
    `    <main aria-label="Glossary entries">`,
    `      <div id="glossary-list" class="glossary-list"></div>`,
    `    </main>`,
    `    <footer class="osd-footer footertable">`,
    `      <div>USDA-NRCS National Cooperative Soil Survey &mdash; Soil Taxonomy Glossary &amp; Diagnostic Features</div>`,
    `    </footer>`,
    `  </div>`,
    `  <script type="module" src="${escapeHtml(appScriptHref)}"></script>`,
    `  ${renderSwRegisterScript("../")}`,
    `</body>`,
    `</html>`,
    ``,
  ].join("\n");
}
