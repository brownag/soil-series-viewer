# soil-series-viewer

Static site generator for USDA-NRCS Official Soil Series Descriptions (OSD) and Series Classification (SC) data, reproducing legacy NRCS OSD page anatomy with modern search, profile visualization, taxonomy browsing, and offline PWA support.

## Features

- **OSD Series Pages:** Legacy `usdastyle.css` layout with build-time `SoilProfiles.js` SVG profile sketches, interactive horizon tooltips, side-by-side profile comparison, cross-linked competing/associated series, same-family strip panels, and display-side QA notes.
- **Search & Gallery:** Client-side wildcard/fuzzy name search, 12 SC taxonomic facets, virtualized profile gallery with letter-sharded color strips, and optional Pagefind full-text OSD search.
- **Taxonomy & Knowledge:** Interactive Soil Taxonomy tree explorer (`taxonomy/`), KST 2022 criteria with chapter/page tooltips, and a searchable Glossary & Diagnostic Features index (`glossary/`).
- **Offline & CI:** Installable PWA (`manifest.json` + `sw.js`), per-series incremental builds (`--incremental`), and automated weekly GitHub Pages deployment.

## Upstream Data Sources

- [ncss-tech/OSDRegistry](https://github.com/ncss-tech/OSDRegistry) — Series Classification (`SCDB.csv`) and raw OSD `.txt` files
- [ncss-tech/SoilKnowledgeBase](https://github.com/ncss-tech/SoilKnowledgeBase) — Parsed OSD JSON, KST 2022 criteria, and KST 2014 featurelist
- [brownag/SoilProfiles.js](https://github.com/brownag/SoilProfiles.js) — Munsell-to-hex conversion and SVG profile sketch rendering
- [brownag/DST](https://github.com/brownag/DST) — Glossary definitions and service-worker reference pattern

## Quick Start

Requires Node.js 24+ (zero external npm dependencies). Run `make help` for all targets (see [Makefile](Makefile)).

```bash
make test          # Run the full test suite
make build-sample  # Build a sample subset into dist/
make serve         # Preview dist/ at http://localhost:8080
```

## Documentation

- [Makefile](Makefile) — Build, test, Pagefind, and local preview targets
- [CONTRIBUTING.md](CONTRIBUTING.md) — Development setup, conventions, and pull requests
- [AGENTS.md](AGENTS.md) — Repository map, invariants, and environment variable overrides
