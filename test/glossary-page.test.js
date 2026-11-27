import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderGlossaryPage } from "../src/render/glossary-page.js";
import {
  filterGlossaryTerms,
  initGlossaryApp,
  renderGlossaryCardHtml,
} from "../src/client/glossary-app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOSSARY_APP_PATH = path.resolve(__dirname, "../src/client/glossary-app.js");

const SAMPLE_TERMS = [
  {
    id: "mollic-epipedon",
    term: "Mollic Epipedon",
    group: "Diagnostic Surface Horizons",
    chapter: 3,
    page: 7,
    definition: "A thick, dark-colored surface horizon rich in organic matter and base saturation.",
    sources: ["SKB-KST-2014", "DST"],
  },
  {
    id: "argillic-horizon",
    term: "Argillic Horizon",
    group: "Diagnostic Subsurface Horizons",
    chapter: 3,
    page: 14,
    definition: "A subsurface horizon with illuvial accumulation of silicate clay.",
    sources: ["SKB-KST-2014"],
  },
  {
    id: "pedon",
    term: "Pedon",
    group: "Glossary",
    chapter: null,
    page: null,
    definition: "The smallest volume that can be called a soil, with dark or light surface horizons.",
    sources: ["DST"],
  },
];

test("src/client/glossary-app.js has zero Node-only imports", async () => {
  const src = await fs.readFile(GLOSSARY_APP_PATH, "utf8");

  assert.doesNotMatch(src, /from\s+["']node:/);
  assert.doesNotMatch(src, /import\s+["']node:/);
  assert.doesNotMatch(src, /require\s*\(/);
  assert.doesNotMatch(src, /\bprocess\b/);
  assert.doesNotMatch(src, /\bBuffer\b/);
  assert.match(src, /typeof document !== "undefined"/);
  assert.match(src, /glossary-app/);
});

test("filterGlossaryTerms filters by query (term and definition), group, and combined criteria", () => {
  assert.equal(filterGlossaryTerms(SAMPLE_TERMS).length, 3);
  assert.deepEqual(filterGlossaryTerms(null), []);

  // Query matching term (case-insensitive)
  const byTerm = filterGlossaryTerms(SAMPLE_TERMS, { query: "  mollic " });
  assert.deepEqual(
    byTerm.map((t) => t.id),
    ["mollic-epipedon"]
  );

  // Query matching definition across multiple entries
  const byDefinition = filterGlossaryTerms(SAMPLE_TERMS, { query: "SILICATE CLAY" });
  assert.deepEqual(
    byDefinition.map((t) => t.id),
    ["argillic-horizon"]
  );

  const bySharedDefWord = filterGlossaryTerms(SAMPLE_TERMS, { query: "dark" });
  assert.deepEqual(
    bySharedDefWord.map((t) => t.id),
    ["mollic-epipedon", "pedon"]
  );

  // Exact group filter
  const byGroup = filterGlossaryTerms(SAMPLE_TERMS, { group: "Glossary" });
  assert.deepEqual(
    byGroup.map((t) => t.id),
    ["pedon"]
  );

  // Partial group name must NOT match (exact group filter)
  assert.deepEqual(
    filterGlossaryTerms(SAMPLE_TERMS, { group: "Diagnostic" }),
    []
  );

  // Combined query + group filter
  const combined = filterGlossaryTerms(SAMPLE_TERMS, {
    query: "dark",
    group: "Diagnostic Surface Horizons",
  });
  assert.deepEqual(
    combined.map((t) => t.id),
    ["mollic-epipedon"]
  );
});

test("renderGlossaryCardHtml renders chapter/page, omits missing chapter/page, and escapes HTML", () => {
  const withRef = renderGlossaryCardHtml(SAMPLE_TERMS[0]);
  assert.match(withRef, /<article class="glossary-card" id="mollic-epipedon">/);
  assert.match(withRef, /<h2>Mollic Epipedon<\/h2>/);
  assert.ok(withRef.includes("Diagnostic Surface Horizons"));
  assert.ok(withRef.includes("Ch. 3, p. 7"));
  assert.ok(withRef.includes("SKB-KST-2014"));
  assert.ok(withRef.includes("DST"));
  assert.match(
    withRef,
    /<p>A thick, dark-colored surface horizon rich in organic matter and base saturation\.<\/p>/
  );

  const withoutRef = renderGlossaryCardHtml(SAMPLE_TERMS[2]);
  assert.match(withoutRef, /<article class="glossary-card" id="pedon">/);
  assert.match(withoutRef, /<h2>Pedon<\/h2>/);
  assert.doesNotMatch(withoutRef, /Ch\./);
  assert.doesNotMatch(withoutRef, /p\.\s*\d/);
  assert.ok(withoutRef.includes("DST"));

  const xssHtml = renderGlossaryCardHtml({
    id: `bad"id<1>`,
    term: `<script>alert("xss")</script>`,
    group: `Group & <tag>`,
    chapter: 4,
    page: 12,
    definition: `Contains <img src=x onerror="alert(1)"> & 'quotes'`,
    sources: [`<b>SRC</b>`],
  });
  assert.doesNotMatch(xssHtml, /<script>/);
  assert.doesNotMatch(xssHtml, /<img/);
  assert.doesNotMatch(xssHtml, /<b>/);
  assert.ok(xssHtml.includes('id="bad&quot;id&lt;1&gt;"'));
  assert.ok(xssHtml.includes("<h2>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</h2>"));
  assert.ok(xssHtml.includes("Group &amp; &lt;tag&gt;"));
  assert.ok(xssHtml.includes("Ch. 4, p. 12"));
  assert.ok(
    xssHtml.includes(
      "<p>Contains &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quotes&#39;</p>"
    )
  );
  assert.ok(xssHtml.includes("&lt;b&gt;SRC&lt;/b&gt;"));
});

test("renderGlossaryPage renders complete HTML5 page with USDA chrome, nav links, controls, and module script", () => {
  const html = renderGlossaryPage({ totalTerms: 136 });

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/usdastyle\.css">/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/taxonomy\.css">/);
  assert.match(html, /class="cUSDABackground"/);
  assert.match(html, /class="osd-chrome/);
  assert.match(html, /id="glossary-app"/);

  // Nav links
  assert.match(html, /<a[^>]+href="\.\.\/index\.html"[^>]*>All Series<\/a>/);
  assert.match(html, /<a[^>]+href="\.\.\/taxonomy\/index\.html"[^>]*>Taxonomy Tree<\/a>/);

  // Controls and containers
  assert.match(html, /<input[^>]+id="glossary-search"/);
  assert.match(html, /<select[^>]+id="glossary-group"/);
  assert.match(html, /<button[^>]+id="glossary-clear"/);
  assert.match(html, /id="glossary-count"/);
  assert.match(html, /id="glossary-list"/);
  assert.ok(html.includes("136"));

  // Module script
  assert.match(
    html,
    /<script type="module" src="\.\.\/assets\/glossary-app\.js"><\/script>/
  );

  // Custom options override defaults and escape HTML
  const customHtml = renderGlossaryPage({
    cssHref: "/custom/usda.css",
    taxonomyCssHref: "/custom/tax.css",
    appScriptHref: "/custom/glossary.js",
    totalTerms: 0,
  });
  assert.match(customHtml, /<link rel="stylesheet" href="\/custom\/usda\.css">/);
  assert.match(customHtml, /<link rel="stylesheet" href="\/custom\/tax\.css">/);
  assert.match(customHtml, /<script type="module" src="\/custom\/glossary\.js"><\/script>/);
  assert.ok(customHtml.includes("0 terms"));
});

function createMockGlossaryDom() {
  class MockElement {
    constructor(tagName, id = "") {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.value = "";
      this.textContent = "";
      this._innerHTML = "";
      this.children = [];
      this.listeners = new Map();
      this.scrolledIntoView = false;
    }

    appendChild(child) {
      this.children.push(child);
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

    scrollIntoView() {
      this.scrolledIntoView = true;
    }

    set innerHTML(html) {
      this._innerHTML = String(html);
      if (html === "") {
        this.children = [];
      }
    }

    get innerHTML() {
      return this._innerHTML;
    }
  }

  const elements = new Map([
    ["glossary-app", new MockElement("div", "glossary-app")],
    ["glossary-search", new MockElement("input", "glossary-search")],
    ["glossary-group", new MockElement("select", "glossary-group")],
    ["glossary-clear", new MockElement("button", "glossary-clear")],
    ["glossary-count", new MockElement("span", "glossary-count")],
    ["glossary-list", new MockElement("div", "glossary-list")],
  ]);

  const doc = {
    getElementById(id) {
      if (elements.has(id)) {
        return elements.get(id);
      }
      const listEl = elements.get("glossary-list");
      if (listEl && listEl.innerHTML.includes(`id="${id}"`)) {
        const anchorTarget = new MockElement("article", id);
        elements.set(id, anchorTarget);
        return anchorTarget;
      }
      return null;
    },
    createElement(tag) {
      return new MockElement(tag);
    },
  };

  return { doc, elements };
}

test("initGlossaryApp fetches glossary.json, populates groups, binds controls, and scrolls to hash", async () => {
  const { doc, elements } = createMockGlossaryDom();
  const fetchedUrls = [];

  const controller = await initGlossaryApp({
    document: doc,
    location: { hash: "#argillic-horizon" },
    async fetch(url) {
      fetchedUrls.push(url);
      return {
        ok: true,
        async json() {
          return {
            totalTerms: SAMPLE_TERMS.length,
            groups: [
              "Diagnostic Subsurface Horizons",
              "Diagnostic Surface Horizons",
              "Glossary",
            ],
            terms: SAMPLE_TERMS,
          };
        },
      };
    },
  });

  assert.deepEqual(fetchedUrls, ["../data/glossary.json"]);
  assert.equal(controller.state.terms.length, 3);

  // Group select populated with "All groups" + 3 groups
  const groupSelect = elements.get("glossary-group");
  assert.equal(groupSelect.children.length, 4);
  assert.equal(groupSelect.children[0].value, "");
  assert.equal(groupSelect.children[1].value, "Diagnostic Subsurface Horizons");

  // Initial list & count rendered
  const listEl = elements.get("glossary-list");
  const countEl = elements.get("glossary-count");
  assert.equal(countEl.textContent, "Showing 3 terms");
  assert.ok(listEl.innerHTML.includes('id="mollic-epipedon"'));
  assert.ok(listEl.innerHTML.includes('id="argillic-horizon"'));

  // Hash target scrolled into view
  assert.equal(elements.get("argillic-horizon")?.scrolledIntoView, true);

  // Filter by search input
  const searchInput = elements.get("glossary-search");
  searchInput.value = "silicate";
  searchInput.dispatch("input");
  assert.equal(countEl.textContent, "Showing 1 of 3 terms");
  assert.ok(listEl.innerHTML.includes('id="argillic-horizon"'));
  assert.ok(!listEl.innerHTML.includes('id="mollic-epipedon"'));

  // Filter by group change
  searchInput.value = "";
  groupSelect.value = "Glossary";
  groupSelect.dispatch("change");
  assert.equal(countEl.textContent, "Showing 1 of 3 terms");
  assert.ok(listEl.innerHTML.includes('id="pedon"'));

  // Clear button resets search & group
  elements.get("glossary-clear").dispatch("click");
  assert.equal(searchInput.value, "");
  assert.equal(groupSelect.value, "");
  assert.equal(countEl.textContent, "Showing 3 terms");
});
