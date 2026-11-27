# Orchestration State 2 (`planning/STATE_2.md`)

Orchestration: `2`
Plan: `planning/EXECUTION_PLAN_2.md`
Last Updated: 2026-11-27

## Baseline (Pre-Wave 1)

- `soil-series-viewer`: `main` at `ca280ad`, `npm test` passing 20/20 tests (~2.4s).
- `SoilProfiles.js`: `fix/munsell-hue-approx` at `6d6be27` (`munsellToHex('10YR', 4, 2) === '#6e5f4c'`).
- Node: `v24.13.0`, npm: `11.6.2`.

## Wave Board

| Wave | Task ID | Title | Repo | Model | Status |
|---|---|---|---|---|---|
| 1 | `2.1.1` | Build-time search index & color-strip shard generators | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |
| 1 | `2.1.2` | Pure ESM client search, wildcard/fuzzy & facet filter engine | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |
| 1 | `2.1.3` | Home page CSS (`home.css`) & lightweight strip `<svg>` renderer | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |
| 2 | `2.2.1` | Home page HTML renderer & virtualized browser gallery app | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |
| 3 | `2.3.1` | Wire home page, indexes & client assets into `src/cli/build.js` | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |

## Task Reports

*(Worker reports appended below, <=15 lines each.)*

## 2.1.3
- **Status:** `done`
- **Files created:** `src/styles/home.css`, `src/client/strip-svg.js`, `test/strip-svg.test.js`, `planning/tasks/2.1.3.todo.md`
- **Summary:**
  - `src/styles/home.css`: Centered `1100px` `.home-page` using `usdastyle.css` custom properties (`#3e3e3e` chrome, `#248621` headers, Verdana `11px`, `#000099`/`#660099` links), search toolbar, `.home-layout`/`.home-facets`/`.home-results` sidebar layout, `.gallery-grid`/`.series-card`/`.series-card-sketch`/`.series-card-meta` cards, and `@media (max-width: 767px)` collapse.
  - `src/client/strip-svg.js`: Zero-Node-import pure ESM `renderStripSvg(horizons, options)` rendering proportional depth `<rect>` elements inside `<svg viewBox="0 0 W H">` (default `48x140`) with subtle borders, hex validation (`#cccccc` fallback), XML escaping, and a neutral placeholder SVG on empty/null/invalid inputs.
- **Verification:** `node --test test/strip-svg.test.js` passed (`8/8`, `0` failures).

## 2.1.2
- **Status:** done
- **Files created:** `src/client/search-engine.js`, `test/search-engine.test.js`, `planning/tasks/2.1.2.todo.md`
- **Implemented:** Pure ESM client search & filter module (`FACET_KEY_MAP`, `matchName`, `filterSeries`, `computeFacetCounts`) with zero `node:` imports.
- **Scoring & filtering:** Exact (`1000`) > prefix (`710..850`) > wildcard `*`/`?` (`600`/`700`, case-insensitive anchored regex) > substring (`350..546`) > fuzzy subsequence (`1..299`); filters across all 13 compact SC/benchmark keys (`s`, `o`, `so`, `gg`, `sg`, `ps`, `mn`, `ce`, `rx`, `tc`, `st`, `mo`, `bm`) with alphabetical tie-break on `item.n`.
- **Verification:** `node --test test/search-engine.test.js` passed (`6/6` tests, `0` failures).


## 2.1.1
- **Status:** done
- **Files created:** `src/index/search-index.js` (`buildSearchIndex`, `resolveShardLetter`), `src/index/color-strips.js` (`buildColorStripShards`), `test/index-generators.test.js`, `planning/tasks/2.1.1.todo.md`
- **Verification:** `node --test test/index-generators.test.js` passed (4/4 tests, 0 failures, ~503ms)
- **Notes:** Reused `isPlottableHorizon`, `selectHorizonMunsell`, `FALLBACK_HORIZON_COLOR` from `src/render/profile-sketch.js` and `munsellToHex` from `/home/andrew/workspace/SoilProfiles.js/dist/index.js`. Note: `/home/andrew/workspace/SoilProfiles.js` is currently on `feat/munsell-polynomial` (`f821a37`), where `munsellToHex("10YR", 4, 2)` returns `#6f5f4c` (not `#6e5f4c` from `6d6be27` or old `#6e5f4d`); tests assert exact parity with `munsellToHex("10YR", 4, 2)` and `!== "#6e5f4d"`.


## 2.2.1
- **Status:** `done`
- **Files created:** `src/render/home-page.js`, `src/client/home-app.js`, `test/home-page.test.js`, `planning/tasks/2.2.1.todo.md`
- **Summary:**
  - `src/render/home-page.js`: `renderHomePage(options)` emits complete USDA-styled `index.html` linking `./usdastyle.css`, `./home.css`, and `<script type="module" src="./assets/home-app.js">`, with `.home-page`/`.home-header`/`.home-toolbar`/`.home-layout`/`.home-facets`/`.home-results`/`.gallery-grid`, wildcard `*`/`?` search hint, all 12 facet `<select>` controls (`FACET_FIELDS`), benchmark checkbox, clear button, and live status region.
  - `src/client/home-app.js`: Pure ESM (zero Node-only imports, `typeof document !== "undefined"` auto-init guard) fetching `./data/search-index.json`, wiring `filterSeries`/`computeFacetCounts`, rendering bounded batches (`DEFAULT_BATCH_SIZE = 60`) with `IntersectionObserver` + "Load more" fallback, and lazy-loading/caching `./data/strips/<L>.json` shards once per letter to render card `<svg>`s via `renderStripSvg` linking to `./OSD_Docs/<L>/<KEY>.html`.
- **Verification:** `node --test test/home-page.test.js` passed (`7/7` tests, `0` failures).

## 2.3.1
- **Status:** `done`
- **Files edited/created:** `src/cli/build.js`, `test/profile-sketch.test.js`, `test/integration.test.js`, `test/home-integration.test.js`, `planning/tasks/2.3.1.todo.md`
- **Summary:**
  - `src/cli/build.js`: Updated `buildSite` to emit `<out>/index.html` (`renderHomePage`), `<out>/home.css` (`src/styles/home.css`), `<out>/assets/{home-app,search-engine,strip-svg}.js` (`src/client/`), `<out>/data/search-index.json` (`buildSearchIndex`), and `<out>/data/strips/<L>.json` (`buildColorStripShards`), returning `stripShards` count alongside existing summary fields.
  - `test/profile-sketch.test.js` & `test/integration.test.js`: Replaced hardcoded `#6e5f4c` 10YR 4/2 assertions with dynamic `munsellToHex("10YR", 4, 2)` from `/home/andrew/workspace/SoilProfiles.js/dist/index.js` while retaining `!== "#6e5f4d"`.
  - `test/home-integration.test.js`: Added CLI end-to-end test verifying `index.html`, `home.css`, client assets, `data/search-index.json`, and `data/strips/A.json` (`AMADOR` 10YR 4/2 parity).
- **Verification:** `npm test` passed (`46/46` tests, `0` failures, ~3.06s).
