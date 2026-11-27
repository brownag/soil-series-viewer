# Execution Plan 3 — Series Page Enrichment (`G12`, `G13`, `G16`)

**Status:** Draft — awaiting user approval  
**Created:** 2026-11-27  
**Goals Covered:**
- `G12` — Series cross-links in `COMPETING SERIES` and `GEOGRAPHICALLY ASSOCIATED SOILS`
- `G13` — Same-family competing-series panel from SC `taxclname` with mini profile sketch strips
- `G16` — Display-side SKB/SC data-quality annotations (`<details class="osd-qa-notes no-print">`) + build-time `data/qa-report.json`

## Architecture & Locked Decisions

1. **G12 Cross-Links:** Static build-time `<a href="../<L>/<KEY>.html">` links in `COMPETING SERIES` and `GEOGRAPHICALLY ASSOCIATED SOILS` only. Matched against the loaded corpus name/key table (longest-match-first, word-boundary safe, skipping self-references and lowercase prose false positives).
2. **G13 Competing-Series Panel:** Static build-time `<section class="osd-section osd-competing-panel" id="same-family-series">` grouped by normalized SC `taxclname`. Shows up to 16 same-family peer series (excluding self, sorted alphabetically) with compact mini profile strip SVGs reusing `renderStripSvg` from `src/client/strip-svg.js`, plus a `+N more in this family` note when truncated.
3. **G16 Data-Quality Annotations & QA Report:** Display-side detection only (never mutating SKB JSON, per §0 policy). Detects `SKB-9` (missing moist color), `SKB-10` (missing horizon depths), `SKB-2`/`SKB-3`/`SKB-4` (greedy rupture/cementation regex mismatches), `SKB-5` (compound structure), `SKB-11` (`" & "` section joins), `SC-MISSING` (SKB-only), and `SKB-MISSING` (SC-only). Renders a collapsible `<details class="osd-qa-notes no-print">` on affected series pages and writes `<out>/data/qa-report.json`.
4. **Navigation polish:** Add a `← All Series` (`../../index.html`) link in `.osd-chrome` on series pages.
5. **Backwards compatibility:** All new `renderSeriesPage(record, options)` options (`linkIndex`, `competingPanelHtml`, `qaNotesHtml`) default to `null` so all 46 existing tests continue to pass unchanged.

## Task DAG & Wave Table

| Wave | Task ID | Goal | Title | Depends On | Files Owned |
|---|---|---|---|---|---|
| 1 | `3.1.1` | `G12` | Series cross-linker (`COMPETING SERIES` & `GEOGRAPHICALLY ASSOCIATED SOILS`) | — | `src/render/cross-links.js`, `test/cross-links.test.js` |
| 1 | `3.1.2` | `G13` | Same-family competing-series index & strip-SVG panel renderer | — | `src/render/competing-panel.js`, `test/competing-panel.test.js` |
| 1 | `3.1.3` | `G16` | Display-side QA issue detector, `<details>` renderer & QA report builder | — | `src/qa/detect.js`, `src/qa/report.js`, `test/qa.test.js` |
| 2 | `3.2.1` | `G12/G13/G16` | Wire cross-links, competing panel, QA notes & CSS into series pages | `3.1.1`, `3.1.2`, `3.1.3` | `src/styles/usdastyle.css`, `src/render/series-page.js`, `test/series-page.test.js`, `test/styles.test.js` |
| 3 | `3.3.1` | `G12/G13/G16` | Wire enrichment & `data/qa-report.json` into `src/cli/build.js` + E2E tests | `3.2.1` | `src/cli/build.js`, `test/enrichment-integration.test.js` |

## Task Specifications

### Wave 1

#### `3.1.1` — Series Cross-Linker (`G12`)
- **Files:** `src/render/cross-links.js`, `test/cross-links.test.js`
- **Exports:**
  - `buildSeriesLinkIndex(records)`: returns a `Map` (or structured index object) mapping normalized uppercase series names to `{ key, letter, name, href }` where `href = "../<letter>/<encodedKey>.html"`.
  - `linkSeriesNames(plainText, linkIndex, selfKey)`: HTML-escapes `plainText`, splits lines with `<br>\n`, and replaces matched series names with `<a class="osd-series-link" href="...">...</a>`.
- **Matching rules:**
  - Longest-match-first so multi-word names (e.g., `MT. AIRY`, `SAN JOAQUIN`) match before shorter prefixes.
  - Word-boundary safe (must not match inside another word).
  - Case-aware false-positive guard: only link tokens that appear in Title Case or ALL CAPS in the source text (e.g., `Amador`, `EXCHEQUER`, `Mt. Airy`), never all-lowercase common English words (e.g., `red`, `fine`, `deep`, `clay`, `sand`, `loam`).
  - Never link `selfKey` (the current series page).
- **Acceptance:** Unit tests cover single-word, multi-word, punctuation-adjacent (`Amador, Auburn, and Exchequer soils`), self-exclusion, lowercase-word non-matching, and HTML-escaping safety.

