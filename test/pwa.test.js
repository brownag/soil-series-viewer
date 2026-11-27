import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STATIC_PATHS,
  DEFAULT_DYNAMIC_PATHS,
  buildWebManifest,
  buildServiceWorker,
  renderPwaHeadTags,
  renderSwRegisterScript,
} from "../src/pwa/generate-pwa.js";

test("DEFAULT_STATIC_PATHS and DEFAULT_DYNAMIC_PATHS include expected assets", () => {
  assert.ok(Array.isArray(DEFAULT_STATIC_PATHS));
  assert.ok(Array.isArray(DEFAULT_DYNAMIC_PATHS));
  assert.ok(DEFAULT_STATIC_PATHS.includes(""));
  assert.ok(DEFAULT_STATIC_PATHS.includes("index.html"));
  assert.ok(DEFAULT_STATIC_PATHS.includes("manifest.json"));
  assert.ok(DEFAULT_STATIC_PATHS.includes("styles/usdastyle.css"));
  assert.ok(DEFAULT_STATIC_PATHS.includes("client/fulltext-search.js"));
  assert.ok(DEFAULT_STATIC_PATHS.includes("client/profile-interactive.js"));
  assert.ok(DEFAULT_STATIC_PATHS.includes("taxonomy/index.html"));
  assert.ok(DEFAULT_STATIC_PATHS.includes("glossary/index.html"));

  assert.deepEqual(DEFAULT_DYNAMIC_PATHS, [
    "data/search-index.json",
    "data/taxonomy-tree.json",
    "data/kst-criteria.json",
    "data/glossary.json",
  ]);
});

test("buildWebManifest returns valid pretty-printed JSON with required PWA fields", () => {
  const jsonText = buildWebManifest();
  assert.ok(jsonText.includes("\n"), "manifest should be pretty-printed");

  const manifest = JSON.parse(jsonText);
  assert.equal(manifest.name, "Official Soil Series Descriptions");
  assert.equal(manifest.short_name, "Soil OSD");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#1a472a");
  assert.equal(manifest.background_color, "#ffffff");
  assert.equal(manifest.prefer_related_applications, false);
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  assert.equal(manifest.icons[0].type, "image/svg+xml");
  assert.ok(manifest.icons[0].src.startsWith("data:image/svg+xml,"));
});

test("buildWebManifest supports custom overrides", () => {
  const manifest = JSON.parse(
    buildWebManifest({
      name: "Custom Viewer",
      shortName: "Custom",
      themeColor: "#000000",
    })
  );
  assert.equal(manifest.name, "Custom Viewer");
  assert.equal(manifest.short_name, "Custom");
  assert.equal(manifest.theme_color, "#000000");
  assert.equal(manifest.background_color, "#ffffff");
});

test("buildServiceWorker emits syntactically valid JS with BASE URL, cache version, and paths", () => {
  const swSource = buildServiceWorker({
    cacheVersion: "v42-test",
    staticPaths: ["", "index.html", "styles/home.css"],
    dynamicPaths: ["data/search-index.json"],
  });

  // Must parse cleanly as JavaScript
  assert.doesNotThrow(() => new Function(swSource));

  assert.ok(swSource.includes('const CACHE_VERSION = "v42-test";'));
  assert.ok(swSource.includes("const BASE = new URL('./', self.location).href;"));
  assert.ok(swSource.includes('"styles/home.css"'));
  assert.ok(swSource.includes('"data/search-index.json"'));
  assert.ok(swSource.includes("self.addEventListener('install'"));
  assert.ok(swSource.includes("self.addEventListener('activate'"));
  assert.ok(swSource.includes("self.addEventListener('fetch'"));
  assert.ok(swSource.includes("caches.delete(name)"));
  assert.ok(swSource.includes("function networkFirst("));
  assert.ok(swSource.includes("function fetchAndCache("));
});

test("buildServiceWorker defaults to v1 and default static/dynamic paths", () => {
  const swSource = buildServiceWorker();
  assert.doesNotThrow(() => new Function(swSource));
  assert.ok(swSource.includes('const CACHE_VERSION = "v1";'));
  assert.ok(swSource.includes('"client/profile-interactive.js"'));
  assert.ok(swSource.includes('"data/glossary.json"'));
});

test("renderPwaHeadTags renders manifest link and theme-color meta at ./, ../, and ../../", () => {
  assert.equal(
    renderPwaHeadTags(),
    '<link rel="manifest" href="./manifest.json">\n  <meta name="theme-color" content="#1a472a">'
  );
  assert.equal(
    renderPwaHeadTags("./"),
    '<link rel="manifest" href="./manifest.json">\n  <meta name="theme-color" content="#1a472a">'
  );
  assert.equal(
    renderPwaHeadTags("../"),
    '<link rel="manifest" href="../manifest.json">\n  <meta name="theme-color" content="#1a472a">'
  );
  assert.equal(
    renderPwaHeadTags("../../"),
    '<link rel="manifest" href="../../manifest.json">\n  <meta name="theme-color" content="#1a472a">'
  );
});

test("renderSwRegisterScript renders valid registration script at ./, ../, and ../../", () => {
  for (const prefix of ["./", "../", "../../"]) {
    const html = renderSwRegisterScript(prefix);
    assert.ok(html.startsWith("<script>"));
    assert.ok(html.endsWith("</script>"));
    assert.ok(html.includes("'serviceWorker' in navigator"));
    assert.ok(html.includes("window.addEventListener('load'"));
    assert.ok(html.includes(`${prefix}sw.js`));

    const scriptBody = html.replace(/^<script>\n?/, "").replace(/\n?<\/script>$/, "");
    assert.doesNotThrow(() => new Function(scriptBody));
  }

  // Default prefix is ./
  assert.ok(renderSwRegisterScript().includes("./sw.js"));
});
