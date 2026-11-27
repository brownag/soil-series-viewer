# Project Goals (`planning/GOALS.md`)

Last Updated: 2026-11-27
Source State: `planning/STATE_4.md` (Orchestrations 1–4 complete; `npm test` 106/106 passing)

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
- **[G9]** Taxonomy tree explorer (`taxonomy/index.html`, `src/client/taxonomy-app.js`, `data/taxonomy-tree.json`) — completed in Orchestration 4 (`a123d79`, `1f23166`, `0570320`)
- **[G10]** KST 2022 taxon criteria & chapter/page tooltips (`src/index/kst-criteria.js`, `data/kst-criteria.json`) — completed in Orchestration 4 (`a123d79`, `1f23166`, `0570320`)
- **[G11]** Searchable Glossary & Diagnostic Features (`glossary/index.html`, `src/index/glossary.js`, `data/glossary.json`) — completed in Orchestration 4 (`a123d79`, `1f23166`, `0570320`)

## Circled Goal (Active — Orchestration 5: Full-Text Search, Interactive Profiles & Offline PWA)

- **[G8]** Full-text search indexes OSD section content client-side via Pagefind, with a search UI accessible from the home page returning matching series snippets and links.
  - Why now: Strictly orthogonal leaf goal (depends only on completed `G2`); adds full-text OSD body search alongside existing `G7` name/SC-facet search.
  - Exit criteria: `data-pagefind-*` markup on series pages, optional `--pagefind` CLI runner with graceful fallback, client full-text search panel, unit + E2E tests green.
  - First action: Check local `pagefind` availability and design `data-pagefind-*` attributes + client integration in `EXECUTION_PLAN_5.md`.

- **[G19]** Interactive horizon tooltips and profile comparison wire interactive event listeners on series-page profile sketches and enable side-by-side profile comparison.
  - Why now: Strictly orthogonal leaf goal (depends only on completed `G4`); upgrades static build-time profile sketches into interactive exploration tools.
  - Exit criteria: Horizon `data-*` attributes on profile SVG, zero-dependency `src/client/profile-interactive.js` (tooltips + comparison drawer/panel), CSS styling, unit + E2E tests green.
  - First action: Inspect `src/render/profile-sketch.js` SVG output and design tooltip/comparison UX in `EXECUTION_PLAN_5.md`.

- **[G20]** Offline/PWA support caches static assets and JSON indexes using DST's service-worker and web-manifest pattern.
  - Why now: Strictly orthogonal leaf goal (depends only on completed `G2`); makes the static site installable and usable offline in the field.
  - Exit criteria: `src/pwa/generate-pwa.js` emitting `manifest.json` + `sw.js` with cache versioning, `<link rel="manifest">` + SW registration on all pages, unit + E2E tests green.
  - First action: Inspect `/home/andrew/workspace/DST/sw.js` and `manifest.json` to mirror DST's caching strategy.

## Sequenced Goals (Dependency DAG)

### Hosting & CI

- **[G15]** Hosting and URL scheme serves canonical slugs with URL rewriting for `OSD_Docs/<L>/<NAME>.html` compatibility and redirects for punctuation/casing edge cases.
  - Depends on: G2 (complete)
- **[G14]** Incremental build and CI hashes per-series inputs, rebuilds only changed pages on a weekly schedule after SKB's Monday 06:00 UTC refresh, and deploys.
  - Depends on: G2, G15

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