#### `3.1.2` — Same-Family Competing-Series Index & Panel Renderer (`G13`)
- **Files:** `src/render/competing-panel.js`, `test/competing-panel.test.js`
- **Exports:**
  - `buildFamilyIndex(records)`: groups records by normalized SC `taxclname` (`String(record.sc?.taxclname ?? "").trim().toLowerCase()`). Stores lightweight peer entries `{ key, letter, name, status, href, stripHorizons }` (using `buildColorStripEntry` or `selectHorizonMunsell` so each peer has plottable strip horizons).
  - `renderCompetingPanel(record, familyIndex, options = {})`:
    - `options.maxPeers = 16`
    - Excludes `record.key`, sorts peers alphabetically by `name`.
    - Returns `""` if no `taxclname` or 0 peers.
    - Renders `<section class="osd-section osd-competing-panel" id="same-family-series">` with heading (`Same Taxonomic Family (<N> competing series)`), the `taxclname` subtitle, a `.osd-competing-grid` of up to `maxPeers` `<a class="osd-competing-card" href="...">` cards containing a mini SVG from `renderStripSvg(peer.stripHorizons, { width: 28, height: 72 })` + series name, and a `+M more in this family` note if `peers.length > maxPeers`.
- **Acceptance:** Unit tests verify grouping, self-exclusion, alphabetical ordering, `maxPeers` truncation + `+M more` note, mini SVG embedding, and empty-string return when `taxclname` is missing or singleton.

#### `3.1.3` — Data-Quality Detector, Notes Renderer & QA Report Builder (`G16`)
- **Files:** `src/qa/detect.js`, `src/qa/report.js`, `test/qa.test.js`
- **Exports (`src/qa/detect.js`):**
  - `detectRecordIssues(record)`: returns `Array<{ code: string, severity: "info"|"warn", summary: string, count?: number }>` for:
    - `SKB-9`: plottable horizons missing moist hue.
    - `SKB-10`: horizons missing `top` or `bottom` depth.
    - `SKB-2`: dry rupture parsed as `"hard"` when narrative mentions `"slightly hard"` (without standalone `"hard"`).
    - `SKB-3`: moist rupture parsed as `"friable"` / `"firm"` when narrative mentions `"very friable"` / `"very firm"` / `"extremely firm"`.
    - `SKB-4`: cementation parsed as `"weakly"` when narrative mentions `"very weakly"` / `"extremely weakly"`.
    - `SKB-5`: horizon narrative mentions `"parting to"` or multiple `"structure"` phrases.
    - `SKB-11`: any SKB section content contains `" & "`.
    - `SC-MISSING`: `!record.hasSc`.
    - `SKB-MISSING`: `!record.hasSkb`.
  - `renderQaNotes(issues)`: returns `""` if empty; otherwise `<details class="osd-qa-notes no-print"><summary>Data quality notes (<N>)</summary><ul>...</ul></details>` with escaped code + summary items.
- **Exports (`src/qa/report.js`):**
  - `buildQaReport(records, issuesByKey)`: returns `{ generatedAt, totalRecords, recordsWithIssues, countsByCode, seriesByCode }` with sorted keys/arrays for deterministic output.
- **Acceptance:** Unit tests cover every issue code, clean record returning `[]` and `""`, HTML escaping in `renderQaNotes`, and `buildQaReport` aggregation.

### Wave 2

#### `3.2.1` — Wire Enrichment & CSS into Series Pages
- **Files:** `src/styles/usdastyle.css`, `src/render/series-page.js`, `test/series-page.test.js`, `test/styles.test.js`
- **Changes:**
  - `src/styles/usdastyle.css`: add styles for `.osd-competing-panel`, `.osd-competing-grid`, `.osd-competing-card`, `.osd-competing-strip`, `.osd-series-link`, `.osd-qa-notes` (and ensure `.osd-qa-notes` is hidden in `@media print`).
  - `src/render/series-page.js`:
    - Add `<a href="../../index.html">&larr; All Series</a>` in `.osd-chrome`.
    - Accept optional `linkIndex = null`, `competingPanelHtml = null`, `qaNotesHtml = null` in `renderSeriesPage(record, options)`.
    - When `linkIndex` is provided, render `COMPETING SERIES` and `GEOGRAPHICALLY ASSOCIATED SOILS` via `linkSeriesNames(content, linkIndex, record.key)`.
    - Insert `competingPanelHtml` immediately after `COMPETING SERIES` (or after all sections if `COMPETING SERIES` is absent).
    - Insert `qaNotesHtml` at the bottom of `<article class="osd-narrative">`.
- **Acceptance:** All existing tests pass; new tests in `test/series-page.test.js` and `test/styles.test.js` verify cross-links, competing panel placement, QA notes rendering, and new CSS classes.

### Wave 3

#### `3.3.1` — Wire Enrichment & `data/qa-report.json` into `src/cli/build.js` + E2E Tests
- **Files:** `src/cli/build.js`, `test/enrichment-integration.test.js`
- **Changes:**
  - In `buildSite()`, build `linkIndex`, `familyIndex`, detect QA issues per record, write `<out>/data/qa-report.json`, and pass `linkIndex`, `competingPanelHtml`, and `qaNotesHtml` into `renderSeriesPage()`.
  - Return `qaSummary: { totalRecords, recordsWithIssues, countsByCode }` in `buildSite()` summary.
- **Acceptance:** `test/enrichment-integration.test.js` runs `buildSite()` on a real multi-series subset (e.g. `AMADOR`, `EXCHEQUER`, `AUBURN`, `FRYINGPAN` or `--limit 30`) and asserts cross-links in HTML, same-family panel with strip SVGs, `<details class="osd-qa-notes">`, and valid `data/qa-report.json`. Full `npm test` passes.

## Worker & Escalation Policy
- **Worker model:** `flash` (default), escalate to `hydrogen` after 1 failed retry.
- **Concurrency:** max 3 concurrent workers per wave.
- **Verification:** Coordinator runs `npm test` after every wave and commits each wave's changes cleanly before starting the next wave.
