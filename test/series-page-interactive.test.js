import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpus } from "../src/loader/index.js";
import { renderSeriesPage } from "../src/render/series-page.js";
import { renderProfileSketch } from "../src/render/profile-sketch.js";
import { renderCompetingPanel, buildFamilyIndex } from "../src/render/competing-panel.js";
import { renderQaNotes } from "../src/qa/detect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.resolve(__dirname, "../src/styles/usdastyle.css");

test("renderSeriesPage includes Pagefind body, meta/filter attributes, and ignore markers", async () => {
  const { records } = await loadCorpus({ seriesFilter: ["AMADOR", "AUBURN", "EXCHEQUER"] });
  const amador = records.find((r) => r.key === "AMADOR");
  assert.ok(amador, "AMADOR record should load");

  const familyIndex = buildFamilyIndex(records);
  const competingPanelHtml =
    renderCompetingPanel(amador, familyIndex) ||
    '  <section class="osd-section osd-competing-panel" id="same-family-series">Competing</section>';
  const qaNotesHtml = renderQaNotes([
    { code: "QA-TEST", severity: "info", summary: "Synthetic QA note for testing" },
  ]);

  const html = renderSeriesPage(amador, {
    sketchSvg: renderProfileSketch(amador)?.svg ?? null,
    competingPanelHtml,
    qaNotesHtml,
  });

  // Top nav bar marked with data-pagefind-ignore
  assert.match(html, /<nav class="osd-chrome no-print"[^>]*data-pagefind-ignore/);

  // Main OSD content wrapper marked with data-pagefind-body covering header + NSSH sections
  const bodyMatch = html.match(/<div class="osd-content" data-pagefind-body>([\s\S]*?)<\/article>\s*<\/div>/);
  assert.ok(bodyMatch, "expected .osd-content wrapper with data-pagefind-body around header and article");
  assert.ok(bodyMatch[1].includes('<header class="osd-header">'));
  assert.ok(bodyMatch[1].includes('<article class="osd-narrative">'));

  // Hidden Pagefind metadata and filters inside data-pagefind-body
  assert.match(bodyMatch[1], /<span data-pagefind-meta="series">AMADOR<\/span>/);
  assert.match(bodyMatch[1], /<span data-pagefind-filter="order">Inceptisols<\/span>/);
  assert.match(bodyMatch[1], /<span data-pagefind-filter="state">CA<\/span>/);
  assert.match(bodyMatch[1], /<span data-pagefind-filter="status">Established<\/span>/);

  // QA notes and competing-series panel wrapped with data-pagefind-ignore
  assert.match(
    html,
    /<div[^>]*data-pagefind-ignore[^>]*>\s*<section class="osd-section osd-competing-panel" id="same-family-series">/
  );
  assert.match(
    html,
    /<div[^>]*data-pagefind-ignore[^>]*>\s*<details class="osd-qa-notes no-print">/
  );
});

test("renderSeriesPage embeds valid #osd-profile-data JSON, compare controls, and PWA tags", async () => {
  const { records } = await loadCorpus({ seriesFilter: ["AMADOR"] });
  const amador = records[0];
  const html = renderSeriesPage(amador, {
    sketchSvg: renderProfileSketch(amador)?.svg ?? null,
  });

  // Embedded profile JSON script
  const dataMatch = html.match(
    /<script type="application\/json" id="osd-profile-data">([\s\S]*?)<\/script>/
  );
  assert.ok(dataMatch, "expected #osd-profile-data JSON script tag");
  const parsed = JSON.parse(dataMatch[1]);
  assert.equal(parsed.key, "AMADOR");
  assert.equal(parsed.name, "AMADOR");
  assert.ok(Array.isArray(parsed.horizons) && parsed.horizons.length === 4);
  assert.equal(parsed.horizons[0].name, "A");
  assert.equal(parsed.horizons[0].munsell, "10YR 4/2");

  // Compare toggle button and tray container (both .no-print and data-pagefind-ignore)
  assert.match(
    html,
    /<button[^>]*id="osd-compare-toggle"[^>]*class="[^"]*no-print[^"]*"[^>]*data-pagefind-ignore[^>]*>Pin to Compare<\/button>/
  );
  assert.match(
    html,
    /<section[^>]*id="osd-compare-tray"[^>]*class="[^"]*no-print[^"]*"[^>]*data-pagefind-ignore[^>]*hidden><\/section>/
  );

  // Client interactive module script
  assert.match(
    html,
    /<script type="module" src="\.\.\/\.\.\/client\/profile-interactive\.js"><\/script>/
  );

  // PWA manifest link, theme-color meta, and sw.js registration
  assert.match(html, /<link rel="manifest" href="\.\.\/\.\.\/manifest\.json">/);
  assert.match(html, /<meta name="theme-color" content="#1a472a">/);
  assert.match(html, /navigator\.serviceWorker\.register\("\.\.\/\.\.\/sw\.js"\)/);
});

test("renderSeriesPage escapes < in #osd-profile-data JSON to prevent script-tag injection", () => {
  const html = renderSeriesPage({
    key: "XSS_JSON",
    name: "</script><script>alert(1)</script>",
    sc: { taxclname: "Typic <Haploxerepts>" },
    horizons: [],
  });

  const dataMatch = html.match(
    /<script type="application\/json" id="osd-profile-data">([\s\S]*?)<\/script>/
  );
  assert.ok(dataMatch);
  assert.ok(!dataMatch[1].includes("<"), "raw '<' must be escaped as \\u003c");
  assert.ok(dataMatch[1].includes("\\u003c"));
  const parsed = JSON.parse(dataMatch[1]);
  assert.equal(parsed.name, "</script><script>alert(1)</script>");
  assert.equal(parsed.taxclname, "Typic <Haploxerepts>");
});

test("usdastyle.css defines interactive tooltip and comparison styles hidden in print", async () => {
  const css = await fs.readFile(CSS_PATH, "utf8");
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  assert.equal(openBraces, closeBraces, "CSS braces must remain balanced");

  for (const selector of [
    ".osd-horizon-tooltip",
    ".osd-compare-bar",
    ".osd-compare-tray",
    ".osd-compare-card",
    ".osd-compare-remove",
  ]) {
    assert.ok(css.includes(selector), `expected ${selector} in usdastyle.css`);
  }

  const printBlock = css.match(/@media print\s*\{([\s\S]*)\}\s*$/)?.[1] ?? "";
  for (const selector of [
    ".osd-horizon-tooltip",
    ".osd-compare-bar",
    ".osd-compare-tray",
    ".osd-compare-card",
    ".osd-compare-remove",
  ]) {
    assert.ok(printBlock.includes(selector), `expected ${selector} hidden in @media print`);
  }
});
