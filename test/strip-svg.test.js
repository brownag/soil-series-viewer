import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  DEFAULT_STRIP_OPTIONS,
  PLACEHOLDER_FILL,
  renderStripSvg,
} from "../src/client/strip-svg.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const homeCssPath = join(__dirname, "..", "src", "styles", "home.css");
const stripSvgPath = join(__dirname, "..", "src", "client", "strip-svg.js");

const homeCss = readFileSync(homeCssPath, "utf8");
const stripSvgSource = readFileSync(stripSvgPath, "utf8");

test("home.css exists, is non-empty, and has balanced braces", () => {
  assert.ok(homeCss.length > 0, "home.css should not be empty");
  const openBraces = (homeCss.match(/\{/g) || []).length;
  const closeBraces = (homeCss.match(/\}/g) || []).length;
  assert.equal(openBraces, closeBraces, "CSS braces must be balanced");
  assert.ok(openBraces >= 15, "expected multiple CSS rules in home.css");
});

test("home.css uses usdastyle.css palette tokens, typography, and 1100px home container", () => {
  const requiredTokens = [
    "--usda-chrome-bg",
    "--usda-surface-bg",
    "--usda-table-header-bg",
    "--usda-table-border",
    "--usda-link",
    "--usda-link-visited",
    "--usda-font-chrome",
    "--usda-font-chrome-size",
    "#3e3e3e",
    "#248621",
    "Verdana",
    "11px",
    "#000099",
    "#660099",
  ];
  for (const token of requiredTokens) {
    assert.ok(
      homeCss.toLowerCase().includes(token.toLowerCase()),
      `expected home.css to reference token ${token}`
    );
  }

  assert.match(homeCss, /\.home-page\s*\{[\s\S]*?max-width:\s*1100px/);
  assert.match(homeCss, /\.home-page\s*\{[\s\S]*?margin:\s*0 auto/);
  assert.match(
    homeCss,
    /\.home-page\s*\{[\s\S]*?background-color:\s*(?:var\(--usda-surface-bg[^)]*\)|#ffffff)/i
  );
});

test("home.css defines toolbar, facet sidebar, gallery grid, card classes, and 767px collapse", () => {
  const requiredClasses = [
    ".home-page",
    ".home-header",
    ".home-toolbar",
    ".home-search-input",
    ".home-layout",
    ".home-facets",
    ".home-results",
    ".gallery-grid",
    ".series-card",
    ".series-card-sketch",
    ".series-card-meta",
  ];
  for (const cls of requiredClasses) {
    assert.ok(homeCss.includes(cls), `expected class ${cls} in home.css`);
  }

  assert.match(
    homeCss,
    /@media\s*\(\s*max-width:\s*767px\s*\)\s*\{[\s\S]*?\.home-layout\s*\{[\s\S]*?flex-direction:\s*column/
  );
  assert.match(
    homeCss,
    /@media\s*\(\s*max-width:\s*767px\s*\)\s*\{[\s\S]*?\.home-facets\s*\{[\s\S]*?width:\s*100%/
  );
});

test("strip-svg.js contains zero Node-only imports", () => {
  assert.doesNotMatch(stripSvgSource, /\bfrom\s+["']node:/);
  assert.doesNotMatch(stripSvgSource, /\bimport\s*\(\s*["']node:/);
  assert.doesNotMatch(stripSvgSource, /\bimport\s+["']node:/);
  assert.doesNotMatch(stripSvgSource, /\brequire\s*\(/);
  assert.doesNotMatch(stripSvgSource, /\bprocess\./);
});

test("renderStripSvg renders proportional depth rectangles with default 48x140 viewBox", () => {
  assert.equal(DEFAULT_STRIP_OPTIONS.width, 48);
  assert.equal(DEFAULT_STRIP_OPTIONS.height, 140);

  const svg = renderStripSvg([
    { t: 0, b: 20, hex: "#6e5f4c", n: "A" },
    { t: 20, b: 60, hex: "#8e6f4e", n: "Bt" },
    { t: 60, b: 100, hex: "#c3ad75", n: "C" },
  ]);

  assert.match(svg, /^<svg\b/);
  assert.match(svg, /viewBox="0 0 48 140"/);
  assert.match(svg, /width="48"/);
  assert.match(svg, /height="140"/);
  assert.match(svg, /y="0"[^>]*height="28"[^>]*fill="#6e5f4c"/);
  assert.match(svg, /y="28"[^>]*height="56"[^>]*fill="#8e6f4e"/);
  assert.match(svg, /y="84"[^>]*height="56"[^>]*fill="#c3ad75"/);
  assert.match(svg, /stroke="/);
  assert.match(svg, /<title>A \(0-20 cm\)<\/title>/);
  assert.match(svg, /<\/svg>$/);
});

test("renderStripSvg supports custom dimensions, top/bottom keys, and invalid hex fallback", () => {
  const svg = renderStripSvg(
    [
      { top: 0, bottom: 25, color: "not-a-color", name: "Ap" },
      { top: 25, bottom: 100, hex: "#725d51", name: "B" },
    ],
    { width: 64, height: 200, label: "Custom strip" }
  );

  assert.match(svg, /viewBox="0 0 64 200"/);
  assert.match(svg, /width="64"/);
  assert.match(svg, /height="200"/);
  assert.match(svg, /aria-label="Custom strip"/);
  assert.match(svg, /y="0"[^>]*width="64"[^>]*height="50"[^>]*fill="#cccccc"/);
  assert.match(svg, /y="50"[^>]*width="64"[^>]*height="150"[^>]*fill="#725d51"/);
});

test("renderStripSvg returns a clean neutral placeholder SVG when horizons are empty, null, or invalid", () => {
  for (const input of [
    [],
    null,
    undefined,
    [{ t: 30, b: 10, hex: "#6e5f4c" }],
    [{ t: null, b: 20, hex: "#6e5f4c" }],
  ]) {
    const svg = renderStripSvg(input);
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /viewBox="0 0 48 140"/);
    assert.match(svg, /strip-svg-placeholder/);
    assert.ok(svg.includes(`fill="${PLACEHOLDER_FILL}"`));
    assert.doesNotMatch(svg, /#6e5f4c/);
  }
});

test("renderStripSvg escapes XML special characters in horizon names and label", () => {
  const svg = renderStripSvg(
    [{ t: 0, b: 10, hex: "#6e5f4c", n: 'A<1>&"test"' }],
    { label: 'Strip "1" & <test>' }
  );

  assert.doesNotMatch(svg, /<1>/);
  assert.doesNotMatch(svg, /<test>/);
  assert.ok(svg.includes("&lt;1&gt;"));
  assert.ok(svg.includes("&amp;"));
  assert.ok(svg.includes("&quot;test&quot;"));
});
