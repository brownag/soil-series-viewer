# Project Goals (`planning/GOALS.md`)

Last Updated: 2026-11-27
Source State: `planning/STATE_2.md` (Orchestrations 1 & 2 complete; `npm test` 46/46 passing)

## Completed Goals

- **[G1]** Data loader (`src/loader/`) — completed in Orchestration 1 (`f6af05f`)
- **[G3]** Old-school `usdastyle.css` stylesheet — completed in Orchestration 1 (`6b4f66a`)
- **[G5]** Accurate Munsell-to-hex conversion via upstream `SoilProfiles.js` — completed in Orchestration 1
- **[G2]** Series page v1 + build CLI (`src/render/series-page.js`, `src/cli/build.js`) — completed in Orchestration 1 (`74e31d3`)
- **[G4]** Build-time `SoilProfiles.js` SVG profile sketch on series pages — completed in Orchestration 1 (`bda2e43`, `e048f48`)
- **[G7]** Client-side search, wildcard/fuzzy, and SC facet filter engine + `data/search-index.json` — completed in Orchestration 2 (`28b3cb3`, `80d9d57`)
- **[G6]** Home page virtualized profile gallery + letter-sharded `data/strips/<A..Z>.json` + `home.css` — completed in Orchestration 2 (`f0bd5f5`, `8d0c33c`, `987a8a4`)

## Circled Goal (Active — Orchestration 3: Series Page Enrichment)

Three orthogonal, high-value series-page goals unblocked by `G1`, `G2`, `G4`, and `G6` (`renderStripSvg`):

- **[G12]** Series cross-links enrich `COMPETING SERIES` and `GEOGRAPHICALLY ASSOCIATED SOILS` text with static relative links (`../<L>/<KEY>.html`) matched against the corpus name/key table (longest-match-first, case-aware, self-excluded).
  - Why now: Makes every OSD page navigable as a connected graph using the existing corpus index, with zero client-side JS overhead.
  - Exit criteria: `src/render/cross-links.js` links single- and multi-word series names in Competing & Associated sections without false-positive lowercase prose matches; unit + E2E tests pass.
  - First action: Implement `buildSeriesLinkIndex` and `linkSeriesNames` in `src/render/cross-links.js` (Task `3.1.1`).

- **[G13]** Same-family competing-series panel groups series by SC `taxclname` and renders up to 16 peer cards with mini profile strip SVGs (reusing `renderStripSvg`) plus a `+N more` note.
  - Why now: Reuses the already-built `src/client/strip-svg.js` renderer at build time to turn static OSD pages into visual family comparisons.
  - Exit criteria: `src/render/competing-panel.js` groups by normalized `taxclname`, excludes self, caps at 16 with `+N more`, embeds mini strip SVGs, and passes unit + E2E tests.
  - First action: Implement `buildFamilyIndex` and `renderCompetingPanel` in `src/render/competing-panel.js` (Task `3.1.2`).

- **[G16]** Display-side data-quality annotations detect `docs/research/skb-issues.md` issues (`SKB-2`..`5`, `SKB-9`..`11`, `SC-MISSING`, `SKB-MISSING`) without mutating SKB JSON, render a collapsible `<details class="osd-qa-notes no-print">` on affected series pages, and emit `<out>/data/qa-report.json`.
  - Why now: Closes the §0 transparency requirement before full-corpus publishing and provides a machine-readable QA baseline for future refreshes.
  - Exit criteria: `src/qa/detect.js` and `src/qa/report.js` detect all target codes, render escaped `<details>` blocks, emit deterministic `data/qa-report.json`, and pass unit + E2E tests.
  - First action: Implement `detectRecordIssues`, `renderQaNotes`, and `buildQaReport` in `src/qa/` (Task `3.1.3`).

## Sequenced Goals (Dependency DAG)

### Taxonomy & Knowledge Browse

- **[G9]** Taxonomy tree browse pages navigate order → suborder → great group → subgroup → family → series with SC counts and member sketch strips.
  - Depends on: G1, G4 (complete)
- **[G10]** KST definitions display per-taxon criteria text with chapter/page references on taxonomy tree nodes and series breadcrumb tooltips (using SKB 2022 criteria + DST code tree).
  - Depends on: G9
- **[G11]** Glossary and diagnostic-feature pages combine DST glossary (136 terms) and SKB 2014 featurelist (140 features), linked from series and taxonomy pages.
  - Depends on: G10

### Search, Interactivity & Deployment

- **[G8]** Full-text search indexes OSD section content client-side via Pagefind.
  - Depends on: G2 (complete)
- **[G19]** Interactive horizon tooltips and profile comparison wire `SoilProfiles.js` event listeners on series pages.
  - Depends on: G4 (complete)
- **[G15]** Hosting and URL scheme serves canonical slugs with URL rewriting for `OSD_Docs/<L>/<NAME>.html` compatibility and redirects for punctuation/casing edge cases.
  - Depends on: G2 (complete)
- **[G14]** Incremental build and CI hashes per-series inputs, rebuilds only changed pages on a weekly schedule after SKB's Monday 06:00 UTC refresh, and deploys.
  - Depends on: G2, G15
- **[G20]** Offline/PWA support caches static assets and JSON indexes using DST's service-worker pattern.
  - Depends on: G2 (complete)

## Independent Backlog

- **[G18]** `SoilProfiles.js` upstream fixes update `parseOSDJson` to unwrap nested `HORIZONS` and sync vendored bundles in `soillite` and `geolibre-plugin-soillite`.
  - Low unblocking leverage for this viewer (G1 already unwraps `HORIZONS` directly).

## Deferred

- **[G21]** Series extent map and survey-area list from SSURGO (`mupolygon`, `area_series`) or `series-extent` FlatGeobuf.
  - Trigger: Decision to add SSURGO DuckDB (126 GB) or `series-extent` FGB as a post-v1 build input.
- **[G22]** Siblings panel computed from SSURGO map-unit co-occurrence.
  - Trigger: G21 SSURGO build infrastructure in place.
- **[G23]** Geomorphic position and parent-material proportion charts from SSURGO.
  - Trigger: G21 SSURGO build infrastructure in place.
- **[G24]** MLRA, ecosite, and NCCPI summaries per series from SSURGO.
  - Trigger: G21 SSURGO build infrastructure in place.
- **[G25]** Climate summaries (PRISM) per series extent.
  - Trigger: G21 extent polygons + external PRISM raster pipeline approved.
- **[G26]** "Key it out" deep link into DST preselecting the series taxon.
  - Trigger: Upstream DST adds URL state support (`?taxon=<code>`).
- **[G27]** Structured Range in Characteristics (RIC) tables on series pages.
  - Trigger: Upstream SKB `osd-ric-dev2` branch merges to `main`.

## Blocked / Pruned

- **[G17]** Upstream SKB fixes (rupture/structure regex, preserve blank lines, unnest `HORIZONS`) as PRs.
  - Status: Pruned
  - Reason: §0 decision uses SKB output as is; known defects (SKB-1 to SKB-17) are documented in `docs/research/skb-issues.md` and handled on the display side (G1, G16).
