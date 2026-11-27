import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FACET_FIELDS, renderHomePage } from "../src/render/home-page.js";
import {
  buildFacetOptions,
  buildSeriesHref,
  computeNextWindow,
  createStripShardLoader,
  DEFAULT_BATCH_SIZE,
  formatTaxonomySummary,
  initHomeApp,
  renderSeriesCardHtml,
} from "../src/client/home-app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME_APP_PATH = path.resolve(__dirname, "../src/client/home-app.js");

const EXPECTED_FACETS = [
  "status",
  "order",
  "suborder",
  "grtgroup",
  "subgrp",
  "partsize",
  "minalogy",
  "ceactcl",
  "reaction",
  "tempcl",
  "state",
  "mlraoffice",
];

test("renderHomePage produces complete USDA-styled HTML with required links and classes", () => {
  const html = renderHomePage();

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<link rel="stylesheet" href="\.\/usdastyle\.css">/);
  assert.match(html, /<link rel="stylesheet" href="\.\/home\.css">/);
  assert.match(html, /<script type="module" src="\.\/assets\/home-app\.js"><\/script>/);

  assert.ok(
    html.includes("Official Soil Series Descriptions &amp; Series Classification"),
    "expected USDA header title"
  );

  for (const cls of [
    "home-page",
    "home-header",
    "home-toolbar",
    "home-search-input",
    "home-status",
    "home-clear-btn",
    "home-layout",
    "home-facets",
    "home-results",
    "gallery-grid",
  ]) {
    assert.ok(html.includes(cls), `expected CSS class ${cls}`);
  }

  assert.match(html, /\*/);
  assert.match(html, /\?/);
});

test("renderHomePage includes all 12 facet selects, benchmark checkbox, clear button, and a11y labels", () => {
  const html = renderHomePage({ totalCount: 26123 });

  assert.equal(FACET_FIELDS.length, 12);
  for (const facet of EXPECTED_FACETS) {
    assert.match(
      html,
      new RegExp(`<label[^>]+for="facet-${facet}"`),
      `expected label for facet-${facet}`
    );
    assert.match(
      html,
      new RegExp(`<select[^>]+id="facet-${facet}"[^>]+data-facet="${facet}"`),
      `expected select for facet-${facet}`
    );
  }

  assert.match(html, /<input id="facet-benchmark" type="checkbox" name="benchmark" data-facet="benchmark">/);
  assert.match(html, /<label for="facet-benchmark">/);
  assert.match(html, /<label class="home-search-label" for="series-search">/);
  assert.match(html, /<input[\s\S]*id="series-search"[\s\S]*aria-describedby="series-search-hint"/);
  assert.match(html, /id="home-status"[^>]*aria-live="polite"/);
  assert.match(html, /<button id="home-clear-btn" class="home-clear-btn" type="button">/);
  assert.ok(html.includes("26,123"), "expected formatted initial series count");
});

