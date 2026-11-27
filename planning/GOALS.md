# Project Goals (`planning/GOALS.md`)

Last Updated: 2026-11-27
Source State: `planning/STATE_3.md` (Orchestrations 1–3 complete; `npm test` 75/75 passing)

## Completed Goals

- **[G1]** Data loader (`src/loader/`) — completed in Orchestration 1 (`f6af05f`)
- **[G3]** Old-school `usdastyle.css` stylesheet — completed in Orchestration 1 (`6b4f66a`)
- **[G5]** Accurate Munsell-to-hex conversion via upstream `SoilProfiles.js` — completed in Orchestration 1
- **[G2]** Series page v1 + build CLI (`src/render/series-page.js`, `src/cli/build.js`) — completed in Orchestration 1 (`74e31d3`)
- **[G4]** Build-time `SoilProfiles.js` SVG profile sketch on series pages — completed in Orchestration 1 (`bda2e43`, `e048f48`)
- **[G7]** Client-side search, wildcard/fuzzy, and SC facet filter engine + `data/search-index.json` — completed in Orchestration 2 (`28b3cb3`, `80d9d57`)
- **[G6]** Home page virtualized profile gallery + letter-sharded `data/strips/<A..Z>.json` + `home.css` — completed in Orchestration 2 (`f0bd5f5`, `8d0c33c`, `987a8a4`)
- **[G12]** Series cross-links in `COMPETING SERIES` and `GEOGRAPHICALLY ASSOCIATED SOILS` (`src/render/cross-links.js`) — completed in Orchestration 3 (`dfe10c0`, `be7bbe2`, `cbfc082`)
- **[G13]** Same-family competing-series panel from SC `taxclname` with mini strip SVGs (`src/render/competing-panel.js`) — completed in Orchestration 3 (`dfe10c0`, `be7bbe2`, `cbfc082`)
- **[G16]** Display-side SKB/SC data-quality annotations (`<details class="osd-qa-notes no-print">`) + `data/qa-report.json` (`src/qa/`) — completed in Orchestration 3 (`dfe10c0`, `be7bbe2`, `cbfc082`)

## Circled Goal (Active — Orchestration 4: Taxonomy Tree Browse & Knowledge Integration)

- **[G9]** Taxonomy tree browse pages navigate order → suborder → great group → subgroup → family → series with SC counts, breadcrumb navigation, and member sketch strips, linked from the home page and series pages.
  - Why now: Highest-leverage remaining root goal — unblocks `G10` (KST definitions) and transitively `G11` (glossary & diagnostic features), while reusing `renderStripSvg` and SC taxonomy fields already loaded in `G1`.
  - Exit criteria: Pure taxonomy tree builder + HTML renderer unit tests, CLI emission in `src/cli/build.js`, breadcrumb links on series pages and home nav link, E2E integration test, full `npm test` green.
  - First action: Inspect local SKB KST/featurelist data availability, confirm `G9` + `G10`/`G11` scope in `/plan-wave`, and draft `planning/EXECUTION_PLAN_4.md`.

- **[G10]** KST definitions display per-taxon criteria text with chapter/page references on taxonomy tree nodes and series breadcrumb tooltips (tied into `G9` if local SKB KST data is ready).
  - Depends on: G9

- **[G11]** Glossary and diagnostic-feature pages combine glossary and SKB featurelist definitions, linked from series and taxonomy pages (tied into `G9`/`G10` if local data is ready).
  - Depends on: G10

## Sequenced Goals (Dependency DAG)

### Search, Interactivity & Deployment

- **[G15]** Hosting and URL scheme serves canonical slugs with URL rewriting for `OSD_Docs/<L>/<NAME>.html` compatibility and redirects for punctuation/casing edge cases.
  - Depends on: G2 (complete)
- **[G14]** Incremental build and CI hashes per-series inputs, rebuilds only changed pages on a weekly schedule after SKB's Monday 06:00 UTC refresh, and deploys.
  - Depends on: G2, G15
- **[G8]** Full-text search indexes OSD section content client-side via Pagefind.
  - Depends on: G2 (complete)
- **[G19]** Interactive horizon tooltips and profile comparison wire `SoilProfiles.js` event listeners on series pages.
  - Depends on: G4 (complete)
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
