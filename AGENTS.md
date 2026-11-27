# AGENTS.md

Navigation map for agents working in `soil-series-viewer`. See [README.md](README.md) for project overview, [CONTRIBUTING.md](CONTRIBUTING.md) for contributor rules, and [Makefile](Makefile) for all runnable commands.

## Quick Start

Run `make help` to list all build, test, and serve targets (see [Makefile](Makefile)).

```bash
make test
make build-sample
```

## Find Things

- `src/loader/` — SC CSV + SKB JSON corpus loader, key/path normalization
- `src/index/` — Build-time index generators (search, color strips, taxonomy tree, KST 2022 criteria, glossary, Pagefind helper)
- `src/render/` — Static HTML & SVG renderers (series pages, profile sketches, interactive profile data, cross-links, competing panel, home, taxonomy, glossary)
- `src/qa/` — Display-side SKB/SC data-quality detectors and `qa-report.json` builder
- `src/pwa/` — `manifest.json` and `sw.js` service-worker generator
- `src/client/` — Zero-dependency browser ESM scripts (zero `node:*` imports)
- `src/styles/` — `usdastyle.css`, `home.css`, `taxonomy.css`
- `src/lib/` — Configurable CJS wrapper for upstream `SoilProfiles.js`
- `src/cli/` — Static site builder (`build.js`) and per-series hash cache (`incremental-cache.js`)
- `test/` — Built-in `node:test` unit and integration suite
- `.github/workflows/` — `test.yml` (push/PR) and `build-and-deploy.yml` (weekly GitHub Pages)
- `planning/` — `GOALS.md`, execution plans, state logs, and archived `TODO_*.md` files

## Invariants

- **Runtime:** Node 24, plain ESM (`"type": "module"`), zero external npm dependencies, built-in `node:test`.
- **Browser code:** Files in `src/client/` must not import `node:*` modules.
- **Upstream `SoilProfiles.js`:** Always import via `src/lib/soil-profiles.js` (CJS loader); never hardcode absolute paths or `dist/index.esm.js`.
- **Munsell colors:** Delegate to `munsellToHex()` from `src/lib/soil-profiles.js`; never hardcode hex literals in tests.
- **Data policy:** Use SKB JSON as-is (display-side QA only); offer raw OSD `.txt` as a plain download.

## Infrastructure (Environment Overrides)

Defaults point to sibling repos under `/home/andrew/workspace/`. Override in CI or custom setups:

| Variable | Default |
|---|---|
| `OSD_SC_PATH` | `/home/andrew/workspace/OSDRegistry/SC/SCDB.csv` |
| `OSD_SKB_DIR` | `/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/OSD` |
| `OSD_TXT_DIR` | `/home/andrew/workspace/OSDRegistry/OSD` |
| `OSD_KST_DIR` | `/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/KST` |
| `OSD_FEATURELIST_PATH` | `/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/KST/2014_KST_EN_featurelist.json` |
| `OSD_DST_DATA_PATH` | `/home/andrew/workspace/DST/data/dst-data.json` |
| `SOIL_PROFILES_PATH` | `/home/andrew/workspace/SoilProfiles.js/dist/index.js` |

## References

- [Makefile](Makefile) — Canonical build/test/serve commands
- [README.md](README.md) — Features and upstream data sources
- [CONTRIBUTING.md](CONTRIBUTING.md) — Style, testing, and PR workflow
- [planning/GOALS.md](planning/GOALS.md) — Project goal graph and completed milestones