test("src/client/home-app.js contains zero Node-only imports", async () => {
  const src = await fs.readFile(HOME_APP_PATH, "utf8");

  assert.doesNotMatch(src, /from\s+["']node:/);
  assert.doesNotMatch(src, /require\s*\(/);
  assert.doesNotMatch(src, /\bprocess\b/);
  assert.doesNotMatch(src, /\bBuffer\b/);
  assert.match(src, /typeof document !== "undefined"/);
});

test("buildSeriesHref, formatTaxonomySummary, and renderSeriesCardHtml build valid accessible cards", () => {
  const item = {
    k: "A@B",
    n: "A`B",
    l: "A",
    s: "Established",
    o: "Mollisols",
    sg: "Typic Hapludolls",
    ps: "Fine-silty",
    st: "IA",
    bm: true,
  };

  assert.equal(buildSeriesHref(item), "./OSD_Docs/A/A@B.html");
  assert.equal(formatTaxonomySummary(item), "Typic Hapludolls, Fine-silty");

  const cardHtml = renderSeriesCardHtml(item, [
    { t: 0, b: 25, hex: "#3d2f24", n: "Ap" },
    { t: 25, b: 90, hex: "#6f5f4c", n: "Bt1" },
  ]);

  assert.match(cardHtml, /class="series-card"/);
  assert.match(cardHtml, /href="\.\/OSD_Docs\/A\/A@B\.html"/);
  assert.match(cardHtml, /<svg[^>]+class="strip-svg"/);
  assert.match(cardHtml, /#3d2f24/);
  assert.match(cardHtml, /series-card-badge--benchmark/);
  assert.ok(cardHtml.includes("A`B"));

  const xssCard = renderSeriesCardHtml({
    k: "BAD<KEY>?1#2",
    n: `<script>alert("xss")</script>`,
    l: "B",
    sg: `<img src=x onerror=alert(1)>`,
  });
  assert.doesNotMatch(xssCard, /<script>/);
  assert.doesNotMatch(xssCard, /<img/);
  assert.match(xssCard, /href="\.\/OSD_Docs\/B\/BAD%3CKEY%3E%3F1%232\.html"/);
});

test("computeNextWindow and buildFacetOptions handle 26k pagination and active counts", () => {
  assert.equal(DEFAULT_BATCH_SIZE, 60);

  const first = computeNextWindow(26000, 0, 60);
  assert.deepEqual(first, { start: 0, end: 60, hasMore: true });

  const tail = computeNextWindow(125, 120, 60);
  assert.deepEqual(tail, { start: 120, end: 125, hasMore: false });

  const done = computeNextWindow(125, 125, 60);
  assert.deepEqual(done, { start: 125, end: 125, hasMore: false });

  const opts = buildFacetOptions(["Alfisols", "Mollisols"], { Mollisols: 42 }, "Entisols");
  assert.deepEqual(opts, [
    { value: "Alfisols", label: "Alfisols (0)", count: 0, selected: false },
    { value: "Mollisols", label: "Mollisols (42)", count: 42, selected: false },
    { value: "Entisols", label: "Entisols (0)", count: 0, selected: true },
  ]);
});

test("createStripShardLoader fetches each letter shard once and gracefully handles missing shards", async () => {
  const fetchCalls = [];
  const mockFetch = async (url) => {
    fetchCalls.push(url);
    if (url.endsWith("/A.json")) {
      return {
        ok: true,
        async json() {
          return {
            ANTIGO: [{ t: 0, b: 20, hex: "#5a4636", n: "Ap" }],
            ABRAHAM: [{ t: 0, b: 30, hex: "#6f5f4c", n: "A" }],
          };
        },
      };
    }
    return { ok: false, status: 404 };
  };

  const loader = createStripShardLoader(mockFetch, "./data/strips");
  const [s1, s2, s3] = await Promise.all([
    loader.getStrip("A", "ANTIGO"),
    loader.getStrip("A", "ABRAHAM"),
    loader.getStrip("Z", "ZION"),
  ]);

  assert.equal(fetchCalls.length, 2);
  assert.deepEqual(fetchCalls.sort(), ["./data/strips/A.json", "./data/strips/Z.json"]);
  assert.equal(loader.hasCachedShard("A"), true);
  assert.deepEqual(s1, [{ t: 0, b: 20, hex: "#5a4636", n: "Ap" }]);
  assert.deepEqual(s2, [{ t: 0, b: 30, hex: "#6f5f4c", n: "A" }]);
  assert.equal(s3, null);
});

function createMockDom() {
  class MockElement {
    constructor(tagName, id = "") {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.children = [];
      this.attributes = {};
      this.listeners = new Map();
      this.value = "";
      this.checked = false;
      this.hidden = false;
      this.type = "";
      this.textContent = "";
      this._innerHTML = "";
    }

    setAttribute(name, val) {
      this.attributes[name] = String(val);
    }

    appendChild(child) {
      if (child.tagName === "#FRAGMENT") {
        for (const item of child.children) {
          this.children.push(item);
        }
        child.children = [];
      } else {
        this.children.push(child);
      }
      return child;
    }

    addEventListener(type, fn) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, []);
      }
      this.listeners.get(type).push(fn);
    }

    dispatch(type) {
      for (const fn of this.listeners.get(type) || []) {
        fn({ target: this });
      }
    }

    set innerHTML(html) {
      this._innerHTML = String(html);
      if (html === "") {
        this.children = [];
        return;
      }
      const keyMatch = this._innerHTML.match(/data-series-key="([^"]*)"/);
      if (keyMatch) {
        this.firstElementChild = new MockElement("article");
        this.firstElementChild.setAttribute("data-series-key", keyMatch[1]);
        this.firstElementChild._innerHTML = this._innerHTML;
        const sketchEl = new MockElement("a");
        this.firstElementChild.querySelector = (sel) =>
          sel === ".series-card-sketch" ? sketchEl : null;
        this.firstElementChild.sketchEl = sketchEl;
      }
    }

    get innerHTML() {
      return this._innerHTML;
    }
  }

  const elements = new Map();
  for (const id of [
    "series-search",
    "home-status",
    "home-clear-btn",
    "gallery-grid",
    "home-empty-state",
    "gallery-more-wrap",
    "gallery-load-more",
    "gallery-sentinel",
    "facet-benchmark",
    ...EXPECTED_FACETS.map((f) => `facet-${f}`),
  ]) {
    const tag = id.startsWith("facet-") && id !== "facet-benchmark" ? "select" : "div";
    const el = new MockElement(tag, id);
    if (id === "facet-benchmark") {
      el.type = "checkbox";
    }
    elements.set(id, el);
  }

  const doc = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tag) {
      return new MockElement(tag);
    },
    createDocumentFragment() {
      return new MockElement("#FRAGMENT");
    },
  };

  return { doc, elements };
}

