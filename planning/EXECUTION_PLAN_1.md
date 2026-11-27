# Execution Plan 1 (`planning/EXECUTION_PLAN_1.md`)

Orchestration: `1`
Date: 2026-11-26
Source Goals: `planning/GOALS.md` (Wave 1: G1, G3, G2, G4 + parallel G5)

## Goal & Scope

- **Goal:** Build the first visible milestone of `soil-series-viewer` — a data loader (G1) reading SKB JSON and SC CSV, an old-school stylesheet (G3), an AMADOR-style series page generator (G2), and a build-time profile sketch renderer (G4) — while fixing the upstream Munsell hue-collapse bug in `SoilProfiles.js` (G5) in parallel so sketches render accurate soil colors.
- **In scope:**
  - `G1`: Repo scaffold (`package.json`, Node 24 ESM + `node:test`) and data loader joining SKB JSON + SC CSV, handling `SKB-1`, `SKB-12`, `SKB-17`, key normalization, and coverage reporting.
  - `G3`: Old-school CSS (`usdastyle.css` palette tokens, responsive layout, print styles).
  - `G5`: Upstream Munsell LUT fix in `/home/andrew/workspace/SoilProfiles.js` (no hex parsing reinvented in `soil-series-viewer`).
  - `G2`: Series page v1 HTML generator reproducing old OSD anatomy + plain `.txt`/`.json` download links + CLI with `--series` / `--limit`.
  - `G4`: Build-time `SoilProfiles.js` SVG profile sketch with missing-color/depth fallbacks, wired into the series page.
- **Out of scope (deferred to later orchestrations):**
  - Home page profile gallery (G6), client-side search/filter (G7), Pagefind full-text search (G8), taxonomy tree & KST/DST integration (G9–G11), series cross-links (G12), competing-series panel (G13), CI/hosting/PWA (G14–G15, G20), full SKB-2..16 QA annotations (G16), upstream `parseOSDJson` fix (G18), interactive tooltips (G19), SSURGO/PRISM/DST/RIC future goals (G21–G27).
- **Verbatim constraints:**
  - "SKB output is used as is. No patching, forking or re-parsing of SKB JSON." (§0)
  - "Raw OSD `.txt` is offered as a plain source-file download with no markup." (§0)
  - "do not reinvent hex parsing in soil-series-viewer, we need to fix it upstream" (User, 2026-11-26)
  - "local OSDregistry is now up to date" (User, 2026-11-26; `b60d0e76`)

## Decision Log

- **2026-11-26 (D1 — Stack):** Node 24 plain ESM (`"type": "module"`) + built-in `node:test` runner. No TypeScript compile step.
- **2026-11-26 (D2 — Munsell LUT):** Fix G5 upstream in `/home/andrew/workspace/SoilProfiles.js`; do not reinvent Munsell-to-hex parsing in `soil-series-viewer`.
- **2026-11-26 (D3 — Status & CLI Scope):** Load and join all SC statuses (Established, Tentative, Inactive) plus unclassified SKB docs. Provide `--series` and `--limit` CLI flags for fast verification alongside full-corpus runs.
- **2026-11-26 (D4 — Models & Parallelism):** `flash` workers, escalate to `hydrogen` after 1 failed retry. Max 3 concurrent workers per wave. Use worktree/branch isolation when multiple tasks edit `soil-series-viewer` in the same wave.

## Recon & Hazards

- **Node / npm:** Node `v24.13.0`, npm `11.6.2`.
- **Sibling data paths (read-only):**
  - `SKB`: `/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/OSD/{A..Z}/<NAME>.json` (HEAD `fbf3e54e61`, 24,928 files).
  - `OSDR`: `/home/andrew/workspace/OSDRegistry/SC/SCDB.csv` and `OSD/{A..Z}/<NAME>.txt` (HEAD `b60d0e76`, up to date).
  - `SPJ`: `/home/andrew/workspace/SoilProfiles.js` (HEAD `03b6dc8`, branch `v020`; `npm test` = `jest`, `npm run build` = `tsc && node esbuild.config.js`).
