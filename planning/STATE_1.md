# Orchestration State 1 (`planning/STATE_1.md`)

Orchestration: `1`
Plan: `planning/EXECUTION_PLAN_1.md`
Last Updated: 2026-11-26

## Baseline (Pre-Wave 1)

- `soil-series-viewer`: greenfield repo (`master`, no tests yet; `docs/research/` and `planning/` present).
- `OSDRegistry`: HEAD `b60d0e76` ("OSD Data Refresh - 2026-11-16", up to date).
- `SoilKnowledgeBase`: HEAD `fbf3e54e61`.
- `SoilProfiles.js`: HEAD `03b6dc8` (branch `v020`; baseline `npm test` to be recorded at start of Wave 1).
- Node: `v24.13.0`, npm: `11.6.2`.

## Wave Board

| Wave | Task ID | Title | Repo | Model | Status |
|---|---|---|---|---|---|
| 1 | `1.1.1` | G1: Repo scaffold + Data loader | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |
| 1 | `1.1.2` | G3: Old-school stylesheet | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |
| 1 | `1.1.3` | G5: Upstream Munsell LUT fix | `SoilProfiles.js` | external agent (`fix/munsell-hue-approx` `6d6be27`) | `done` |
| 2 | `1.2.1` | G2: Series page v1 + CLI | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |
| 2 | `1.2.2` | G4: Profile sketch SVG renderer | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |
| 3 | `1.3.1` | Wire G4 sketch into G2 + AMADOR check | `soil-series-viewer` | `flash` (escalate: `hydrogen`) | `done` |

## Task Reports

*(Worker reports appended below, <=15 lines each.)*

### 1.1.2 -- Old-school stylesheet (G3)
- **Status:** done
- **Files created:** `src/styles/usdastyle.css` (L1-285), `test/styles.test.js` (L1-84), `planning/tasks/1.1.2.todo.md`
- **Tests:** `node --test test/styles.test.js` -> 5 passed, 0 failed
- **Deviations:** none
- **Notes for 1.2.1:** Use container `.osd-page` (`767px` centered); `.osd-chrome`, `.osd-header`, `.osd-meta`, `.osd-location`, `.osd-downloads`; narrative `.osd-narrative`, `.osd-title`, `.osd-section`, `.osd-section-label`, `.osd-horizon`, `.osd-horizon-name`; two-column pedon/sketch `.osd-pedon-layout` > `.osd-pedon-text` + `.osd-pedon-sketch`; `.osd-table`; `.osd-footer`; `.no-print`.

### 1.1.1 -- Repo scaffold + Data loader (G1)
- **Status:** done
- **Files created:** `package.json`, `.gitignore`, `src/loader/keys.js`, `src/loader/normalize.js`, `src/loader/index.js`, `test/loader.test.js`, `planning/tasks/1.1.1.todo.md`
- **Tests:** `node --test test/loader.test.js` -> 5 passed, 0 failed (full corpus: 26,714 records; SC=26,668, SKB=24,928, matched=24,882 [Established=23,586, Tentative=1,070, Inactive=226], scOnly=1,786, skbOnly=46)
- **Exports:** `src/loader/keys.js` (`seriesNameToKey`, `keyToRelativePath`); `src/loader/normalize.js` (`naToNull`, `unwrapNestedList`, `stripSectionHeaderPrefix`, `normalizeSkbDoc`); `src/loader/index.js` (`DEFAULT_SC_PATH`, `DEFAULT_SKB_DIR`, `parseCsvRows`, `parseCsv`, `loadScTable`, `loadSkbFile`, `loadCorpus`)
- **Record shape for 1.2.1/1.2.2:** `{ key, name, letter, status, sc, skb, skbPath, horizons, site, hasSc, hasSkb }` where `status` is `"Established" | "Tentative" | "Inactive" | "Unclassified"`, `horizons` is unwrapped `HORIZONS` (`[]` if `[{}]`), and `skb` sections have `"NA"`->`null` and leading `<HEADER>:` stripped.

### 1.2.1 -- Series page v1 HTML generator + CLI (G2)
- **Status:** done
- **Files created:** `src/render/series-page.js` (L1-358), `src/cli/build.js` (L1-240), `test/series-page.test.js` (L1-297), `planning/tasks/1.2.1.todo.md`
- **Tests:** `node --test test/series-page.test.js` -> 4 passed, 0 failed
- **Exports:** `src/render/series-page.js` (`NSSH_SECTIONS`, `escapeHtml`, `formatLocationLine`, `renderSeriesPage`); `src/cli/build.js` (`DEFAULT_CSS_PATH`, `DEFAULT_OSD_TXT_DIR`, `DEFAULT_OUT_DIR`, `parseCliArgs`, `buildSite`)
- **Notes for 1.3.1:** `buildSite(options)` accepts an optional `renderSketch(record)` callback and passes its return value as `sketchSvg` to `renderSeriesPage`; `renderSeriesPage` renders `sketchSvg` inside `.osd-pedon-sketch` beside `.osd-pedon-text` in `.osd-pedon-layout` and omits `.osd-pedon-sketch` when null/undefined.


### 1.2.2 -- Profile sketch SVG renderer (G4)
- **Status:** done
- **Files created:** `src/render/profile-sketch.js` (L1-195), `test/profile-sketch.test.js` (L1-171), `planning/tasks/1.2.2.todo.md`
- **Tests:** `node --test test/profile-sketch.test.js` -> 4 passed, 0 failed
- **Exports:** `src/render/profile-sketch.js` (`DEFAULT_SKETCH_OPTIONS`, `FALLBACK_HORIZON_COLOR`, `selectHorizonMunsell`, `isPlottableHorizon`, `renderProfileSketch`)
- **Deviations:** none
- **Notes for 1.3.1:** `renderProfileSketch(record, options)` imports `/home/andrew/workspace/SoilProfiles.js/dist/index.js`, defaults to `{ width: 140, height: 320, mode: "depth" }`, returns `{ svg, omittedHorizons }` (`svg: null` when 0 plottable horizons remain), handles `SKB-9` (moist -> dry -> `#cccccc`, passing `undefined` for incomplete triplets so `munsellToHex` never coerces `null` to `0`) and `SKB-10` (omits missing/`bottom <= top` horizons).


### 1.3.1 -- Wire G4 sketch into G2 series page & end-to-end AMADOR check
- **Status:** done
- **Files modified/created:** `src/cli/build.js` (L18-30, L155, L206-211), `test/integration.test.js` (L1-118), `planning/tasks/1.3.1.todo.md`
- **Tests:** `node --test test/integration.test.js` -> 2 passed, 0 failed; `npm test` (`node --test`) -> 20 passed, 0 failed
- **Deviations:** none
- **Notes:** Wired `renderProfileSketch` via `defaultRenderSketch(record)` as default `renderSketch` in `buildSite`, keeping `renderSketch: null` and custom function overrides working; verified `AMADOR`, `MT._AIRY`, and `KANA@A` HTML + SVG (`#6e5f4c`, not `#6e5f4d`) + `.txt`/`.json` + `usdastyle.css` outputs.