test("initHomeApp hydrates search-index, renders bounded batch, loads strip shard, and filters", async () => {
  const { doc, elements } = createMockDom();
  const sampleItems = Array.from({ length: 5 }, (_, idx) => ({
    k: idx === 0 ? "ANTIGO" : `SERIES_${idx}`,
    n: idx === 0 ? "ANTIGO" : `SERIES_${idx}`,
    l: idx === 0 ? "A" : "S",
    s: "Established",
    o: idx === 0 ? "Alfisols" : "Mollisols",
    st: idx === 0 ? "WI" : "IA",
    bm: idx === 0,
  }));

  const fetchedUrls = [];
  const mockEnv = {
    HOME_APP_BATCH_SIZE: 2,
    async fetch(url) {
      fetchedUrls.push(url);
      if (url === "./data/search-index.json") {
        return {
          ok: true,
          async json() {
            return {
              version: 1,
              total: sampleItems.length,
              facets: {
                status: ["Established"],
                order: ["Alfisols", "Mollisols"],
                state: ["IA", "WI"],
              },
              items: sampleItems,
            };
          },
        };
      }
      if (url === "./data/strips/A.json") {
        return {
          ok: true,
          async json() {
            return {
              ANTIGO: [{ t: 0, b: 15, hex: "#4a3c31", n: "Ap" }],
            };
          },
        };
      }
      return { ok: false, status: 404 };
    },
  };

  const controller = await initHomeApp(doc, mockEnv);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const grid = elements.get("gallery-grid");
  assert.equal(grid.children.length, 2, "only first batch of 2 cards should render initially");
  assert.equal(elements.get("gallery-more-wrap").hidden, false);
  assert.equal(elements.get("home-status").textContent, "Showing 5 series");
  assert.match(grid.children[0].sketchEl.innerHTML, /#4a3c31/);

  controller.renderNextBatch();
  assert.equal(grid.children.length, 4);

  const searchInput = elements.get("series-search");
  searchInput.value = "ANTI*";
  searchInput.dispatch("input");
  assert.equal(grid.children.length, 1);
  assert.equal(elements.get("home-status").textContent, "Showing 1 of 5 series");
  assert.equal(elements.get("gallery-more-wrap").hidden, true);

  elements.get("home-clear-btn").dispatch("click");
  assert.equal(searchInput.value, "");
  assert.equal(elements.get("home-status").textContent, "Showing 5 series");
  assert.ok(fetchedUrls.includes("./data/search-index.json"));
  assert.ok(fetchedUrls.includes("./data/strips/A.json"));
  controller.destroy();
});