- **Hazards:**
  - `SPJ/soilprofiles-munsell/munsell-data.json` (10,451 lines) uses JS object-literal syntax (unquoted keys), not strict JSON — parse or convert carefully in Task 1.1.3.
  - `SCDB.csv` has 31 names with non-A-Z characters (e.g. `MT. AIRY`, ``KANA`A``). Key mapper must apply: uppercase, space→`_`, backtick→`@`, preserve periods.
  - `HORIZONS` is nested `[[...]]` in 24,906/24,928 SKB docs (`SKB-1`).
  - Temp/scratch files in `soil-series-viewer` go in `.development/` (git-ignored).

## Wave Table

| Wave | Task ID | Goal | Repo | Depends On | Files in Scope (Disjoint per Wave) |
|---|---|---|---|---|---|
| 1 | `1.1.1` | G1: Repo scaffold + Data loader | `soil-series-viewer` | — | `package.json`, `.gitignore`, `src/loader/*`, `test/loader.test.js` |
| 1 | `1.1.2` | G3: Old-school stylesheet | `soil-series-viewer` | — | `src/styles/usdastyle.css`, `test/styles.test.js` |
| 1 | `1.1.3` | G5: Upstream Munsell LUT fix | `SoilProfiles.js` | — | `src/core/munsell.ts`, `src/core/munsell-lut.ts` (new), `src/utils/munsell-approx.ts`, `src/core/__tests__/munsell.test.ts` (or existing test), `dist/*` |
| 2 | `1.2.1` | G2: Series page v1 + CLI | `soil-series-viewer` | `1.1.1`, `1.1.2` | `src/render/series-page.js`, `src/cli/build.js`, `test/series-page.test.js` |
| 2 | `1.2.2` | G4: Profile sketch SVG renderer | `soil-series-viewer` | `1.1.1`, `1.1.3` | `src/render/profile-sketch.js`, `test/profile-sketch.test.js` |
| 3 | `1.3.1` | Wire G4 sketch into G2 + AMADOR check | `soil-series-viewer` | `1.2.1`, `1.2.2` | `src/render/series-page.js`, `src/cli/build.js`, `test/integration.test.js` |

---

## Task Specs

### Task 1.1.1: Repo scaffold + Data loader (G1)
- **id:** `1.1.1`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** none
- **files-in-scope:**
  - *can create:* `package.json`, `.gitignore`, `src/loader/keys.js`, `src/loader/normalize.js`, `src/loader/index.js`, `test/loader.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `docs/`, `planning/`, any sibling repo.
- **spec:**
  1. Initialize `package.json` with `"name": "soil-series-viewer"`, `"type": "module"`, `"scripts": { "test": "node --test" }`, and `.gitignore` ignoring `node_modules/`, `dist/`, `.development/`.
  2. Implement `src/loader/keys.js`: `seriesNameToKey(name)` (trim, uppercase, space→`_`, backtick→`@`, preserve periods) and `keyToRelativePath(key, ext)` returning `<FIRST_LETTER>/<KEY>.<ext>`.
  3. Implement `src/loader/normalize.js`:
     - `SKB-1`: unwrap `HORIZONS` from `[[...]]` to `[...]`, and `SITE` from `[[...]]` to `[...]`.
     - `SKB-12`: strip leading `<SECTION_HEADER>:` prefix from each section's `content`.
     - `SKB-17`: recursively convert string `"NA"` to `null`.
  4. Implement `src/loader/index.js`:
     - Parse `OSDR/SC/SCDB.csv` (RFC 4180 CSV with quoted fields).
     - Load SKB JSON files from `SKB/inst/extdata/OSD/{A..Z}/<KEY>.json` (support optional `seriesFilter` array or `limit` for fast runs).
     - Join SC rows with SKB JSON by normalized key across all statuses (Established, Tentative, Inactive) plus unclassified SKB docs (no SC row).
     - Return `{ records, report }` where `report` includes counts of total SC, total SKB, matched by status, SC-only, and SKB-only (unclassified).
- **anchors & references:**
  - `docs/research/soil-series-viewer-research.md` §2.1, §4.1, §7.1
  - `docs/research/skb-issues.md` (SKB-1, SKB-12, SKB-17)
  - Pattern reference: `/home/andrew/workspace/openssurgo/soillite/scripts/build_artifacts.py:780-860`
- **acceptance:** `node --test test/loader.test.js` passes, verifying `AMADOR`, `MT._AIRY`, `KANA@A`, SKB-1/12/17 normalization, and full-corpus coverage report counts.

### Task 1.1.2: Old-school stylesheet (G3)
- **id:** `1.1.2`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** none
- **files-in-scope:**
  - *can create:* `src/styles/usdastyle.css`, `test/styles.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `package.json`, `src/loader/`, `docs/`, `planning/`.
- **spec:**
  1. Create `src/styles/usdastyle.css` implementing CSS custom properties and rules derived from `docs/research/reference/usdastyle_css_capture.css` and `supplemental_css_capture.css`:
     - Page chrome `#3e3e3e`, white `#ffffff` body container (`max-width: 767px`, centered), black `#000000` text.
     - Font stack: `Verdana, Geneva, sans-serif` at `11px` for chrome/tables, readable serif/body styling for OSD narrative.
     - Table headers `#248621` background with `#228623` border and `#ffffff` text.
     - Links `#000099`, visited `#660099`, hover underline; footer top border `#B8B8B8`.
     - Layout classes for the series page header, two-column Typical Pedon + profile sketch container (collapsing cleanly on narrow viewports via `@media (max-width: 767px)`), and `@media print` rules (white background, no chrome).
  2. Create `test/styles.test.js` using `node:test` asserting all required palette tokens, responsive breakpoint, and print rules are present.
- **anchors & references:**
  - `docs/research/reference/usdastyle_css_capture.css` (lines 1-2, 84-147, 175-198, 531-535)
  - `docs/research/soil-series-viewer-research.md` §3.2
- **acceptance:** `node --test test/styles.test.js` passes.

### Task 1.1.3: Upstream `SoilProfiles.js` Munsell LUT fix (G5)
- **id:** `1.1.3`
- **repo:** `/home/andrew/workspace/SoilProfiles.js`
- **depends-on:** none
- **files-in-scope:**
  - *must edit:* `src/core/munsell.ts`
  - *can create/edit:* `src/core/munsell-lut.ts` (or generated data module from `soilprofiles-munsell/munsell-data.json`), `src/utils/munsell-approx.ts`, Munsell test file(s), `dist/*` (via `npm run build`)
  - *temp/scratch:* `.development/`
- **do-not-touch:** unrelated renderers (`three3d`, `interactive`), `soil-series-viewer`.
- **spec:**
  1. Convert/wire the 10,450-row LUT in `soilprofiles-munsell/munsell-data.json` into `src/core/munsell.ts` so `munsellToHex(hue, value, chroma)` performs an exact/nearest LUT lookup for standard soil hues (`2.5YR`, `5YR`, `7.5YR`, `10YR`, `2.5Y`, `5Y`, etc.) before falling back to `munsellToRgbApprox`.
  2. Preserve neutral `N` hue handling and invalid-input behavior.
  3. Add unit tests verifying `munsellToHex('10YR', 4, 2) !== munsellToHex('5YR', 4, 2)` and checking known reference values (e.g., `10YR 4/2`, `5YR 4/2`, `7.5YR 5/4`, `2.5Y 6/2`, `N 4/0`).
  4. Run `npm test && npm run build` to verify Jest passes and `dist/` builds cleanly.
- **anchors & references:**
  - `src/core/munsell.ts` (79 lines)
  - `src/utils/munsell-approx.ts:27-70, 196-264`
  - `soilprofiles-munsell/munsell-data.json` (10,451 lines; note JS object-literal syntax)
  - Standalone agent prompt: `planning/G5_SOILPROFILES_PROMPT.md`
- **acceptance:** `npm test && npm run build` exits 0; Node one-liner importing `./dist/index.esm.js` confirms `munsellToHex('10YR', 4, 2) !== munsellToHex('5YR', 4, 2)`.

### Task 1.2.1: Series page v1 HTML generator + CLI (G2)
- **id:** `1.2.1`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** `1.1.1`, `1.1.2`
- **files-in-scope:**
  - *can create:* `src/render/series-page.js`, `src/cli/build.js`, `test/series-page.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `src/loader/*`, `src/styles/usdastyle.css`, `src/render/profile-sketch.js`.
- **spec:**
  1. Implement `renderSeriesPage(record, options)` in `src/render/series-page.js`:
     - Reproduces old OSD anatomy: `LOCATION <NAME> <STATES>`, status, `BYREV`, `REVDATE`, `<h1><NAME> SERIES</h1>`, overview, ordered NSSH sections with bold labels (`<strong>TAXONOMIC CLASS:</strong>`), bold horizon designations in Typical Pedon, and footer `National Cooperative Soil Survey / U.S.A.`.
     - Links `usdastyle.css` and includes plain download links for raw `<KEY>.txt` and `<KEY>.json`.
     - Accepts optional `sketchSvg` string slot (rendered beside Typical Pedon when provided; omitted cleanly when null).
     - Escapes all HTML entities properly.
  2. Implement `src/cli/build.js` supporting `--series AMADOR,MT._AIRY`, `--limit N`, `--out dist`, copying `usdastyle.css` and per-series raw `.txt` (when present) and `.json` downloads alongside `OSD_Docs/<L>/<KEY>.html`.
  3. Write `test/series-page.test.js` comparing rendered `AMADOR` HTML sections and headers against `docs/research/reference/osd_AMADOR_20260308005129.html`.
- **anchors & references:**
  - `docs/research/reference/osd_AMADOR_20260308005129.html`
  - `docs/research/soil-series-viewer-research.md` §3.1, §4.1
- **acceptance:** `node --test test/series-page.test.js` passes.

### Task 1.2.2: Profile sketch SVG renderer (G4)
- **id:** `1.2.2`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** `1.1.1`, `1.1.3`
- **files-in-scope:**
  - *can create:* `src/render/profile-sketch.js`, `test/profile-sketch.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `src/loader/*`, `src/styles/usdastyle.css`, `src/render/series-page.js`, `src/cli/build.js`.
- **spec:**
  1. Implement `renderProfileSketch(record, options)` in `src/render/profile-sketch.js` importing `SoilProfiles.js` from `/home/andrew/workspace/SoilProfiles.js/dist/index.esm.js` (or package dependency).
  2. Map normalized `record.horizons` to `SoilProfile` horizons:
     - `SKB-9` fallback: use moist Munsell color if present, else dry Munsell color, else neutral gray fallback (`#cccccc` / hatched unknown).
     - `SKB-10` fallback: omit horizons missing `top` or `bottom` depth from the sketch and return `{ svg, omittedHorizons }`.
  3. Call `renderStaticSVG` and return `{ svg, omittedHorizons }`.
  4. Write `test/profile-sketch.test.js` verifying `AMADOR` produces a valid `<svg>` with accurate `10YR` fills (not `5YR` collapsed), and testing missing-color and missing-depth fallbacks.
- **anchors & references:**
  - `docs/research/soil-series-viewer-research.md` §6
  - `docs/research/skb-issues.md` (SKB-9, SKB-10)
- **acceptance:** `node --test test/profile-sketch.test.js` passes.

### Task 1.3.1: Wire G4 sketch into G2 series page & end-to-end AMADOR check
- **id:** `1.3.1`
- **repo:** `/home/andrew/workspace/soil-series-viewer`
- **depends-on:** `1.2.1`, `1.2.2`
- **files-in-scope:**
  - *must edit:* `src/cli/build.js`
  - *can create:* `test/integration.test.js`
  - *temp/scratch:* `.development/`
- **do-not-touch:** `src/loader/*`, `src/styles/usdastyle.css`.
- **spec:**
  1. Wire `renderProfileSketch` into `src/cli/build.js` so each generated `OSD_Docs/<L>/<KEY>.html` embeds the profile sketch SVG in the `sketchSvg` slot.
  2. Write `test/integration.test.js` that runs the CLI for `--series AMADOR,MT._AIRY,KANA@A` into a temp dir and verifies HTML, embedded `<svg>`, `usdastyle.css`, and `.txt`/`.json` downloads exist and are non-empty.
- **acceptance:** `npm test` (full suite) passes with 0 failures.
