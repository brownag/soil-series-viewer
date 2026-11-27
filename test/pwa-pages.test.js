import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderHomePage } from "../src/render/home-page.js";
import { renderTaxonomyPage } from "../src/render/taxonomy-page.js";
import { renderGlossaryPage } from "../src/render/glossary-page.js";
import { initHomeApp } from "../src/client/home-app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME_CSS_PATH = path.resolve(__dirname, "../src/styles/home.css");
const HOME_APP_PATH = path.resolve(__dirname, "../src/client/home-app.js");

test("renderHomePage includes PWA head tags, ./sw.js registration, and #fulltext-search-panel", () => {
  const html = renderHomePage();

  assert.match(html, /<link rel="manifest" href="\.\/manifest\.json">/);
  assert.match(html, /<meta name="theme-color" content="#1a472a">/);
  assert.match(html, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);

  assert.match(html, /<details id="fulltext-search-panel" class="home-fulltext-panel">/);
  assert.match(html, /<summary>Full-Text OSD Search<\/summary>/);
  assert.match(html, /id="fulltext-search-input"[^>]*data-fulltext-input/);
  assert.match(html, /id="fulltext-search-clear"[^>]*data-fulltext-clear/);
  assert.match(html, /id="fulltext-search-status"[^>]*data-fulltext-status/);
  assert.match(html, /id="fulltext-search-results"[^>]*data-fulltext-results/);

  // Ensure head tags appear before </head> and SW registration appears before </body>
  const headEnd = html.indexOf("</head>");
  const bodyEnd = html.indexOf("</body>");
  assert.ok(html.indexOf('rel="manifest"') < headEnd);
  assert.ok(html.indexOf("./sw.js") < bodyEnd);
});

test("renderTaxonomyPage includes PWA head tags and ../sw.js registration", () => {
  const html = renderTaxonomyPage({ totalSeries: 100, classifiedSeries: 90 });

  assert.match(html, /<link rel="manifest" href="\.\.\/manifest\.json">/);
  assert.match(html, /<meta name="theme-color" content="#1a472a">/);
  assert.match(html, /navigator\.serviceWorker\.register\("\.\.\/sw\.js"\)/);

  const headEnd = html.indexOf("</head>");
  const bodyEnd = html.indexOf("</body>");
  assert.ok(html.indexOf('rel="manifest"') < headEnd);
  assert.ok(html.indexOf("../sw.js") < bodyEnd);
});

test("renderGlossaryPage includes PWA head tags and ../sw.js registration", () => {
  const html = renderGlossaryPage({ totalTerms: 50 });

  assert.match(html, /<link rel="manifest" href="\.\.\/manifest\.json">/);
  assert.match(html, /<meta name="theme-color" content="#1a472a">/);
  assert.match(html, /navigator\.serviceWorker\.register\("\.\.\/sw\.js"\)/);

  const headEnd = html.indexOf("</head>");
  const bodyEnd = html.indexOf("</body>");
  assert.ok(html.indexOf('rel="manifest"') < headEnd);
  assert.ok(html.indexOf("../sw.js") < bodyEnd);
});

test("src/styles/home.css defines fulltext panel/results styles with balanced braces", async () => {
  const css = await fs.readFile(HOME_CSS_PATH, "utf8");
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  assert.equal(openBraces, closeBraces, "home.css braces must be balanced");

  for (const selector of [
    ".home-fulltext-panel",
    ".home-fulltext-body",
    ".fulltext-controls",
    ".fulltext-status",
    ".fulltext-results",
    ".fulltext-results-list",
    ".fulltext-result-item",
    ".fulltext-result-link",
  ]) {
    assert.ok(css.includes(selector), `expected ${selector} in home.css`);
  }
});

test("src/client/home-app.js has zero node:* imports and wires #fulltext-search-panel when present", async () => {
  const src = await fs.readFile(HOME_APP_PATH, "utf8");
  assert.doesNotMatch(src, /from\s+["']node:/);
  assert.doesNotMatch(src, /import\s+["']node:/);

  class MockNode {
    constructor(tag, id = "") {
      this.tagName = tag.toUpperCase();
      this.id = id;
      this.children = [];
      this.listeners = new Map();
      this.value = "";
      this.textContent = "";
      this.innerHTML = "";
      this.hidden = false;
    }
    setAttribute() {}
    appendChild(c) {
      this.children.push(c);
      return c;
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    removeEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      this.listeners.set(
        type,
        list.filter((item) => item !== fn)
      );
    }
    dispatch(type) {
      for (const fn of this.listeners.get(type) || []) {
        fn({ target: this });
      }
    }
  }

  const galleryGrid = new MockNode("div", "gallery-grid");
  const inputEl = new MockNode("input", "fulltext-search-input");
  const statusEl = new MockNode("div", "fulltext-search-status");
  const resultsEl = new MockNode("div", "fulltext-search-results");
  const clearBtn = new MockNode("button", "fulltext-search-clear");

  const panelEl = new MockNode("details", "fulltext-search-panel");
  panelEl.querySelector = (selector) => {
    if (selector.includes("input")) return inputEl;
    if (selector.includes("status") || selector.includes("role='status'")) return statusEl;
    if (selector.includes("results")) return resultsEl;
    if (selector.includes("clear") || selector.includes("reset")) return clearBtn;
    return null;
  };

  const doc = {
    getElementById(id) {
      if (id === "gallery-grid") return galleryGrid;
      if (id === "fulltext-search-panel") return panelEl;
      return null;
    },
    createElement(tag) {
      return new MockNode(tag);
    },
    createDocumentFragment() {
      return new MockNode("#FRAGMENT");
    },
  };

  const mockPagefind = {
    async search(query) {
      return {
        results: [
          {
            async data() {
              return {
                url: "./OSD_Docs/A/AMADOR.html",
                excerpt: `Has <mark>${query}</mark> horizon`,
                meta: { series: "AMADOR" },
              };
            },
          },
        ],
      };
    },
  };

  const ctrl = await initHomeApp(doc, { HOME_APP_PAGEFIND: mockPagefind });
  assert.ok(ctrl);
  assert.ok(ctrl.fulltext);
  assert.equal(statusEl.textContent, "Full-text OSD search ready.");

  await ctrl.fulltext.runSearch("argillic");
  assert.equal(statusEl.textContent, 'Found 1 matching OSD page for "argillic".');
  assert.ok(resultsEl.innerHTML.includes("AMADOR"));
  assert.ok(resultsEl.innerHTML.includes("<mark>argillic</mark>"));

  ctrl.destroy();
});
