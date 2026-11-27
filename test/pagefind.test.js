import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPagefindMetaHtml, runPagefind } from "../src/index/pagefind.js";
import {
  DEFAULT_UNAVAILABLE_MESSAGE,
  initFullTextSearch,
  loadPagefind,
  renderFullTextResultsHtml,
  searchFullText,
} from "../src/client/fulltext-search.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FULLTEXT_CLIENT_PATH = path.resolve(__dirname, "../src/client/fulltext-search.js");

test("src/client/fulltext-search.js has zero Node-only imports", async () => {
  const src = await fs.readFile(FULLTEXT_CLIENT_PATH, "utf8");

  assert.doesNotMatch(src, /from\s+["']node:/);
  assert.doesNotMatch(src, /import\s+["']node:/);
  assert.doesNotMatch(src, /require\s*\(/);
  assert.doesNotMatch(src, /\bprocess\b/);
  assert.doesNotMatch(src, /\bBuffer\b/);
});

test("buildPagefindMetaHtml emits hidden Pagefind meta/filter spans and skips empty values", () => {
  const html = buildPagefindMetaHtml({
    key: "AMADOR",
    name: "AMADOR",
    status: "Established",
    sc: {
      soilseriesname: "AMADOR",
      taxorder: "Inceptisols",
      areasymbol: "CA",
      soilseriesstatus: "Established",
    },
  });

  assert.match(html, /hidden/);
  assert.ok(html.includes('<span data-pagefind-meta="series">AMADOR</span>'));
  assert.ok(html.includes('<span data-pagefind-filter="order">Inceptisols</span>'));
  assert.ok(html.includes('<span data-pagefind-filter="state">CA</span>'));
  assert.ok(html.includes('<span data-pagefind-filter="status">Established</span>'));

  const partial = buildPagefindMetaHtml({
    key: "PARTIAL",
    name: "PARTIAL",
    status: "",
    sc: {
      taxorder: null,
      areasymbol: "  ",
    },
  });

  assert.ok(partial.includes('<span data-pagefind-meta="series">PARTIAL</span>'));
  assert.doesNotMatch(partial, /data-pagefind-filter="order"/);
  assert.doesNotMatch(partial, /data-pagefind-filter="state"/);
  assert.doesNotMatch(partial, /data-pagefind-filter="status"/);

  assert.equal(buildPagefindMetaHtml(null), "");
  assert.equal(buildPagefindMetaHtml({}), "");
});

test("buildPagefindMetaHtml safely escapes HTML special characters", () => {
  const html = buildPagefindMetaHtml({
    name: `O'NEILL <"test"> & Co`,
    status: `Tentative & "Review"`,
    sc: {
      taxorder: `<Order>`,
      areasymbol: `C&A`,
    },
  });

  assert.doesNotMatch(html, /<Order>/);
  assert.ok(
    html.includes(
      '<span data-pagefind-meta="series">O&#39;NEILL &lt;&quot;test&quot;&gt; &amp; Co</span>'
    )
  );
  assert.ok(html.includes('<span data-pagefind-filter="order">&lt;Order&gt;</span>'));
  assert.ok(html.includes('<span data-pagefind-filter="state">C&amp;A</span>'));
  assert.ok(
    html.includes(
      '<span data-pagefind-filter="status">Tentative &amp; &quot;Review&quot;</span>'
    )
  );
});

test("runPagefind supports custom runner success and missing-binary fallback without throwing", async () => {
  let receivedOutDir = null;
  const okResult = await runPagefind({
    outDir: "/tmp/example-site",
    async runner(dir) {
      receivedOutDir = dir;
      return { ok: true, indexedPages: 42 };
    },
  });

  assert.equal(receivedOutDir, "/tmp/example-site");
  assert.equal(okResult.ok, true);
  assert.equal(okResult.skipped, false);
  assert.equal(okResult.indexedPages, 42);

  const missingResult = await runPagefind({
    outDir: "/tmp/example-site",
    async runner() {
      const err = new Error("spawn pagefind ENOENT");
      err.code = "ENOENT";
      throw err;
    },
  });

  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.skipped, true);
  assert.match(missingResult.reason, /ENOENT/);

  const nonZeroResult = await runPagefind({
    outDir: "/tmp/example-site",
    async runner() {
      return {
        code: 1,
        stderr: 'npx canceled due to missing packages and no YES option: ["pagefind"]',
      };
    },
  });

  assert.equal(nonZeroResult.ok, false);
  assert.equal(nonZeroResult.skipped, true);
  assert.match(nonZeroResult.reason, /missing packages/);

  await assert.rejects(() => runPagefind({ outDir: "" }), TypeError);
});

test("runPagefind default CLI runner gracefully skips when pagefind binary is unavailable", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagefind-test-"));
  try {
    const result = await runPagefind({ outDir: tmpDir });
    // Either pagefind is installed locally (ok: true) or gracefully skipped (ok: false, skipped: true)
    if (result.ok) {
      assert.equal(result.skipped, false);
    } else {
      assert.equal(result.skipped, true);
      assert.ok(typeof result.reason === "string" && result.reason.length > 0);
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("loadPagefind dynamically imports module, calls init(), and returns null on missing module", async () => {
  const missing = await loadPagefind("./non-existent-pagefind-module-12345.js");
  assert.equal(missing, null);
  assert.equal(await loadPagefind(""), null);

  const dataModuleUrl =
    "data:text/javascript," +
    encodeURIComponent(
      "export let initialized = false;" +
        "export async function init() { initialized = true; }" +
        "export async function search(q) { return { results: [{ data: async () => ({ url: '/a.html', excerpt: q, meta: { title: 'A' } }) }] }; }"
    );
  const pf = await loadPagefind(dataModuleUrl);
  assert.ok(pf);
  assert.equal(pf.initialized, true);
  const res = await searchFullText(pf, "argillic");
  assert.equal(res.length, 1);
  assert.equal(res[0].title, "A");
});

test("searchFullText handles empty queries, missing pagefind, result limiting, and metadata mapping", async () => {
  assert.deepEqual(await searchFullText(null, "mollic"), []);
  assert.deepEqual(
    await searchFullText({ search: async () => ({ results: [] }) }, "   "),
    []
  );

  const searchCalls = [];
  const dataCalls = [];
  const mockPagefind = {
    async search(query) {
      searchCalls.push(query);
      return {
        results: [
          {
            async data() {
              dataCalls.push(0);
              return {
                url: "./OSD_Docs/A/AMADOR.html",
                excerpt: "Moderately deep <mark>argillic</mark> or cambic horizon.",
                meta: { series: "AMADOR", order: "Inceptisols", state: "CA" },
              };
            },
          },
          {
            async data() {
              dataCalls.push(1);
              return {
                url: "./OSD_Docs/M/MT._AIRY.html",
                excerpt: "Formed in <mark>micaceous</mark> schist.",
                meta: { title: "MT. AIRY Series", order: "Inceptisols", state: "MD" },
              };
            },
          },
          {
            async data() {
              dataCalls.push(2);
              return {
                url: "./OSD_Docs/K/KANA@A.html",
                excerpt: "Should be truncated by limit.",
                meta: { series: "KANA`A" },
              };
            },
          },
        ],
      };
    },
  };

  const results = await searchFullText(mockPagefind, "  argillic  ", { limit: 2 });
  assert.deepEqual(searchCalls, ["argillic"]);
  assert.deepEqual(dataCalls, [0, 1]);
  assert.deepEqual(results, [
    {
      url: "./OSD_Docs/A/AMADOR.html",
      title: "AMADOR",
      excerpt: "Moderately deep <mark>argillic</mark> or cambic horizon.",
      meta: { series: "AMADOR", order: "Inceptisols", state: "CA" },
    },
    {
      url: "./OSD_Docs/M/MT._AIRY.html",
      title: "MT. AIRY Series",
      excerpt: "Formed in <mark>micaceous</mark> schist.",
      meta: { title: "MT. AIRY Series", order: "Inceptisols", state: "MD" },
    },
  ]);

  assert.deepEqual(await searchFullText(mockPagefind, "argillic", { limit: 0 }), []);
});

test("renderFullTextResultsHtml renders clickable links, preserves <mark> tags, and escapes XSS", () => {
  assert.equal(renderFullTextResultsHtml([], ""), "");
  const emptyHtml = renderFullTextResultsHtml([], `<script>alert(1)</script>`);
  assert.doesNotMatch(emptyHtml, /<script>/);
  assert.ok(emptyHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));

  const html = renderFullTextResultsHtml(
    [
      {
        url: "./OSD_Docs/A/AMADOR.html",
        title: "AMADOR",
        excerpt:
          'Loamy <mark>argillic</mark> & <script>alert(1)</script> <mark onclick="bad()">fake</mark>',
        meta: { series: "AMADOR", order: "Inceptisols", state: "CA", status: "Established" },
      },
      {
        url: "javascript:alert(1)",
        title: `<img src=x onerror="alert(1)">`,
        excerpt: "Plain <mark>soil</mark> excerpt",
        meta: { order: `<b>Entisols</b>` },
      },
    ],
    "argillic"
  );

  assert.match(html, /<ul class="fulltext-results-list">/);
  assert.ok(
    html.includes('<a class="fulltext-result-link" href="./OSD_Docs/A/AMADOR.html">AMADOR</a>')
  );
  assert.ok(html.includes("<mark>argillic</mark>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<mark onclick=/);
  assert.ok(html.includes('&lt;mark onclick=&quot;bad()&quot;&gt;fake</mark>'));
  assert.ok(html.includes('href="#"'));
  assert.doesNotMatch(html, /javascript:alert/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<b>Entisols<\/b>/);
  assert.ok(html.includes("&lt;b&gt;Entisols&lt;/b&gt;"));
});

function createMockFullTextRoot() {
  class MockNode {
    constructor(tag, attrs = {}) {
      this.tagName = tag.toUpperCase();
      this.attrs = attrs;
      this.value = "";
      this.textContent = "";
      this.innerHTML = "";
      this.listeners = new Map();
    }

    addEventListener(type, fn) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, []);
      }
      this.listeners.get(type).push(fn);
    }

    removeEventListener(type, fn) {
      const list = this.listeners.get(type);
      if (!list) return;
      this.listeners.set(
        type,
        list.filter((entry) => entry !== fn)
      );
    }

    dispatch(type) {
      for (const fn of this.listeners.get(type) || []) {
        fn({ target: this });
      }
    }
  }

  const inputEl = new MockNode("input");
  const statusEl = new MockNode("div");
  const resultsEl = new MockNode("div");
  const clearBtn = new MockNode("button");

  const rootEl = {
    querySelector(selector) {
      if (selector.includes("input")) return inputEl;
      if (selector.includes("status") || selector.includes("role='status'")) return statusEl;
      if (selector.includes("results")) return resultsEl;
      if (selector.includes("clear") || selector.includes("reset")) return clearBtn;
      return null;
    },
  };

  return { rootEl, inputEl, statusEl, resultsEl, clearBtn };
}

test("initFullTextSearch wires input, clear button, and unavailable index messaging", async () => {
  assert.equal(await initFullTextSearch(null), null);

  // Unavailable index case
  const unavailableDom = createMockFullTextRoot();
  const unavailableCtrl = await initFullTextSearch(unavailableDom.rootEl, {
    loader: async () => null,
    debounceMs: 0,
  });
  assert.equal(unavailableDom.statusEl.textContent, DEFAULT_UNAVAILABLE_MESSAGE);
  assert.equal(unavailableCtrl.getPagefind(), null);

  // Available index case
  const dom = createMockFullTextRoot();
  const mockPf = {
    async search(query) {
      return {
        results: [
          {
            async data() {
              return {
                url: "./OSD_Docs/A/AMADOR.html",
                excerpt: `Contains <mark>${query}</mark> horizon.`,
                meta: { series: "AMADOR", order: "Inceptisols" },
              };
            },
          },
        ],
      };
    },
  };

  const ctrl = await initFullTextSearch(dom.rootEl, {
    pagefind: mockPf,
    debounceMs: 0,
  });

  assert.equal(dom.statusEl.textContent, "Full-text OSD search ready.");
  dom.inputEl.value = "mollic";
  dom.inputEl.dispatch("input");
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(dom.statusEl.textContent, 'Found 1 matching OSD page for "mollic".');
  assert.ok(dom.resultsEl.innerHTML.includes('<a class="fulltext-result-link" href="./OSD_Docs/A/AMADOR.html">AMADOR</a>'));
  assert.ok(dom.resultsEl.innerHTML.includes("<mark>mollic</mark>"));

  dom.clearBtn.dispatch("click");
  assert.equal(dom.inputEl.value, "");
  assert.equal(dom.resultsEl.innerHTML, "");
  ctrl.destroy();
});
