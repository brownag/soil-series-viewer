import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderTaxonomyPage } from "../src/render/taxonomy-page.js";
import {
  initTaxonomyApp,
  renderCriteriaHtml,
  renderMemberSeriesCardHtml,
  renderTaxonCardHtml,
  resolveTaxonPath,
} from "../src/client/taxonomy-app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAXONOMY_APP_PATH = path.resolve(__dirname, "../src/client/taxonomy-app.js");
const TAXONOMY_CSS_PATH = path.resolve(__dirname, "../src/styles/taxonomy.css");

function makeSampleTree() {
  return {
    totalSeries: 10,
    classifiedSeries: 8,
    orders: [
      {
        name: "Alfisols",
        slug: "alfisols",
        rank: "order",
        code: "J",
        count: 3,
        children: [
          {
            name: "Xeralfs",
            slug: "xeralfs",
            rank: "suborder",
            code: "JD",
            count: 3,
            children: [
              {
                name: "Haploxeralfs",
                slug: "haploxeralfs",
                rank: "greatgroup",
                code: "JDF",
                count: 3,
                children: [
                  {
                    name: "Typic Haploxeralfs",
                    slug: "typic-haploxeralfs",
                    rank: "subgroup",
                    code: "JDFF",
                    count: 3,
                    children: [
                      {
                        name: "Fine, smectitic, mesic Typic Haploxeralfs",
                        slug: "fine-smectitic-mesic-typic-haploxeralfs",
                        rank: "family",
                        code: null,
                        count: 2,
                        series: [
                          { k: "BETA", n: "BETA", l: "B", s: "Established" },
                          { k: "GAMMA", n: "Gamma", l: "G", s: "Tentative" },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "Inceptisols",
        slug: "inceptisols",
        rank: "order",
        code: "K",
        count: 5,
        children: [],
      },
    ],
  };
}

test("src/client/taxonomy-app.js has zero Node-only imports", async () => {
  const src = await fs.readFile(TAXONOMY_APP_PATH, "utf8");

  assert.doesNotMatch(src, /from\s+["']node:/);
  assert.doesNotMatch(src, /import\s+["']node:/);
  assert.doesNotMatch(src, /require\s*\(/);
  assert.doesNotMatch(src, /\bprocess\b/);
  assert.doesNotMatch(src, /\bBuffer\b/);
  assert.match(src, /typeof document !== "undefined"/);
});

test("src/styles/taxonomy.css exists, is non-empty, has balanced braces, and defines required classes", async () => {
  const css = await fs.readFile(TAXONOMY_CSS_PATH, "utf8");
  assert.ok(css.length > 0, "taxonomy.css should not be empty");

  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  assert.equal(openBraces, closeBraces, "CSS braces must be balanced");
  assert.ok(openBraces >= 15, "expected multiple CSS rules");

  for (const token of [
    "--usda-chrome-bg",
    "--usda-surface-bg",
    "--usda-table-header-bg",
    "--usda-link",
    "1100px",
    ".tax-page",
    ".tax-nav",
    ".tax-breadcrumbs",
    ".tax-criteria-box",
    ".tax-grid",
    ".tax-card",
    ".tax-series-grid",
    ".tax-series-card",
    ".glossary-controls",
    ".glossary-list",
    ".glossary-card",
  ]) {
    assert.ok(css.includes(token), `expected taxonomy.css to include ${token}`);
  }

  assert.match(css, /@media\s*\(\s*max-width:\s*767px\s*\)/);
});

test("resolveTaxonPath resolves root, order, suborder, family, and unknown slugs", () => {
  const tree = makeSampleTree();

  // Root (empty / "#" / "/")
  for (const rootHash of ["", "#", "#/", "/"]) {
    const rootRes = resolveTaxonPath(tree, rootHash);
    assert.deepEqual(rootRes.trail, []);
    assert.equal(rootRes.node, null);
    assert.equal(rootRes.children.length, 2);
    assert.deepEqual(
      rootRes.children.map((c) => c.slug),
      ["alfisols", "inceptisols"]
    );
    assert.deepEqual(rootRes.series, []);
  }

  // Order level
  const orderRes = resolveTaxonPath(tree, "#alfisols");
  assert.equal(orderRes.node?.name, "Alfisols");
  assert.equal(orderRes.trail.length, 1);
  assert.deepEqual(orderRes.trail[0], {
    name: "Alfisols",
    slug: "alfisols",
    rank: "order",
    code: "J",
    hashPath: "alfisols",
  });
  assert.equal(orderRes.children.length, 1);
  assert.equal(orderRes.children[0].slug, "xeralfs");
  assert.deepEqual(orderRes.series, []);

  // Suborder level
  const suborderRes = resolveTaxonPath(tree, "alfisols/xeralfs");
  assert.equal(suborderRes.node?.name, "Xeralfs");
  assert.equal(suborderRes.trail.length, 2);
  assert.equal(suborderRes.trail[1].hashPath, "alfisols/xeralfs");
  assert.equal(suborderRes.children[0].slug, "haploxeralfs");

  // Family level (deepest rank with series)
  const familyPath =
    "#alfisols/xeralfs/haploxeralfs/typic-haploxeralfs/fine-smectitic-mesic-typic-haploxeralfs";
  const familyRes = resolveTaxonPath(tree, familyPath);
  assert.equal(familyRes.node?.rank, "family");
  assert.equal(familyRes.trail.length, 5);
  assert.deepEqual(familyRes.children, []);
  assert.equal(familyRes.series.length, 2);
  assert.equal(familyRes.series[0].k, "BETA");

  // Unknown top-level slug
  const unknownTop = resolveTaxonPath(tree, "#nonexistent");
  assert.deepEqual(unknownTop.trail, []);
  assert.equal(unknownTop.node, null);
  assert.deepEqual(unknownTop.children, []);
  assert.deepEqual(unknownTop.series, []);

  // Unknown nested slug
  const unknownNested = resolveTaxonPath(tree, "#alfisols/missing-suborder");
  assert.equal(unknownNested.trail.length, 1);
  assert.equal(unknownNested.trail[0].slug, "alfisols");
  assert.equal(unknownNested.node, null);
  assert.deepEqual(unknownNested.children, []);
  assert.deepEqual(unknownNested.series, []);
});

test("renderCriteriaHtml formats KST 2022 criteria, escapes HTML, and handles null", () => {
  assert.equal(renderCriteriaHtml(null), "");
  assert.equal(renderCriteriaHtml(undefined), "");
  assert.equal(renderCriteriaHtml({ code: "X", clauses: [] }), "");

  const html = renderCriteriaHtml({
    code: "J",
    name: "Alfisols",
    chapter: 4,
    page: 70,
    key: "Key to Soil Orders & <Special>",
    clauses: [
      "J. Other soils that have:",
      "1. An argillic horizon <script>alert(1)</script>.",
    ],
  });

  assert.match(html, /class="tax-criteria-box"/);
  assert.ok(html.includes("Chapter 4, p. 70 — Key to Soil Orders &amp; &lt;Special&gt;"));
  assert.ok(html.includes("Alfisols (J)"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.doesNotMatch(html, /<script>/);
});

test("renderTaxonCardHtml renders link, rank badge, optional KST code, count, and escapes HTML", () => {
  const withCode = renderTaxonCardHtml(
    {
      name: "Xeralfs",
      slug: "xeralfs",
      rank: "suborder",
      code: "JD",
      count: 142,
    },
    "alfisols"
  );

  assert.match(withCode, /<a class="tax-card" href="#alfisols\/xeralfs"/);
  assert.match(withCode, /class="tax-card-rank"[^>]*>Suborder<\/span>/);
  assert.match(withCode, /class="tax-card-code"[^>]*>JD<\/span>/);
  assert.ok(withCode.includes("Xeralfs"));
  assert.ok(withCode.includes("142 series"));

  const withoutCodeEscaped = renderTaxonCardHtml({
    name: `Fine, <mixed> "Order"`,
    slug: "fine-mixed-order",
    rank: "family",
    code: null,
    count: 1,
  });

  assert.match(withoutCodeEscaped, /href="#fine-mixed-order"/);
  assert.doesNotMatch(withoutCodeEscaped, /tax-card-code/);
  assert.ok(withoutCodeEscaped.includes("Fine, &lt;mixed&gt; &quot;Order&quot;"));
  assert.ok(withoutCodeEscaped.includes("1 series"));
});

test("renderMemberSeriesCardHtml renders OSD link, 32x84 SVG strip, series name, status, and escapes HTML", () => {
  const html = renderMemberSeriesCardHtml(
    {
      k: "MT._AIRY",
      n: "MT. AIRY",
      l: "M",
      s: "Established",
    },
    [
      { t: 0, b: 18, hex: "#5a4636", n: "Ap" },
      { t: 18, b: 60, hex: "#8b6d52", n: "Bw" },
    ]
  );

  assert.match(html, /<a class="tax-series-card" href="\.\.\/OSD_Docs\/M\/MT\._AIRY\.html"/);
  assert.match(html, /<svg[^>]+width="32"[^>]+height="84"/);
  assert.match(html, /#5a4636/);
  assert.ok(html.includes("MT. AIRY"));
  assert.ok(html.includes("Established"));

  const xssHtml = renderMemberSeriesCardHtml({
    k: "BAD<KEY>?1#2",
    n: `<img src=x onerror=alert(1)>`,
    l: "B",
    s: `<script>x</script>`,
  });

  assert.doesNotMatch(xssHtml, /<script>/);
  assert.doesNotMatch(xssHtml, /<img/);
  assert.match(xssHtml, /href="\.\.\/OSD_Docs\/B\/BAD%3CKEY%3E%3F1%232\.html"/);
  assert.ok(xssHtml.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(xssHtml.includes("&lt;script&gt;x&lt;/script&gt;"));
});

test("renderTaxonomyPage renders complete HTML5 page with USDA chrome, nav links, containers, and module script", () => {
  const html = renderTaxonomyPage({
    totalSeries: 26123,
    classifiedSeries: 25400,
  });

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/usdastyle\.css">/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/taxonomy\.css">/);
  assert.match(html, /<a href="\.\.\/index\.html">All Series<\/a>/);
  assert.match(html, /<a href="\.\.\/glossary\/index\.html">Glossary &amp; Features<\/a>/);
  assert.match(html, /<main id="taxonomy-app"/);
  for (const id of [
    "tax-breadcrumbs",
    "tax-status",
    "tax-criteria",
    "tax-children",
    "tax-series",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `expected mount container #${id}`);
  }
  assert.ok(html.includes("25,400 classified of 26,123 series"));
  assert.match(html, /<script type="module" src="\.\.\/assets\/taxonomy-app\.js"><\/script>/);

  const customHtml = renderTaxonomyPage({
    cssHref: "/static/usdastyle.css",
    taxonomyCssHref: "/static/taxonomy.css",
    appScriptHref: "/static/taxonomy-app.js",
  });
  assert.match(customHtml, /href="\/static\/usdastyle\.css"/);
  assert.match(customHtml, /href="\/static\/taxonomy\.css"/);
  assert.match(customHtml, /src="\/static\/taxonomy-app\.js"/);
});

function createMockTaxonomyDom() {
  const elements = new Map();
  for (const id of [
    "taxonomy-app",
    "tax-breadcrumbs",
    "tax-status",
    "tax-criteria",
    "tax-children",
    "tax-series",
  ]) {
    elements.set(id, {
      id,
      innerHTML: "",
      textContent: "",
      hidden: false,
    });
  }
  return {
    elements,
    document: {
      getElementById(id) {
        return elements.get(id) || null;
      },
    },
  };
}

test("initTaxonomyApp fetches tree/criteria, responds to hashchange, gracefully handles missing criteria, and lazily loads strip shards", async () => {
  const tree = makeSampleTree();
  const { elements, document } = createMockTaxonomyDom();
  const listeners = new Map();
  const mockWin = {
    location: { hash: "" },
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };

  const fetchedUrls = [];
  const mockFetch = async (url) => {
    fetchedUrls.push(url);
    if (url === "../data/taxonomy-tree.json") {
      return {
        ok: true,
        async json() {
          return tree;
        },
      };
    }
    if (url === "../data/kst-criteria.json") {
      // Simulate missing criteria file
      return { ok: false, status: 404 };
    }
    if (url === "../data/strips/B.json") {
      return {
        ok: true,
        async json() {
          return {
            BETA: [{ t: 0, b: 30, hex: "#3d2f24", n: "Ap" }],
          };
        },
      };
    }
    if (url === "../data/strips/G.json") {
      return {
        ok: true,
        async json() {
          return {
            GAMMA: [{ t: 0, b: 25, hex: "#7a5c43", n: "A" }],
          };
        },
      };
    }
    return { ok: false, status: 404 };
  };

  const controller = await initTaxonomyApp({
    document,
    window: mockWin,
    fetch: mockFetch,
  });

  assert.ok(controller);
  assert.ok(fetchedUrls.includes("../data/taxonomy-tree.json"));
  assert.ok(fetchedUrls.includes("../data/kst-criteria.json"));
  assert.ok(elements.get("tax-children").innerHTML.includes("Alfisols"));
  assert.equal(elements.get("tax-criteria").hidden, true);
  assert.equal(elements.get("tax-series").hidden, true);

  // Navigate to family leaf with series
  mockWin.location.hash =
    "#alfisols/xeralfs/haploxeralfs/typic-haploxeralfs/fine-smectitic-mesic-typic-haploxeralfs";
  listeners.get("hashchange")();

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(fetchedUrls.includes("../data/strips/B.json"));
  assert.ok(fetchedUrls.includes("../data/strips/G.json"));
  assert.equal(elements.get("tax-series").hidden, false);
  assert.ok(elements.get("tax-series").innerHTML.includes("BETA"));
  assert.ok(elements.get("tax-series").innerHTML.includes("GAMMA"));
  assert.ok(elements.get("tax-series").innerHTML.includes("#3d2f24"));
  assert.ok(elements.get("tax-series").innerHTML.includes("#7a5c43"));
  assert.ok(elements.get("tax-breadcrumbs").innerHTML.includes("Typic Haploxeralfs"));

  controller.destroy();
  assert.equal(listeners.size, 0);
});

test("initTaxonomyApp renders KST criteria box when kst-criteria.json is present", async () => {
  const tree = makeSampleTree();
  const { elements, document } = createMockTaxonomyDom();
  const mockWin = {
    location: { hash: "#alfisols" },
    addEventListener() {},
    removeEventListener() {},
  };

  const controller = await initTaxonomyApp({
    document,
    window: mockWin,
    fetch: async (url) => {
      if (url === "../data/taxonomy-tree.json") {
        return { ok: true, async json() { return tree; } };
      }
      if (url === "../data/kst-criteria.json") {
        return {
          ok: true,
          async json() {
            return {
              J: {
                code: "J",
                name: "Alfisols",
                chapter: 4,
                page: 70,
                key: "Key to Soil Orders",
                clauses: ["J. Other soils that have an argillic horizon."],
              },
            };
          },
        };
      }
      return { ok: false, status: 404 };
    },
  });

  assert.ok(controller);
  assert.equal(elements.get("tax-criteria").hidden, false);
  assert.ok(elements.get("tax-criteria").innerHTML.includes("Chapter 4, p. 70 — Key to Soil Orders"));
  assert.ok(elements.get("tax-criteria").innerHTML.includes("J. Other soils that have an argillic horizon."));
  controller.destroy();
});
