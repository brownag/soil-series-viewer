# Project Goals (`planning/GOALS.md`)

Last Updated: 2026-11-26
Source: `docs/research/soil-series-viewer-research.md` (§0 Decisions, §11 Candidate Goals G1–G27)

## Circled Goal (Active)

- **[G1]** Data loader module reads SKB JSON (`SKB/inst/extdata/OSD/{A..Z}/<NAME>.json`) and SC CSV (`OSDR/SC/SCDB.csv`), normalizes series name keys (uppercase, space→`_`, backtick→`@`, preserving periods), unwraps nested `HORIZONS` (`SKB-1`), strips repeated section headers (`SKB-12`), converts `"NA"` text sentinels to `null` (`SKB-17`), joins by key, and emits a match/coverage report.
  - Why now: Root bottleneck — unblocks 13+ downstream goals (G2, G4, G6, G7, G9, G13, G16, and transitively G8, G10–G12, G14–G15, G19–G20).
  - Exit criteria: Loader runs cleanly over the full corpus (24,928 SKB JSON + 26,576 SC rows), handles `AMADOR`, `MT._AIRY`, and `KANA@A` edge cases, unwraps `HORIZONS[0]`, strips section prefixes, normalizes `"NA"` to `null`, and outputs deterministic match/unmatched counts by status.
  - First action: Define the normalized series record schema and filename-key mapper, then implement and test the loader against `AMADOR.json` + `SCDB.csv`.

- **[G5]** Accurate Munsell-to-hex color conversion uses a full LUT (fixing the 6-hue collapse where `10YR 4/2` renders identically to `5YR 4/2` as `#6e5f4d`) and passes reference color tests.
  - Why now: Strictly orthogonal to G1; runs in parallel with Wave 1 so profile sketches (G4) and future gallery thumbnails (G6) render accurate soil colors from the start. Implementation location (upstream `SoilProfiles.js` PR vs. local build precomputation) to be decided in `/plan-wave`.
  - Exit criteria: `10YR 4/2` and `5YR 4/2` produce distinct, reference-verified hex values; neutral `N` hues and missing-color fallbacks pass unit tests.
  - First action: Audit `SPJ/soilprofiles-munsell/munsell-data.json` against a reference Munsell table and decide whether to wire it into `SoilProfiles.js` or precompute hex in the viewer build.

## Sequenced Goals (Dependency DAG)

### Wave 1 — First Visible Milestone (AMADOR-style pages + sketches)

- **[G3]** Old-school stylesheet defines CSS tokens from `usdastyle.css` (Verdana 11 px, `#3e3e3e` chrome, 767 px body, `#248621` table headers, `#000099` / `#660099` links), responsive layout, and print styles.
  - Depends on: — (orthogonal; paired with G1/G2/G4 in Wave 1)
- **[G2]** Series page v1 generates HTML per series reproducing the old OSD anatomy (header lines, `<h1>`, bold section labels, bold horizon names) from SKB JSON, styled with G3, plus plain `.txt` and `.json` download links.
  - Depends on: G1, G3
- **[G4]** Profile sketch per series renders an SVG via `SoilProfiles.js` at build time with missing-color/depth fallbacks, embedded alongside the Typical Pedon on the series page.
  - Depends on: G1 (visually improved by G5)

### Core Discovery, Browse & Quality

- **[G16]** Data-quality annotations handle `skb-issues.md` (SKB-1 to SKB-17) on the display side, flagging missing colors/depths, suspect rupture/structure values, obsolete taxa, and unclassified series on pages and in a build QA report.
  - Depends on: G1
- **[G7]** Client-side search and filter supports name prefix, fuzzy, and wildcard search plus SC facets (status, order→subgroup, family classes, state, MLRA office, benchmark flag).
  - Depends on: G1
- **[G6]** Home page profile gallery displays a filterable, virtualized grid of series thumbnails rendered from compact precomputed color strips.
  - Depends on: G1, G4 (improved by G5)
- **[G9]** Taxonomy tree browse pages navigate order → suborder → great group → subgroup → family → series with SC counts and member sketch strips.
  - Depends on: G1, G4
- **[G13]** Competing-series panel groups same-family series from SC `taxclname` with a side-by-side sketch strip.
  - Depends on: G1, G4
- **[G19]** Interactive horizon tooltips and profile comparison wire `SoilProfiles.js` event listeners on series pages.
  - Depends on: G4

### Content Enrichment, Search & Deployment

- **[G8]** Full-text search indexes OSD section content client-side via Pagefind.
  - Depends on: G2
- **[G12]** Series cross-links enrich Competing Series and Geographically Associated Soils text by matching SC series names, with hover cards.
  - Depends on: G2
- **[G15]** Hosting and URL scheme serves canonical slugs with URL rewriting for `OSD_Docs/<L>/<NAME>.html` compatibility and redirects for punctuation/casing edge cases.
  - Depends on: G2
- **[G14]** Incremental build and CI hashes per-series inputs, rebuilds only changed pages on a weekly schedule after SKB's Monday 06:00 UTC refresh, and deploys.
  - Depends on: G2, G15
- **[G20]** Offline/PWA support caches static assets and JSON indexes using DST's service-worker pattern.
  - Depends on: G2

### Taxonomy Knowledge Integration

- **[G10]** KST definitions display per-taxon criteria text with chapter/page references on taxonomy tree nodes and series breadcrumb tooltips (using SKB 2022 criteria + DST code tree).
  - Depends on: G9
- **[G11]** Glossary and diagnostic-feature pages combine DST glossary (136 terms) and SKB 2014 featurelist (140 features), linked from series and taxonomy pages.
  - Depends on: G10

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
