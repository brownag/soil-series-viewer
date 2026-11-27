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
- **[G8]** Full-text search via Pagefind (`src/index/pagefind.js`, `src/client/fulltext-search.js`, `--pagefind` CLI) — completed in Orchestration 5 (`0fd3bc0`, `0438e3a`, `fdca2e5`)
- **[G19]** Interactive horizon tooltips & profile comparison (`src/render/profile-interactive-data.js`, `src/client/profile-interactive.js`) — completed in Orchestration 5 (`0fd3bc0`, `0438e3a`, `fdca2e5`)
- **[G20]** Offline/PWA support (`src/pwa/generate-pwa.js`, `manifest.json`, `sw.js`) — completed in Orchestration 5 (`0fd3bc0`, `0438e3a`, `fdca2e5`)
- **[G14]** Incremental build (`--incremental`, `src/cli/incremental-cache.js`), configurable upstream paths (`src/lib/soil-profiles.js`), and GitHub Actions CI + weekly GitHub Pages deploy (`.github/workflows/{test,build-and-deploy}.yml`) — completed (`58b1b3d`, `deceece`)

## Sequenced Goals (Dependency DAG)

### Hosting & URL Rewriting

- **[G15]** Hosting and URL scheme serves canonical slugs with URL rewriting for `OSD_Docs/<L>/<NAME>.html` compatibility and redirects for punctuation/casing edge cases.
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
