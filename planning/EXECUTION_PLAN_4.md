# Execution Plan 4 — Taxonomy Tree Browse, KST Criteria & Glossary (`G9`, `G10`, `G11`)

**Status:** Draft — awaiting user approval  
**Created:** 2026-11-27  
**Goals Covered:**
- `G9` — Taxonomy tree browse (`taxonomy/index.html` + `data/taxonomy-tree.json`), order → suborder → great group → subgroup → family → series with SC counts and member strip SVGs
- `G10` — KST 2022 taxon criteria (`data/kst-criteria.json`) displayed on taxonomy tree nodes and referenced in series-page taxonomic breadcrumbs
- `G11` — Glossary & diagnostic features (`glossary/index.html` + `data/glossary.json`) merging SKB `2014_KST_EN_featurelist.json` (140 features) and DST `dst-data.json` glossary (136 terms)

## Architecture & Locked Decisions

1. **DST-style static + client-hydrated explorers:** `taxonomy/index.html` and `glossary/index.html` hydrate compact JSON payloads (`data/taxonomy-tree.json`, `data/kst-criteria.json`, `data/glossary.json`) with hash-based routing (`#<path>`), zero bundler, zero Node-only imports in `src/client/*.js`.
2. **Reuse existing strip infrastructure:** Family/series views in `taxonomy-app.js` lazily load `../data/strips/<L>.json` and render mini SVGs via `renderStripSvg` from `src/client/strip-svg.js`.
3. **Cross-navigation:**
   - Home page (`index.html`) links to `taxonomy/index.html` and `glossary/index.html`.
   - Series pages (`OSD_Docs/<L>/<KEY>.html`) include `Taxonomy` and `Glossary` links in `.osd-chrome`, plus a clickable taxonomic breadcrumb (`Order › Suborder › Great Group › Subgroup`) linking into `../../taxonomy/index.html#<slug-path>`.
4. **Graceful source fallbacks:** KST and DST source paths default to `/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/KST` and `/home/andrew/workspace/DST/data/dst-data.json`, and are overridable via options (returning empty/partial indexes cleanly if absent).

## Task DAG & Wave Table

| Wave | Task ID | Goal | Title | Depends On | Files Owned |
|---|---|---|---|---|---|
| 1 | `4.1.1` | `G9` | Taxonomy tree index generator (`data/taxonomy-tree.json`) | — | `src/index/taxonomy-tree.js`, `test/taxonomy-tree.test.js` |
| 1 | `4.1.2` | `G10` | KST 2022 criteria index generator (`data/kst-criteria.json`) | — | `src/index/kst-criteria.js`, `test/kst-criteria.test.js` |
| 1 | `4.1.3` | `G11` | Glossary & diagnostic features merger (`data/glossary.json`) | — | `src/index/glossary.js`, `test/glossary.test.js` |
| 2 | `4.2.1` | `G9/G10` | Taxonomy explorer HTML, client app & CSS | `4.1.1`, `4.1.2` | `src/render/taxonomy-page.js`, `src/client/taxonomy-app.js`, `src/styles/taxonomy.css`, `test/taxonomy-page.test.js` |
| 2 | `4.2.2` | `G11` | Glossary & diagnostic features HTML & client app | `4.1.3` | `src/render/glossary-page.js`, `src/client/glossary-app.js`, `test/glossary-page.test.js` |
| 2 | `4.2.3` | `G9/G10/G11` | Series taxonomic breadcrumbs & home/series nav links | `4.1.1`, `4.1.2` | `src/render/series-page.js`, `src/render/home-page.js`, `src/styles/usdastyle.css`, `test/series-page.test.js`, `test/home-page.test.js` |
| 3 | `4.3.1` | `G9/G10/G11` | Wire taxonomy, KST, and glossary into `src/cli/build.js` + E2E tests | `4.2.1`, `4.2.2`, `4.2.3` | `src/cli/build.js`, `test/taxonomy-integration.test.js` |

## Worker & Escalation Policy
- **Worker model:** `flash` (default), escalate to `hydrogen` after 1 failed retry.
- **Concurrency:** max 3 concurrent workers per wave.
- **Verification:** Coordinator runs `npm test` after every wave and commits each wave cleanly before starting the next wave.
