# Execution Plan 2 (`planning/EXECUTION_PLAN_2.md`)

Orchestration: `2`
Date: 2026-11-27
Source Goals: `planning/GOALS.md` (`G7`: Client-side search & filter, `G6`: Home page profile gallery)

## Goal & Scope

- **Goal:** Build the home page (`index.html`) for `soil-series-viewer` with instant client-side search (prefix, wildcard `*`/`?`, fuzzy) and SC facet filtering (`G7`), plus a virtualized profile gallery (`G6`) rendering lightweight `<svg>` thumbnails from precomputed, letter-sharded Munsell color strips.
- **In scope:**
  - `G7`: Build-time `data/search-index.json` generator + pure ESM client search/wildcard/fuzzy + SC facet filter engine (status, order→subgroup, family classes, state, MLRA office, benchmark flag).
  - `G6`: Build-time `data/strips/<A..Z>.json` color-strip shard generator (using `SoilProfiles.js`'s `munsellToHex` — zero hex reinvention), pure ESM lightweight `<svg>` strip renderer, home page HTML + vanilla ESM virtualized gallery app, and `home.css` (`max-width: 1100px`, `usdastyle.css` palette).
  - CLI integration in `src/cli/build.js` to emit `index.html`, `home.css`, `assets/*.js`, `data/search-index.json`, and `data/strips/<L>.json`.
- **Out of scope (deferred to later orchestrations):**
  - Interactive client-side `SoilProfiles.js` SVGs / tooltips (`G19`), Pagefind full-text search (`G8`), taxonomy tree browse pages (`G9–G11`), series cross-links (`G12`), competing-series panel (`G13`), CI/hosting/PWA (`G14–G15, G20`), full SKB-2..16 annotations (`G16`), SSURGO/PRISM/DST/RIC (`G21–G27`).
- **Verbatim constraints:**
  - "do not reinvent hex parsing in soil-series-viewer, we need to fix it upstream" (Orchestration 1 D2 — reuse `SoilProfiles.js`'s `munsellToHex`)
  - "SKB output is used as is." (§0)

## Decision Log

- **2026-11-27 (D1 — Scope):** Orchestration 2 targets Home page discovery (`G7` + `G6`).
- **2026-11-27 (D2 — Thumbnails):** Precomputed color strips (`[{t, b, hex, n}]` via `SoilProfiles.js`'s `munsellToHex` at build time) rendered as lightweight `<svg>` cards in a virtualized grid; interactive `SoilProfiles.js` SVGs deferred to `G19`.
- **2026-11-27 (D3 — Client Stack & Index Layout):** Vanilla ESM JS (zero bundler/framework) with two-tier JSON index: `data/search-index.json` (metadata + facets) + 26 letter-sharded `data/strips/<A..Z>.json` lazy-loaded on demand.
- **2026-11-27 (D4 — Layout & Workers):** `usdastyle.css` palette & typography with `max-width: 1100px` responsive home container (series pages stay `767px`). `flash` workers, escalate to `hydrogen` after 1 failed retry, max 3 concurrent workers per wave.

## Recon & Hazards

- **Baseline:** `npm test` passes 20/20 tests in ~2.4s (`main` at `ca280ad`).
- **Reusable exports from Orchestration 1:**
  - `src/loader/index.js`: `loadCorpus(options)` → `{ records, report }`, record shape `{ key, name, letter, status, sc, skb, skbPath, horizons, site, hasSc, hasSkb }`.
  - `src/render/profile-sketch.js`: `selectHorizonMunsell`, `isPlottableHorizon`, `FALLBACK_HORIZON_COLOR` (`#cccccc`).
  - `/home/andrew/workspace/SoilProfiles.js/dist/index.js`: `munsellToHex(hue, value, chroma)` (CJS module, load via `dist/index.js`).
  - `src/styles/usdastyle.css`: CSS custom properties (`--usda-chrome`, `--usda-surface`, `--usda-ink`, `--usda-header-bg`, etc.).
- **Hazards:**
  - Keep `src/client/*.js` free of Node-only imports (`node:fs`, `node:path`) so they run natively in both browsers (`<script type="module">`) and `node:test`.
  - `munsellToHex` null-coercion hazard: always validate all 3 Munsell components via `selectHorizonMunsell` before calling `munsellToHex`.

## Wave Table

| Wave | Task ID | Goal | Repo | Depends On | Files in Scope (Disjoint per Wave) |
|---|---|---|---|---|---|
| 1 | `2.1.1` | Build-time search index & color-strip shard generators | `soil-series-viewer` | — | `src/index/search-index.js`, `src/index/color-strips.js`, `test/index-generators.test.js` |
| 1 | `2.1.2` | Pure ESM client search, wildcard/fuzzy & facet filter engine | `soil-series-viewer` | — | `src/client/search-engine.js`, `test/search-engine.test.js` |
| 1 | `2.1.3` | Home page CSS (`home.css`) & lightweight strip `<svg>` renderer | `soil-series-viewer` | — | `src/styles/home.css`, `src/client/strip-svg.js`, `test/strip-svg.test.js` |
| 2 | `2.2.1` | Home page HTML renderer & virtualized browser gallery app | `soil-series-viewer` | `2.1.1`, `2.1.2`, `2.1.3` | `src/render/home-page.js`, `src/client/home-app.js`, `test/home-page.test.js` |
| 3 | `2.3.1` | Wire home page, indexes & client assets into `src/cli/build.js` | `soil-series-viewer` | `2.1.1`, `2.2.1` | `src/cli/build.js`, `test/home-integration.test.js` |

---

## Task Specs

### Task 2.1.1: Build-time search index & color-strip shard generators
- **id:** `2.1.1`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** none
- **files-in-scope:**
  - *can create:* `src/index/search-index.js`, `src/index/color-strips.js`, `test/index-generators.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `src/loader/*`, `src/render/*`, `src/cli/*`, `src/styles/*`, `docs/`.
- **spec:**
  1. Create `src/index/search-index.js` exporting `buildSearchIndex(records)`:
     - Produces `{ version: 1, total, facets, items }`.
     - Each item has compact fields: `{ k: key, n: name, l: letter, s: status, o: taxorder, so: taxsuborder, gg: taxgrtgroup, sg: taxsubgrp, ps: taxpartsize, mn: taxminalogy, ce: taxceactcl, rx: taxreaction, tc: taxtempcl, st: areasymbol, mo: mlraoffice, bm: benchmarkBoolean, hasSkb }`.
     - `facets` lists sorted unique non-null values for each filterable facet (`status`, `order`, `suborder`, `grtgroup`, `subgrp`, `partsize`, `minalogy`, `ceactcl`, `reaction`, `tempcl`, `state`, `mlraoffice`).
  2. Create `src/index/color-strips.js` exporting `buildColorStripShards(records)`:
     - Reuses `isPlottableHorizon`, `selectHorizonMunsell`, and `FALLBACK_HORIZON_COLOR` from `../render/profile-sketch.js` and `munsellToHex` from `/home/andrew/workspace/SoilProfiles.js/dist/index.js`.
     - Groups by uppercase first letter (`A`–`Z`, or `_` fallback) into `{ [letter]: { [key]: [{ t, b, hex, n }] } }`.
  3. Write `test/index-generators.test.js` verifying `AMADOR`, `MT._AIRY`, `KANA@A` index rows, facet lists, and `AMADOR` color strip (`#6e5f4c` for `10YR 4/2`, not `#6e5f4d`).
- **acceptance:** `node --test test/index-generators.test.js` passes.

### Task 2.1.2: Pure ESM client search, wildcard/fuzzy & facet filter engine
- **id:** `2.1.2`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** none
- **files-in-scope:**
  - *can create:* `src/client/search-engine.js`, `test/search-engine.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `src/loader/*`, `src/render/*`, `src/cli/*`, `src/styles/*`, `docs/`.
- **spec:**
  1. Create `src/client/search-engine.js` (zero Node-only imports; runs in browser & Node) exporting:
     - `matchName(name, query)`: supports exact/prefix (highest score), wildcard `*` and `?` (case-insensitive), substring, and subsequence fuzzy match.
     - `filterSeries(items, { query, facets })`: filters by active facet selections (`status`, `order`, `suborder`, `grtgroup`, `subgrp`, `partsize`, `minalogy`, `ceactcl`, `reaction`, `tempcl`, `state`, `mlraoffice`, `benchmark`) and ranks by `matchName` score (alphabetical tie-break).
     - `computeFacetCounts(items)`: returns per-facet value counts for the currently filtered items.
  2. Write `test/search-engine.test.js` covering prefix, wildcard (`AM*`, `A?ADOR`), fuzzy (`amdr`), multi-facet filtering, benchmark boolean filter, and facet counts.
- **acceptance:** `node --test test/search-engine.test.js` passes.

### Task 2.1.3: Home page CSS & lightweight strip `<svg>` renderer
- **id:** `2.1.3`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** none
- **files-in-scope:**
  - *can create:* `src/styles/home.css`, `src/client/strip-svg.js`, `test/strip-svg.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `src/styles/usdastyle.css`, `src/loader/*`, `src/render/*`, `src/cli/*`, `docs/`.
- **spec:**
  1. Create `src/styles/home.css` using `usdastyle.css` custom properties (`#3e3e3e` chrome, `#248621` headers, Verdana `11px`, `#000099`/`#660099` links) with `.home-page` (`max-width: 1100px`, centered, white background), search toolbar, collapsible/responsive facet sidebar (`.home-layout`, `.home-facets`, `.home-results`), gallery grid (`.gallery-grid`, `.series-card`, `.series-card-sketch`, `.series-card-meta`), and `@media (max-width: 767px)` responsive collapse.
  2. Create `src/client/strip-svg.js` (zero Node-only imports) exporting `renderStripSvg(horizons, options)`:
     - Renders a compact `<svg viewBox="0 0 W H">` (default `48x140`) with proportional depth rectangles filled with each horizon's `hex`, crisp 1px subtle borders, and a clean neutral placeholder when `horizons` is empty/missing.
  3. Write `test/strip-svg.test.js` verifying `home.css` tokens/breakpoints/brace balance and `renderStripSvg` output for multi-horizon strips and empty/null inputs.
- **acceptance:** `node --test test/strip-svg.test.js` passes.

### Task 2.2.1: Home page HTML renderer & virtualized browser gallery app
- **id:** `2.2.1`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** `2.1.1`, `2.1.2`, `2.1.3`
- **files-in-scope:**
  - *can create:* `src/render/home-page.js`, `src/client/home-app.js`, `test/home-page.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `src/loader/*`, `src/index/*`, `src/styles/*`, `src/cli/*`, `docs/`.
- **spec:**
  1. Create `src/render/home-page.js` exporting `renderHomePage(options)` returning complete `index.html`:
     - Links `./usdastyle.css` and `./home.css`.
     - USDA-style header ("Official Soil Series Descriptions & Series Classification"), search input (with wildcard `*`/`?` hint), facet `<select>` controls + benchmark checkbox + clear button, status/count bar, and gallery mount container.
     - Loads `<script type="module" src="./assets/home-app.js"></script>`.
  2. Create `src/client/home-app.js` (zero Node-only imports):
     - Fetches `./data/search-index.json`, populates facet dropdowns, wires input/change listeners to `filterSeries` from `./search-engine.js`.
     - Renders cards in a windowed/virtualized grid (e.g. batch/window rendering + `IntersectionObserver` / scroll windowing so 26k results never freeze the DOM).
     - Lazy-loads `./data/strips/<L>.json` once per needed letter shard (cached in memory) and renders each visible card's `<svg>` via `renderStripSvg` from `./strip-svg.js`, linking to `./OSD_Docs/<L>/<KEY>.html`.
  3. Write `test/home-page.test.js` verifying `renderHomePage()` HTML structure, script/style links, accessibility labels, and `home-app.js` syntax/exports.
- **acceptance:** `node --test test/home-page.test.js` passes.

### Task 2.3.1: Wire home page, indexes & client assets into `src/cli/build.js`
- **id:** `2.3.1`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** `2.1.1`, `2.2.1`
- **files-in-scope:**
  - *must edit:* `src/cli/build.js`
  - *can create:* `test/home-integration.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `src/loader/*`, `src/index/*`, `src/client/*`, `src/styles/*`, `docs/`.
- **spec:**
  1. Update `src/cli/build.js` so `buildSite` writes:
     - `<out>/index.html` (via `renderHomePage`)
     - `<out>/home.css` (copied from `src/styles/home.css`)
     - `<out>/assets/home-app.js`, `<out>/assets/search-engine.js`, `<out>/assets/strip-svg.js`
     - `<out>/data/search-index.json` (via `buildSearchIndex`)
     - `<out>/data/strips/<L>.json` (via `buildColorStripShards`)
  2. Write `test/home-integration.test.js` running `src/cli/build.js --series AMADOR,MT._AIRY,KANA@A --out <tempDir>` and verifying all home page files, JSON index validity, and `data/strips/A.json` containing `AMADOR` with `#6e5f4c`.
- **acceptance:** `npm test` (full suite) passes with 0 failures.
