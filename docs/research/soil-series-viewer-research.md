# Soil Series Viewer: Research Brief

Status: research input for `/magic-wand` (planning/GOALS.md) and later wave-orchestration plans.
Date of research: 2026-11-26. Every claim cites a local `file:line` or a URL. Items marked **(inferred)** are the author's interpretation, not something read directly from a source. Local repos were read only and not modified.

Conventions: `OSDR` = `/home/andrew/workspace/OSDRegistry`, `SKB` = `/home/andrew/workspace/SoilKnowledgeBase`, `OSS` = `/home/andrew/workspace/openssurgo`, `SL` = `OSS/soillite`, `SPJ` = `/home/andrew/workspace/SoilProfiles.js`, `GPS` = `/home/andrew/workspace/geolibre-plugin-soillite`, `DST` = `/home/andrew/workspace/DST`, `SDB` = `/home/andrew/workspace/soilDB`, `REF` = `docs/research/reference/` (this repo).

User framing decisions applied in this document (from the coordinator, 2026-11-26):
- **SKB JSON is the structured source.** We do not write a new OSD txt parser. Raw `.txt` is offered as a plain download only. Where SKB JSON lacks something the old pages showed, it is listed as a gap or open question (sections 4 and 9).
- **SoilWeb/SDE and soilDB `fetchOSD(extended=TRUE)` are feature inspiration only.** No SoilWeb data values are used or saved as fixtures (sections 3.4 and 8).

---

## 0. Decisions recorded (2026-11-26)

- **SKB output is used as is.** No patching, forking or re-parsing of SKB JSON. Known defects are listed in [`skb-issues.md`](skb-issues.md) (SKB-1 to SKB-17, verified at SKB `origin/main` `fbf3e54e61`). The viewer handles each one on the display side and treats the narrative as authoritative.
- **Raw OSD `.txt`** is offered as a plain source-file download with no markup.
- **SoilWeb SDE and soilDB `fetchOSD`** are feature inspiration only. No SoilWeb data is used.
- **URLs mirror the old site** (`OSD_Docs/<L>/<NAME>.html`) through URL rewriting. Not every page has to exist as a static HTML file; dynamic or client-rendered pages behind rewritten paths are fine.

## 1. Executive summary

1. **The data pipeline already exists upstream and is live.** OSDRegistry scrapes NRCS weekly (cron `0 0 * * 1`, `OSDR/.github/workflows/refresh-osd.yml:9`). The latest upstream commit is "OSD Data Refresh - 2026-11-16" and the release ZIPs were updated 2026-11-23 (GitHub API, section 11). SKB turns those files into JSON every Monday at 06:00 (`SKB/.github/workflows/refresh-extdata.yml:3`). The local OSDRegistry checkout is stale: HEAD `6926171` (2026-03-23) versus remote `b60d0e7`.
2. **Corpus size.** There are 24,928 SKB OSD JSON files (347 MB, median 13.5 KB each), 24,807 local OSD `.txt` files (215 MB), and 26,576 SC rows (23,432 Established, 1,943 Tentative, 1,201 Inactive). Measured in section 2.
3. **Old OSD pages were almost unstyled HTML 3.2.** They used `<H1>`, `<B>` section labels, `<BR>` and `BGCOLOR="#ffffff"`, with no CSS and no scripts. The only links were to competing and associated series (`REF/osd_AMADOR_20260308005129.html`). The search and home pages used ASP.NET WebForms with an `usdastyle.css` look: dark `#3e3e3e` page background, a white 767 px body, Verdana 11 px, green `#248621` table headers, and links in `#000099` / visited `#660099`. The OSD HTML endpoint now returns a "500 - Internal server error" page with HTTP status 200 (checked live 2026-11-26).
4. **SKB JSON structure.** It has 15 top-level text sections, each `{section, content}`, plus `SITE` (drainage) and `HORIZONS`. HORIZONS holds 21 fields per horizon, including Munsell dry/moist, texture, structure, rupture, pH, boundary and narrative. It is nested one level deep (`HORIZONS[0][...]`) in 24,906 of 24,928 docs. Main-branch JSON has no parsed RIC. A large RIC parser exists only on the `osd-ric-dev2` branch (2,331 lines).
5. **Known SKB parse defects visible to users.** Greedy regexes turn "slightly hard" into `dry_rupture: "hard"` (`SKB/R/parseOSD_functions.R:257-259`, seen in AMADOR). Moist hue is missing for 16,786 of 144,414 horizons (11.6%) and depths for 5,021. Paragraph breaks and indentation are dropped before JSON (`SKB/R/create_OSD.R:98`).
6. **openssurgo/soillite series display.** The display is mostly passthrough of SKB fields (`SL/scripts/build_artifacts.py:797-860`). The custom calculations are a content-addressed `variant_id` (`SL/plugin_api/series_identity.py:86-105`), name normalization, Munsell to hex (in SoilProfiles.js), SSURGO map-unit aggregations (dominant condition, weighted and depth-weighted averages in Python) and series-to-survey-area membership. All of them are portable. Two hard-coded URLs are broken: the OSD HTML link (`SL/frontend/index.html:2715-2717`) and the SKB JSON link for multi-word names (`SL/core/app.py:996`).
7. **SoilProfiles.js renders SVG strings in plain Node.** I verified `renderStaticSVG()` in Node 24: a 45x200 thumbnail is about 6.8 KB. This allows build-time pre-rendering. Two caveats:
   - `parseOSDJson()` does not handle SKB's nested `HORIZONS` and yields 0 horizons for AMADOR.
   - Munsell to RGB only knows the 5R/5YR/5Y/5G/5B/5P hue anchors, so 10YR renders the same as 5YR (`#6e5f4d` for both 10YR 4/2 and 5YR 4/2).
8. **Taxonomy sources are rich and joinable.**
   - The SC table carries order to family columns. Distinct counts: 12 orders, 75 suborders, 318 great groups, 1,767 subgroups, 12,409 family classes.
   - SKB parses KST 2014 (12th, EN/SP) and 2022 (13th, EN) into codes and criteria JSON (3,153 codes for 2022).
   - DST `data/dst-data.json` reuses exactly the SKB 2022 codes and adds navigation indices and a 136-term glossary.
   - All 12 SC orders match KST 2022. 30 Established series carry great groups that do not exist in KST 2022 (obsolete taxa).
9. **Recommendation: a Node (TypeScript or plain ESM) static generator.**
   - It reads SKB JSON, SC CSV and the KST/DST JSON, and pre-renders SoilProfiles.js SVG.
   - It writes one HTML page per series in the old OSD visual idiom, plus taxonomy-tree, letter and state index pages.
   - It uses a compact client-side JSON index for the home-page profile gallery and filters, and Pagefind for full-text search.
   - Builds are incremental, keyed by an input content hash, and run weekly after SKB refreshes.
10. **Top decisions for the user.**
    - Hosting target: GitHub Pages has a 1 GB published-size cap.
    - Whether to depend on SSURGO (local `/data/SSURGO/data/SSURGO.duckdb`, 126 GB) for extent, map units and geomorphic summaries, or stay OSD+SC-only for v1.
    - Which KST edition to show.
    - Whether to fix parse gaps upstream in SKB or annotate them in the viewer.
    - Whether to show Tentative and Inactive series.

---

## 2. Inventory of local data assets

| Asset | Path | Format | Count / size | Freshness | Naming / notes | License |
|---|---|---|---|---|---|---|
| Raw OSD text | `OSDR/OSD/{A..Z}/<NAME>.txt` | plain text (CRLF-free, written by `write(readLines(f))`, `OSDR/R/registry.R:193-200`) | 24,807 files, 215 MB | local HEAD 2026-03-23 (`git log`); upstream 2026-11-16 | `UPPER`, space→`_`, period kept (`MT._AIRY.txt`), backtick→`@` (`KANA@A.txt`); 522 names contain `_`. An inconsistency: `MT_ROGERS.txt` has no period | Package code GPL-3 (`OSDR/DESCRIPTION`). OSD content is a USDA work, public domain in the US **(inferred: 17 U.S.C. 105, as stated for SKB in `SKB/LICENSE.md:28`)** |
| Series Classification (SC) | `OSDR/SC/SCDB.csv` | CSV, 23 columns | 26,576 rows, 7.0 MB | same as above | written at `OSDR/R/registry.R:204-216` via `soilDB::get_soilseries_from_NASISWebReport(soils="%")` (`OSDR/R/nasis_sc_db.R:12-14`) | same |
| Weekly snapshot ZIPs | GitHub release `main`: `OSD-data-snapshot.zip` (69.8 MB), `SC-data-snapshot.zip` (0.93 MB) | ZIP within ZIP (`SKB/R/create_OSD.R:60`) | | updated 2026-11-23 | built at `OSDR/.github/workflows/refresh-osd.yml:37-41,58` | |
| OSD style guide | `OSDR/misc/GUIDELINES.R:1-40` | comments transcribed from NSSH | 19 required sections; 66-column margin; first 8 lines and last line standardized | | | |
| SKB OSD JSON | `SKB/inst/extdata/OSD/{A..Z}/<NAME>.json` | JSON, pretty, `na='string'` (`SKB/R/create_OSD.R:415`) | 24,928 files, 347 MB; median 13,502 B, max 37,765 B | HEAD `fbf3e54` 2026-11-09 | same file naming as the txt; 121 JSON have no local txt because the local OSDR is stale | MIT + 17 U.S.C. 105 (`SKB/LICENSE.md:3-4,28`) |
| SKB OSD parse log | `SKB/inst/extdata/OSD/OSD.log`, `SKB/inst/extdata/OSD-error-reporting/{log.txt,misc-errors.txt,taxclassname-errors.csv,RO/,state/}` | text/CSV | 928 KB | | Per-file "CHECK …" warnings (`SKB/R/create_OSD.R:126,146,166,185,209,235`) | |
| SKB KST | `SKB/inst/extdata/KST/` | txt, JSON, rda | 2014 (12th) EN+SP, 2022 (13th) EN; criteria JSON about 3 MB each; codes about 190 KB | last extdata KST commit 2023-09-04 | see section 6 | |
| DST taxonomy data | `DST/data/dst-data.json` (6.7 MB), `DST/glossary_matches.json` (1.0 MB) | JSON v3.2.0 | 3,153 codes, 7,324 navigation criteria, 3,073 outcomes, 136 glossary terms | generated 2026-02-16; HEAD `5440a00` 2026-11-18 | see section 6 | MIT (`DST/LICENSE`, `DST/package.json`) |
| SoilProfiles.js | `SPJ/dist/*` (built 2026-09-17), `SPJ/SoilProfiles.js` (1.3 MB git-ignored IIFE bundle, Jun 27, `SPJ/.gitignore:3`) | JS (CJS/ESM/UMD) | `index.umd.min.js` 49.9 KB | v0.2.0 (`SPJ/package.json`) | | MIT (`SPJ/LICENSE`) |
| Munsell LUT (unused) | `SPJ/soilprofiles-munsell/munsell-data.json` | JS-object-literal text, not valid JSON (unquoted keys) | 10,450 hue/value/chroma→rgb rows, 770 KB | May 31 | `munsellData` array in `munsell.ts` is empty; LUT not wired (`SPJ/soilprofiles-munsell/munsell.ts:9-12`) | provenance not documented **(inferred: similar to the aqp munsell table)** |
| soillite vendored bundle | `SL/frontend/js/SoilProfiles.js` | IIFE | | rebuild instructions in `SL/UPDATE_SOILPROFILES.md:14-19` | | |
| geolibre plugin | `GPS/node_modules/soilprofiles` | npm `soilprofiles@0.1.2` (`GPS/package-lock.json:3942-3944`) | | older than local 0.2.0 | | plugin MIT (`GPS/LICENSE`) |
| SSURGO database | `/data/SSURGO/data/SSURGO.duckdb` (126 GB, Oct 5), `/data/SSURGO_FY26.duckdb` (123 GB) | DuckDB, 70 tables | `component` 1,204,880 rows; has `cogeomordesc, copm, copmgrp, comonth, cosurfmorph*, coecoclass, laoverlap, mupolygon, muaggatt` | Oct 2026 | used by soillite builds (`SL/AGENTS.md`, `regenerate_state_tables.py`) | public USDA data **(inferred)** |
| Series extent layers | `/home/andrew/workspace/series-extent/output/*_tol250.fgb` (7.9 MB) + `figures/*.png` | FlatGeobuf | 9 layers (compname to taxorder) | 2026-08-28 | R targets pipeline over SSURGO.duckdb (`series-extent/README.md`) | |
| SoilTaxonomy R pkg | `/home/andrew/workspace/SoilTaxonomy/data/*.rda` | rda | `ST_family_classes`, `ST_formative_elements`, `ST_higher_taxa_codes_{12th,13th}`, `ST_criteria_13th`, `ST_features` | HEAD 2026-11-26 | optional source for family-class and formative-element definitions | GPL (>= 3) (`SoilTaxonomy/DESCRIPTION`) |

Counts above come from the scratch scripts described in section 11 (Python, read-only).

### 2.1 Cross-source coverage (join key = `toupper(name)` with space→`_`)

| SC status | SC rows | with OSD txt (local) | with SKB JSON |
|---|---|---|---|
| Established | 23,432 | 23,426 | 23,426 |
| Tentative | 1,943 | 1,120 | 1,138 |
| Inactive | 1,201 | 225 | 226 |

- 36 OSD txt and 138 SKB JSON names have no SC row (e.g. `ABO`, `ANASAZI`, `ELM_LAKE`). They need a policy: show them as "unclassified".
- SKB `STATUS` strings: "Established Series" 23,601, "Tentative Series" 1,095, "Inactive Series" 231, and "Established series" 1 (casing drift).
- SC names that contain characters other than A-Z: 31 (e.g. `MT. AIRY`, `FT. DRUM`, ``KANA`A``). 587 contain a space and 2 an apostrophe or backtick. A filename mapper is needed: space→`_`, backtick→`@` (from the observed `KANA@A.txt`).

---

## 3. Old OSD HTML page anatomy (Internet Archive)

Captures were saved under `REF/` as untrusted data and never executed. SHA-256 values:

| File | Source URL (archive timestamp) | sha256 |
|---|---|---|
| `osd_AMADOR_20260308005129.html` | https://web.archive.org/web/20260308005129id_/https://soilseries.sc.egov.usda.gov/OSD_Docs/A/AMADOR.html (byte-identical to the 20220816135024 capture) | b71e1af8…d1f9 |
| `osdname_20201030203242.html` | https://web.archive.org/web/20201030203242id_/https://soilseries.sc.egov.usda.gov/osdname.aspx | 3ab91f72…aec |
| `osd_home_20201129164421.html` | https://web.archive.org/web/20201129164421id_/https://soilseries.sc.egov.usda.gov/ | 5081638d…472b |
| `usdastyle_css_capture.css` | https://web.archive.org/web/2020id_/https://soilseries.sc.egov.usda.gov/Resources/usdastyle.css | d9518b40…c8f |
| `supplemental_css_capture.css` | https://web.archive.org/web/2020id_/https://soilseries.sc.egov.usda.gov/Resources/supplemental.css | 1b89dbe4…3f9 |

CDX listings show AMADOR.html captures from 20140830061036 to 20260308005129 (https://web.archive.org/cdx/search/cdx?url=soilseries.sc.egov.usda.gov/OSD_Docs/A/AMADOR.html). A live check on 2026-11-26 of https://soilseries.sc.egov.usda.gov/OSD_Docs/A/AMADOR.html returned HTTP 200 with the body "500 - Internal server error". The home page and `osdname.aspx` still return 200.

### 3.1 Per-series page (`OSD_Docs/<L>/<NAME>.html`)

- **Markup** (`REF/osd_AMADOR_20260308005129.html`): `<HTML><HEAD><TITLE>Official Series Description - AMADOR Series</TITLE></HEAD><BODY BGCOLOR="#ffffff" TEXT="#000000">`. Tag counts: 102 `<BR>`, 18 `<B>`, 8 `<A>`, 1 `<H1>`, 1 `<HR>`. There is no CSS, no `<p>` and no script, so it renders in browser-default Times **(inferred)**.
- **Line-faithful header**: `LOCATION AMADOR&nbsp;…&nbsp;CA`, then status, `Rev.` initials and revision date, each on its own line with `<BR>`. It mirrors the first lines of the txt (`OSDR/OSD/A/AMADOR.txt:1-4`).
- **Heading**: `<H1>AMADOR SERIES</H1>`, followed by the overview paragraph.
- **Sections**: each starts with a bold label (`<B>TAXONOMIC CLASS:</B>`) and paragraphs are separated by `<BR><BR>`. Order follows NSSH (`OSDR/misc/GUIDELINES.R:1-19`): Taxonomic class, Typical pedon, Type location, RIC, Competing series, Geographic setting, Geographically associated soils, Drainage and permeability, Use and vegetation, Distribution and extent, SSRO responsible, Series established, Remarks, Additional data.
- **Horizons**: `<B>    A</B>--0 to 15 cm; …`. Only the horizon designation is bold, and the leading spaces are kept inside `<B>`.
- **Cross-links**: in COMPETING SERIES and GEOGRAPHICALLY ASSOCIATED SOILS, each series name is an absolute link `<A HREF="https://soilseries.sc.egov.usda.gov/OSD_Docs/B/BORREGUERO.html">Borreguero</A>` (capture lines 110-123). No other sections carry links.
- **Footer**: `<HR>National Cooperative Soil Survey<BR>U.S.A.`
- **No navigation** back to search or index pages, and no figures.

### 3.2 Site chrome: home and "View by Name"

- Home page (`REF/osd_home_20201129164421.html`), titled "Web Site for Official Soil Series Descriptions and Series Classification". It has two link groups:
  - OSD: `osdname.aspx` (by name, with best-match or wildcards), `osdlist.aspx` (list, with download) and `osdquery.aspx` (query, with download).
  - SC: `scname.aspx`, `sclist.aspx`, `screports.aspx`, `screports_us.aspx` (national report).
  - Each group has GovDelivery email sign-up links.
- `osdname.aspx` (`REF/osdname_20201030203242.html`): an ASP.NET WebForms form with `__VIEWSTATE`, one `series_name` text box, and "Submit" and "Clear Form" buttons. Results appear in a fixed `pan_report` div (`height:500px;width:745px;overflow:auto`).
  - The directions text says an exact match shows the OSD "with a link to the Series Extent Map at the end". A non-match shows "best-matched series names" with OSD and Series Extent Map links. Wildcards are documented on `osdquery_wild.aspx`.
  - A banner image map links to USDA and NRCS. The footer links NRCS, USDA, FOIA, Accessibility, Privacy and so on, plus a JS `alert()` disclaimer.
- Styling (`REF/usdastyle_css_capture.css`):
  - `body{background-color:#3e3e3e}` (line 1-2). `.cUSDABackground` is `#3e3e3e` and `.cLightBody` is white/black (`REF/supplemental_css_capture.css:26-37`). The body table is `width="767px"` (osdname capture).
  - `P, LI, UL` use `FONT-FAMILY: Verdana; FONT-SIZE: 11px` (lines 84-112).
  - `A:link #000099`, `A:visited #660099`, `A:hover` underline (lines 123-147).
  - Table headers: `TH.THBorder` white on `#248621` with `#228623` borders (lines 175-198). `.footertable` has a `#B8B8B8` top border (line 531-535). Form labels are Arial (inline styles).
- **Query endpoints still used by OSDRegistry**: `osdquery.aspx`, `osdquery_view.aspx?query_file=…` and `download` (`OSDR/R/download.R:22-90`). Upstream refreshes succeeding through 2026-11-16 suggest the query/download path still works while the static `OSD_Docs` HTML path is broken **(inferred)**.

### 3.3 Reproduce vs exceed

| Feature | Old OSD site | Reproduce | Exceed (proposal) |
|---|---|---|---|
| Per-series page | `OSD_Docs/L/NAME.html` | Same URL shape (`/OSD_Docs/A/AMADOR.html` or `/series/A/AMADOR.html`) so old links can be rewritten | Stable permalinks plus redirects for renamed or inactive series |
| Line-faithful header (LOCATION/status/Rev/date) | yes | yes, from SKB `SERIES/STATUS/BYREV/REVDATE/STATES` | Status badge, a revision date that can be sorted |
| H1 + bold section labels + `<BR>` paragraphs | yes | yes, in the same visual idiom | Semantic `<section id>` anchors, a table of contents and print CSS |
| Bold horizon designations in Typical Pedon | yes | yes, from `HORIZONS[].name/narrative` | Inline Munsell swatches, a horizon table, and a profile sketch next to the text |
| Cross-links in Competing / Associated | yes (absolute URLs) | yes. **Gap:** SKB JSON has only plain text, so links must be made by matching names against SC (section 4.3) | Hover cards with taxonomy and a mini sketch |
| Search by name with best-match and wildcard | yes (server) | client-side prefix, fuzzy and wildcard search over the name index | Faceted filters (status, order…subgroup, family classes, state, MLRA office, benchmark), full-text search via Pagefind |
| Lists and queries with download | yes (ZIP of txt) | per-series `.txt` and `.json` download links | Bulk ZIP per filter **(future)** |
| SC reports by name or query | yes | per-series SC table block | Taxonomy tree browse pages and CSV export |
| Link to Series Extent Map | yes (SEE) | link out, or our own extent map when SSURGO is in scope | |
| Styling | Verdana 11 px, dark chrome, green headers | an "old-school" theme using the same palette tokens | responsive layout, dark mode, accessibility |
| Figures | none | n/a | SoilProfiles.js sketches on every page and in the home gallery |

### 3.4 SoilWeb Soil Data Explorer (SDE): feature inspiration only

**No SDE data is used, and none was saved as fixtures.** The capture was read in the scratchpad only: https://web.archive.org/web/20260212162714id_/https://casoilresource.lawr.ucdavis.edu/sde/?series=amador. The CDX index (`…/cdx/search/cdx?url=casoilresource.lawr.ucdavis.edu/sde/?series=&matchType=prefix`) shows many 2022-2026 captures. Features observed:

- **Tabbed single page** (`#osd, #lab-data, #water-balance, #sibling-summary, #competing-series, #shared-subgroup, #block-diagrams, #map-units, #extent`) with jQuery autocomplete for series search (`jquery.autocomplete.min.js`, `series_suggest.js`).
- **OSD tab** embeds the NRCS OSD HTML in a frame and falls back to a link.
- **Lab data**: slice-wise median and 5th/95th percentile depth plots from KSSL pedons, plus a table of pedons with links to NCSS Lab Data Mart and NASIS reports and a GMap location link.
- **Water balance**: monthly PPT/PET (PRISM 1981-2010, Thornthwaite) leaky-bucket bar and line figures. AWC is taken as the 50th percentile of profile water storage.
- **Sibling summary**: sketches of co-occurring series arranged by subgroup structure, annual climate summaries sorted by clustering, and geomorphic proportion bars with record counts and Shannon entropy, with explanation diagrams (Wysocki 2000, Ruhe 1969).
- **Competing series**: same-family sketches, climate and geomorphology.
- **Shared subgroup**: a D3 tree (`d3.v4`, `/seriesTree-data/subgroups/typic_haploxerepts.json`) arranged by family differentiae. Hovering shows the full classification and a small OSD sketch PNG.
- **Block diagrams** from published soil surveys, shown in a modal.
- **Map units** table: name, symbol, acres, mukey, nationalmusym, SSA, publication date, scale; limited to 250 rows.
- **Extent**: a Leaflet map with a link to the Series Extent Explorer (`/see/#amador`).
- Every figure is a click-to-enlarge modal image, and each section names its data sources and snapshot dates.

Takeaways for "exceed": a tabbed or anchored single page, provenance stamps on each section, a shared-subgroup tree, sibling and competing sketch strips, and click-to-enlarge figures.

---

## 4. Parsed JSON schema (SKB) and gaps vs raw txt

### 4.1 Exact schema (main branch)

Produced by `validateOSD()` (`SKB/R/create_OSD.R:87-366`) plus `.doParseOSD()` (`SKB/R/parseOSD_functions.R:13-34`), and written at `SKB/R/create_OSD.R:405-415`.

```text
{
  SERIES:  str            # from "AMADOR SERIES" line (create_OSD.R:182, 355)
  STATUS:  str            # line after LOCATION, e.g. "Established Series" (:356)
  BYREV:   str            # "Rev. AJT/WBS/..." (:357)
  REVDATE: str            # "10/2018" (:358)
  STATES:  str            # comma list from LOCATION line (:199-205, 359)
  OVERVIEW: str           # text between "<NAME> SERIES" and TAXONOMIC CLASS (:105-116, 360)
  "TAXONOMIC CLASS" | "TYPICAL PEDON" | "TYPE LOCATION" | "RANGE IN CHARACTERISTICS" |
  "COMPETING SERIES" | "GEOGRAPHIC SETTING" | "GEOGRAPHICALLY ASSOCIATED SOILS" |
  "DRAINAGE AND PERMEABILITY" | "USE AND VEGETATION" | "DISTRIBUTION AND EXTENT" |
  "REGIONAL OFFICE" | "ORIGIN" | "REMARKS" | "ADDITIONAL DATA":
        { section: str,   # the header text actually found (may differ, e.g. "SERIES ESTABLISHED")
          content: str }  # header line included; lines joined by "\n"; "NA" if missing (:246-274, 337-338)
  SITE:     [[ { drainage: str, drainage_overview: str } ]]       # parseOSD_functions.R:273-301
  HORIZONS: [[ { name, top:int cm, bottom:int cm,
                 dry_hue, dry_value, dry_chroma, moist_hue, moist_value, moist_chroma,
                 texture_class, structure, dry_rupture, moist_rupture, coherence,
                 cf_class, pH:float, pH_class, eff_class, distinctness, topography,
                 narrative } ]]                                    # parseOSD_functions.R:466-512
}
```

Example (`SKB/inst/extdata/OSD/A/AMADOR.json`, abridged):

```json
{"SERIES":"AMADOR","STATUS":"Established Series","BYREV":"Rev. AJT/WBS/DJE/ET/AGB/TKK/JW",
 "REVDATE":"10/2018","STATES":"CA","OVERVIEW":"The Amador series consists of shallow, well drained soils ...",
 "TAXONOMIC CLASS":{"section":"TAXONOMIC CLASS","content":"TAXONOMIC CLASS: Loamy, mixed, superactive, thermic, shallow Typic Haploxerepts"},
 "REGIONAL OFFICE":{"section":"SOIL SURVEY REGIONAL OFFICE (SSRO) RESPONSIBLE","content":"SOIL SURVEY REGIONAL OFFICE (SSRO) RESPONSIBLE: Davis, California"},
 "SITE":[[{"drainage":"well","drainage_overview":"well"}]],
 "HORIZONS":[[{"name":"A","top":0,"bottom":15,"dry_hue":"10YR","dry_value":7,"dry_chroma":2,
   "moist_hue":"10YR","moist_value":4,"moist_chroma":2,"texture_class":"loam",
   "structure":"moderate coarse subangular blocky","dry_rupture":"hard","moist_rupture":"friable",
   "coherence":"NA","cf_class":"NA","pH":5.1,"pH_class":"strongly acid","eff_class":"NA",
   "distinctness":"clear","topography":"wavy",
   "narrative":"A--0 to 15 cm; light gray (10YR 7/2) loam, dark grayish brown (10YR 4/2) moist; ..."}, ...]]}
```

Corpus statistics over 24,928 docs:
- `HORIZONS` is nested `[[...]]` in 24,906 docs.
- There are 144,414 horizon entries in total. `moist_hue` is "NA" in 16,786, `dry_hue` in 54,369, `texture_class` in 14,376, and `top`/`bottom` in 5,021.
- Section `content == "NA"` counts: ADDITIONAL DATA 15,880, REMARKS 1,162, GEOGRAPHICALLY ASSOCIATED SOILS 512, ORIGIN 97, COMPETING SERIES 94, DISTRIBUTION AND EXTENT 77, RIC 68, TYPICAL PEDON 11, TAXONOMIC CLASS 4.

### 4.2 Parsing semantics that matter for display

- Text is transliterated to ASCII (`stri_trans_general(raw,"Latin-ASCII")`, `create_OSD.R:96`). Then **all blank lines are removed and every line is trimmed** (`:98`), so paragraph breaks and horizon indentation are lost. The old HTML kept them as `<BR><BR>`.
- The section `content` keeps the header text ("TAXONOMIC CLASS: …"). Consumers strip it themselves, as `SL/scripts/build_artifacts.py:811` does with `.replace("TAXONOMIC CLASS: ","")`.
- When a section header occurs more than once, the parts are joined with `" & "` (`create_OSD.R:345`).
- Colors: the default moisture state is detected from "colors are for dry/moist soil" (`parseOSD_functions.R:325-339`). Only the **first** dry and first moist color per horizon is kept (`:437-444`).
- Depths are converted from inches to cm using the first horizon's unit (`:483-488`).
- `.parse_rupture_dry/_moist/_cem` use a leading greedy `.*` before the alternation (`parseOSD_functions.R:257-267`). As a result "slightly hard" becomes "hard" and "very friable" becomes "friable" **(inferred from the regex; confirmed by AMADOR `dry_rupture:"hard"` when the narrative says "slightly hard")**. The same pattern affects `.parse_structure` (`:253-255`).
- `.parse_CF` is documented as "too greedy" (`:135`).
- Drainage-class ranges are expanded into a comma list (`:228-241`).

### 4.3 Gaps vs raw txt / old HTML (open questions, not parser work)

| Gap | Evidence | Viewer impact / options |
|---|---|---|
| Paragraph and line structure lost | `create_OSD.R:98` | RIC and REMARKS blocks render as one run of lines. Options: (a) render `content` split on `\n` as `<br>`, which matches the old look well enough because each source line becomes a line; (b) ask SKB to keep blank lines upstream |
| No series cross-links | old HTML lines 110-123; JSON is plain text | We need a **link enrichment step** that matches capitalized tokens in COMPETING/ASSOCIATED against SC names. This is display markup over SKB text, not OSD parsing, but the user should confirm it is allowed |
| Diacritics transliterated | `create_OSD.R:96` | Accept, or ask SKB for UTF-8 |
| No parsed RIC, diagnostic features or PSCS on main | `SUMMARY.md` RIC branch `osd-ric-dev2` (2,331-line `R/parseRIC_functions.R`, last commit 2026-09-01) | Show RIC as text only until the branch merges |
| Rupture/structure regex defects | `parseOSD_functions.R:253-267` | Show the narrative as authoritative. Fix upstream or hide those fields |
| Missing moist colors (11.6%) and depths (3.5%) | stats above | The sketch needs a fallback: dry color, then gray, then hatched "unknown" |
| Type location lat/long not structured | only in `TYPE LOCATION` text | A map pin needs a regex over SKB text. **Open question**: is that allowed under "no new parser"? |
| `HORIZONS` nesting quirk (`[[...]]`) | 24,906/24,928 | Unwrap like `SL/scripts/build_artifacts.py:804-807` |
| SITE has only drainage | `parseOSD_functions.R:273-301` | Slope, elevation, MAP and MAAT stay as text |

---

## 5. Catalog of openssurgo / soillite custom calculations for series displays

Portability codes: **P** = trivially portable to a Node or Python static build; **P-SSURGO** = portable but needs a SSURGO DuckDB snapshot at build time; **JS** = already in browser JS.

| # | Name | file:line | Inputs | Outputs | Lang | Portability |
|---|---|---|---|---|---|---|
| 1 | SKB doc loader (name to path) | `SL/scripts/build_artifacts.py:780-794` | compname | parsed SKB JSON; path `L/UPPER_WITH_UNDERSCORES.json` | Py | P. Does not handle `.`/backtick→`@` (see 2.1) |
| 2 | SKB to profile rows | `SL/scripts/build_artifacts.py:797-860` | SKB doc | rows `{hzname,hzdept_r,hzdepb_r,moist_hue/value/chroma,taxonomic_class(stripped),overview,RIC,geographic_setting,use_and_vegetation,competing_series,narrative}`; "NA" mapped to null | Py | P (passthrough plus unwrap of the nested HORIZONS) |
| 3 | Series summary schema | `SL/scripts/build_artifacts.py:730-762`; `SL/plugin_api/series_identity.py:18-32` | | 17 fixed columns (`PROFILE_SCIENTIFIC_COLUMNS`) | Py | P |
| 4 | Component group key | `SL/plugin_api/series_identity.py:72-83` | compname, localphase, compkind | `(UPPER(trim(compname)), localphase, compkind)` | Py | P |
| 5 | Content-addressed `variant_id` | `SL/plugin_api/series_identity.py:35-105` | group key + profile rows | first 16 hex characters of SHA-256 over canonical type-tagged JSON rows (nulls last, `\x1d`/`\x1e` separators) | Py | P. Useful as an **incremental-build content hash** |
| 6 | Series name normalization | `SL/plugin_api/series_identity.py:108-` | name | uppercase; underscore and whitespace treated as equivalent | Py | P |
| 7 | Series profile build per component | `SL/scripts/build_artifacts.py:863-1000` | SSURGO component/mapunit/legend + SKB | `series_summary` + `component_profiles` (cokey to variant) | Py+DuckDB | P-SSURGO |
| 8 | National union and area membership | `SL/scripts/national_series.py:1-25` (docstring) | state releases | `series_summary`, `component_profiles`, **`area_series`** (areasymbol, state, series, variant) | Py | P-SSURGO. Gives "survey areas where this series is mapped" |
| 9 | Dominant-condition themes (drainage, HSG, farmland, ecoclass) | `SL/scripts/build_artifacts.py:102-158`, `:158-283` | component `comppct_r` + attribute | per-mukey dominant value (sum of comppct by value, top 1) | SQL | P-SSURGO (map-unit level, not series level) |
| 10 | Component summary + deterministic ecosite pick | `SL/scripts/build_artifacts.py:570-664` (ecosite rank `:611-629`) | component, muaggatt, coecoclass | one row per component; ecosite ordered by `ecoclassid` | SQL | P-SSURGO. A per-series ecosite list is possible |
| 11 | Horizon summary + `fragvoltot` policy | `SL/scripts/build_artifacts.py:667-725` | chorizon | horizons; `fragvoltot_r` used directly, never computed from size classes | SQL | P-SSURGO |
| 12 | Weighted average by component % | `OSS/src/ssurgo/sddt/aggregation.py:211-258` | mukey, comppct_r, property | sum(v·pct)/sum(pct) | Py/pandas | P-SSURGO |
| 13 | Dominant component / condition, min/max limiting | `OSS/src/ssurgo/sddt/aggregation.py:261,298,344,377` | same | per mukey | Py | P-SSURGO |
| 14 | Depth-weighted two-stage aggregation | `OSS/src/ssurgo/sddt/aggregation.py:410-` (uses `utils.calculate_depth_weight`, `OSS/src/ssurgo/sddt/utils.py:180`) | horizons + depth range | thickness-weighted horizon to component, then comppct-weighted to mukey; stated as equivalent to soilDB `get_SDA_property()` | Py | P. The horizon-to-profile stage also applies to OSD horizons (e.g. PSCS mean) |
| 15 | Mass-preserving spline harmonization | `OSS/src/ssurgo/sddt/depth_harmonization.py:1-52,201` | horizons | GlobalSoilMap depths (Bishop 1999 via `mpspline`) | Py | P (Python only) |
| 16 | Munsell to hex | SoilProfiles.js `SPJ/src/core/munsell.ts:12-68`, `SPJ/src/utils/munsell-approx.ts:27-264` | hue, value, chroma | `#rrggbb`; neutral `N` supported | TS | JS. Accuracy caveat (section 6) |
| 17 | Horizon color resolution | `SPJ/src/core/colors.ts:69` | explicit color, Munsell | display color by priority | TS | JS |
| 18 | Field mapping SSURGO/SKB to Horizon | `SPJ/src/core/mapping.ts:12-55` | raw row | Horizon (`hzdept_r ?? top`, `moist_*`) | TS | JS |
| 19 | Narrative formatting (blank-line paragraphs, lists) | `SL/frontend/index.html:3132-3156` | text | escaped HTML `<p>/<ul>/<ol>` | JS | JS. Reusable for SKB sections if line breaks survive |
| 20 | SVG post-processing (font clamps, strokes) | `SL/frontend/index.html:3161-3180`, `:3479-3507` | SVG DOM | | JS | JS (cosmetic; better fixed upstream in SPJ) |
| 21 | Thumbnail, series and comparison render | `SL/frontend/index.html:3182-3216, 3283-3303, 3305-3439` | horizons | SVG via `renderStaticSVG` modes `thumbnail`/`depth` and `renderComparison` | JS | JS / Node |
| 22 | Comparison export SVG/PNG/PDF | `SL/frontend/index.html:3509-3560` | collection | downloads | JS | JS |
| 23 | Legend links to SKB JSON | `SL/frontend/index.html:3441-3476` | compnames | links to `raw.githubusercontent…/OSD/L/NAME.json` | JS | JS. **Bug:** no space→`_` (inferred from `:3453`) |
| 24 | API `/api/series/{name}` | `SL/core/app.py:953-1004` | name, localphase, compkind, cokey | metadata + horizons + `skb_url` (`:996`, same bug) + `release_id` | Py | n/a for static |

No openssurgo or soillite code computes these series-level items: climate, competing-series logic beyond SKB text, taxonomy derivations, or geomorphic summaries. Searched with `grep -rniE 'competing|geomorph|weighted|munsell'` over `SL/core SL/plugins SL/plugin_api SL/scripts SL/frontend` and `OSS/src`. Competing series is the raw SKB text (`build_artifacts.py:828-829`). Those features would be new (section 8).

---

## 6. SoilProfiles.js integration notes

- **Package**: `soilprofiles` v0.2.0, MIT (`SPJ/package.json`, `SPJ/LICENSE`).
  - Subpath exports: `core`, `static`, `interactive`, `parsers/{osd,simple,delimited}`, `umd`, `three3d`.
  - Optional peer dependency `three@^0.185.1`.
  - Built with `tsc && node esbuild.config.js` into CJS, ESM and UMD (`SPJ/AGENTS.md`).
  - `dist/index.umd.min.js` is 49.9 KB.
  - soillite vendors an IIFE bundle built with `--external:three` (`SL/UPDATE_SOILPROFILES.md:14-19`).
- **Core API**:
  - `new SoilProfile(id, horizons)` and `new SoilProfileCollection([...])`.
  - `mapToHorizon(raw, DATA_MAPS.SSURGO)` (`SPJ/src/core/mapping.ts:12-55`).
  - `renderStaticSVG(collection, {width,height,format,mode,tooltips,annotations})` returns an SVG **string** (`SPJ/src/render/static.ts:16-50`). Modes are `depth|texture|properties|thumbnail` (`SPJ/src/core/types.ts`).
  - `renderComparisonSVG` (`SPJ/src/render/comparison.ts:25`), `renderInteractive2D` (canvas, `SPJ/src/render/interactive.ts:10`), `attachHorizonEventListeners` and `createDefaultTooltip` (`SPJ/src/render/events.ts:28`, `SPJ/src/core/tooltipUtils.ts:136`).
  - Also `repairDepths`/`validateDepths` (`SPJ/src/core/depthRepair.ts:28,109,206`), `getPhColor` (`SPJ/src/core/phScale.ts:6`) and `classifyTextureUSDA`/`getTextureColor` (`SPJ/src/core/texture.ts:17,106`).
- **Rendering tech**: SVG strings (static), canvas (interactive) and Three.js (3D). Horizons carry `data-horizon-*` attributes so tooltips can be wired up later (`SPJ/src/render/static.ts:81,142`). Dark-mode detection is guarded with `typeof document === 'undefined'` (`SPJ/src/core/colors.ts:29`), so it runs headless.
- **Verified in Node v24.13.0** (scratch script, section 11):
  - Loading SKB `AMADOR.json`, unwrapping `HORIZONS[0]`, `mapToHorizon(h, DATA_MAPS.SSURGO)`, then `renderStaticSVG(..., {mode:'thumbnail',width:45,height:200,format:'svg'})` produced a 6,802-byte SVG with horizon fills `#6e5f4d, #8f7759, #8f7759, #bdb078`.
  - `parseOSDJson(doc)` on the same SKB doc skipped the nested array and returned **0 horizons** (`SPJ/src/parsers/osd.ts:78-109` iterates `doc.HORIZONS` without unwrapping). The SPJ demo works around it (`SPJ/examples/soilknowledgebase-demo.js:174-180`).
- **Munsell handling**:
  - `munsellToHex` validates and normalizes, then calls `munsellToRgbApprox`. That function uses a Value to Y polynomial plus Lab a*/b* interpolation from a **6-hue lookup** (`5R, 5YR, 5Y, 5G, 5B, 5P` at value 5; `SPJ/src/utils/munsell-approx.ts:27-70`, `:196-264`).
  - A hue not in the table falls back to the first key with the same letter suffix (`:228-243`, key match at `:235`). So 10YR, 7.5YR and 2.5YR all map to 5YR. 2.5Y, 10Y and 5Y map to 5Y **(inferred from code)**. Verified: `munsellToHex('10YR',4,2) === munsellToHex('5YR',4,2) === '#6e5f4d'`.
  - For soil colors, which are mostly 10YR to 2.5Y, this flattens hue differences that matter. A 10,450-row LUT exists but is not wired in (`SPJ/soilprofiles-munsell/munsell.ts:9-12`). aqp's `munsell2rgb()` is the reference implementation in R (https://ncss-tech.github.io/aqp/reference/munsell2rgb.html; not re-fetched this session).
  - **Options:** wire the LUT into SPJ upstream, or precompute hex at build time with a LUT on our side.
- **Many small sketches on one index page**:
  - About 24.9k thumbnails at ~6.8 KB each would total about 170 MB of inline SVG **(inferred arithmetic)**, so they cannot all be inlined.
  - Option A: precompute a compact per-series color strip `[{t,b,hex,name}]` at build time. 144k horizons at ~40 B each is about 6 MB raw before gzip **(inferred)**. Render in the client with `renderStaticSVG` per visible card (virtualized grid or IntersectionObserver), sharded by first letter.
  - Option B: pre-render one SVG sprite per letter or per taxonomy group.
  - Option C: write per-series `.svg` files and use `<img loading=lazy>`. This is the simplest and most cacheable; 24.9k files at ~7 KB is about 170 MB on disk.
- **Consumers to align with**:
  - soillite calls `renderStaticSVG` thumbnail 45x200 and depth 280x400 (`SL/frontend/index.html:3193,3293`).
  - The geolibre plugin uses the same calls on npm 0.1.2 (`GPS/src/soillite.ts:3157-3160,3513-3516`).
  - soillite's `UPDATE_SOILPROFILES.md` is still pending for 0.1.3 neutral-hue support (`SL/UPDATE_SOILPROFILES.md:1-5`).

---

## 7. Series Classification (SC) table and taxonomy sources

### 7.1 SC columns (`OSDR/SC/SCDB.csv`, header line 1; produced by `OSDR/R/registry.R:204-216`)

| Column | Meaning | Distinct (non-NA) / NA | Example values |
|---|---|---|---|
| `soilseriesiid` | NASIS soil series record id (primary key) | 26,576 unique / 0 | 5630 |
| `soilseriesname` | Series name, UPPER, may contain space, period or backtick | 26,576 unique / 0 | `AABAB`, `MT. AIRY`, ``KANA`A`` |
| `soilseriesstatus` | Status | 3 | Established 23,432; Tentative 1,943; Inactive 1,201 |
| `benchmarksoilflag` | Benchmark soil | 2 | TRUE 1,478 (1,476 Established) |
| `statsgoflag` | Used in STATSGO | 2 | TRUE 13,171 |
| `taxclname` | Full family name, UPPER | 12,409 / 627 | `FINE-LOAMY, MIXED, SUPERACTIVE, FRIGID TYPIC ARGIUSTOLLS` |
| `taxorder` | Order | 12 / 627 | Mollisols 7,895, Alfisols 4,165, … |
| `taxsuborder` | Suborder | 75 / 628 | Xerolls, Ustolls, Udalfs |
| `taxgrtgroup` | Great group | 318 / 627 | Argixerolls, Haploxerolls |
| `taxsubgrp` | Subgroup | 1,767 / 627 | Typic Hapludults |
| `taxpartsize` | Family particle-size class | 84 / 1,560 | fine-loamy, loamy-skeletal, fine |
| `taxpartsizemod` | Particle-size modifier | 1 / 26,558 | aniso (18) |
| `taxminalogy` | Family mineralogy class | 58 / 975 | mixed, smectitic, isotic |
| `taxceactcl` | CEC activity class | 4 / 10,537 | superactive, active, semiactive, subactive |
| `taxreaction` | Reaction class | 6 / 23,309 | calcareous, nonacid, euic, acid, dysic, kalkic |
| `taxtempcl` | Soil temperature class | 9 / 3,598 | mesic, frigid, thermic |
| `mlraoffice` | Responsible MLRA/SSR office | 7 / 1,126 | davis, ca; bozeman, mt |
| `areasymbol` | State or territory code | 59 / 0 | CA, OR, WA |
| `areaname` | State or territory name | 59 | California |
| `areatypename` | Always "State or Territory" | 1 | |
| `originyear` | Year proposed | 119 / 11,823 | 1996 |
| `establishedyear` | Year established | 128 / 3,119; range 1899-2026 | 1971 |
| `soiltaxclasslastupdated` | Year the classification was last updated | 40 / 4; range 1987-2026 | 2003 |

- The column meanings follow the roxygen list at `OSDR/R/nasis_sc_db.R:4`.
- `areasymbol` is probably the state of the type location **(inferred)**. There is one row per series, while SKB `STATES` lists every state that uses the series.

**Hierarchy encoded**: `taxorder > taxsuborder > taxgrtgroup > taxsubgrp > taxclname` (family = subgroup plus the family classes `taxpartsize[mod]`, `taxminalogy`, `taxceactcl`, `taxreaction`, `taxtempcl`) > `soilseriesname`.

Distinct counts restricted to Established series: 12 orders, 68 suborders, 281 great groups, 1,635 subgroups, 11,464 families. Established by order: Mollisols 7,143, Alfisols 3,827, Inceptisols 3,093, Entisols 2,833, Aridisols 2,647, Ultisols 1,260, Andisols 972, Spodosols 702, Vertisols 463, Histosols 331, Gelisols 100, Oxisols 61.

**Join keys and casing**:
- SC to file: `toupper(name)` with space→`_` and backtick→`@` gives `OSD/<first letter>/<key>.txt|json`. Periods stay (`MT._AIRY`). The same rule appears in soilDB `.seriesNameToFileName` (`SDB/R/get_OSD.R:203-223`, which still has a "TODO: convert apostrophe" at `:214`) and in SKB/soilDB `get_OSD_JSON` (`SDB/R/get_OSD.R:100-133`).
- SC `taxclname` is UPPER, while the OSD and SKB `TAXONOMIC CLASS` are sentence case and carry a "TAXONOMIC CLASS:" prefix. SKB logs class-name mismatches in `SKB/inst/extdata/OSD-error-reporting/taxclassname-errors.csv`.
- Taxon names (`taxsubgrp` and so on) are Title-case in SC. Compare them lowercased against KST codes.

### 7.2 Keys to Soil Taxonomy in SKB

- **Editions and languages**: 2014 (12th) EN and SP, and 2022 (13th) EN. Text files: `SKB/inst/extdata/KST/2014_KST_EN.txt` (31,999 lines), `2014_KST_SP.txt` (36,056 lines) and `2022_KST_EN.txt` (35,018 lines). The repo-root copies (`SKB/2014_KST_EN.txt` etc.) are untracked duplicates with no trailing newline (`git status`).
  - Source PDFs: `SKB/R/create_KST.R:548-601` (`download_KST`). URLs at `:560-568` point to `brownag/SoilKnowledgeBase-data-archive/.../Keys-to-Soil-Taxonomy_{12th_2014,Spanish_12th_2014,13th_2022}.pdf`. Text is extracted with `pdftools` (`SKB/DESCRIPTION` Imports).
- **Structured outputs**:
  - `*_KST_codes.json`: a list of `{code,name}`; 2022 has 3,153 codes and 2014 has 3,082. Code length gives the level: 12 one-character (order), 68 two-character (suborder), 339 three-character (great group), 2,715 four-character (subgroup), and 19 five-character such as `JEJZa` = "Inceptic Hapludalfs".
  - `*_KST_criteria_{EN,SP}.json`: a dict keyed by code, each a list of clauses `{content, chapter, page, key, taxa, crit, clause, logic: FIRST|OR|AND|END|NEW}`. Example `A`: "A. Soils that have: …", chapter 4, page 67, "Key to Soil Orders".
  - Writer: `SKB/R/create_KST13.R:482-485`. The same filename is written twice and the second write (`st_db13_unique`) wins. Codes are written at `:497`. The 2014 equivalents are at `SKB/R/create_KST.R:521-536`.
  - `2014_KST_EN_featurelist.json`: 140 diagnostic features `{group,name,chapter,page,description,criteria}`. Groups include Mineral Family 23, Subsurface 21, Mineral 21, Mineral or Organic 16, Organic 15, Human 14, Organic Family 12, Surface 9, Soil Materials 7, Series 2. Written at `SKB/R/create_KST.R:457`; the 2022 equivalent is commented out at `SKB/R/create_KST13.R:413`.
  - The `*_HTML_*.rda` and `2022_KST_db_EN.Rda` files are R-only binaries.
- **Join to SC** (lowercased name match):

| SC level | distinct | in KST 2022 | in KST 2014 | examples not in 2022 |
|---|---|---|---|---|
| taxorder | 12 | 12 | 12 | |
| taxsuborder | 75 | 67 | 67 | andepts, arents, boralfs, borolls, ochrepts, orthids |
| taxgrtgroup | 318 | 276 | 276 | argiborolls, calciorthids, camborthids |
| taxsubgrp | 1,767 | 1,661 | 1,652 | abruptic argiborolls, aeric haplaquepts |

  Series whose great group is not in KST 2022: Inactive 130, Established 30, Tentative 5. For subgroups: Inactive 156, Established 35, Tentative 7. Obsolete taxa sit mostly on Inactive series. OSD text cites the edition used, e.g. AMADOR "12th Edition" (`OSDR/OSD/A/AMADOR.txt`, ADDITIONAL DATA).
- **Licensing and provenance**: the KST is a USDA-NRCS publication (Soil Survey Staff), public domain in the US **(inferred, consistent with `SKB/LICENSE.md:28`)**. The SKB packaging is MIT.

### 7.3 DST (Digital Keys to Soil Taxonomy)

- **What it is**: an offline-first, no-build PWA (Alpine.js 3.13.3 from CDN) plus an npm package `dst-soil-taxonomy` v1.0.0, MIT (`DST/package.json`, `DST/LICENSE`, `DST/AGENTS.md:9-25`). It also has a Rust engine with Python, WASM and R bindings (`DST/dst-core-rs`, `DST/dst-core-bindings`, `DST/r-pkg`, `DST/python`).
- **Data model** (`DST/data/dst-data.json`, v3.2.0, source "USDA Keys to Soil Taxonomy (2022)"):
  - `navigation.criteria[7324]`: `{clause_id:"A", crit, clause, parent_clause, content, logic, depth, content_html}`.
  - `navigation.indices`: `by_code`, `children_by_parent` (423), `parent_by_code` (3,141), `depth_by_code` and `clause_children` (1,880; ids like `C.3.a`).
  - `outcomes[3073]`: terminal clauses such as `JAA_1` "Aqualfs that have a cryic soil temperature regime".
  - `glossary[136]`: `{id, term, definition}`. 15 terms have **empty** definitions, e.g. histic, folistic and melanic epipedon.
  - `order_names[12]` and `code_names[3153]`.
- **Relationship to SKB**: `code_names` is **identical** to `SKB/inst/extdata/KST/2022_KST_codes.json` (all 3,153 pairs equal; checked in a scratch script). Taxon names are unique, so a name-to-code inverse works. Example: `typic haploxerepts` → `KEFQ`, and its code prefixes give "Inceptisols > Xerepts > Haploxerepts > Typic Haploxerepts".
- **Glossary links**: `DST/glossary_matches.json` maps criterion codes to glossary term spans with confidence values (`matches_by_criterion.AAAA: [{term_id:"lithic_contact", span, confidence, source:"exact_glossary"}]`).
- **Engine API** (`DST/scripts/dst-core.js`): `DSTCore.create(data)` (`:18`), `check/uncheck/toggle` (`:193-211`), `getCurrentClassification` (`:268`), `getClassificationLevel` (`:274`) and `getClassificationBreadcrumb` (`:280-289`, which joins prefix names with " › "). The breadcrumb depends on the checked criteria, but the **prefix-walk idea is reusable statically** from SC names. The 5-character `…Za` codes need care **(inferred)**.
- **Reusable UI**:
  - `DST/sw.js` service worker: cache-first for static files and network-first for JSON. Paths resolve relative to the SW, so it works under a subpath (`DST/sw.js:1-30`).
  - CSS custom-property tokens in `DST/style.css:19-46`, with a system-ui font stack (`:233`).
  - Rule from `DST/AGENTS.md`: no hard-coded colors in HTML.
- **Deep linking**: `index.html` and `scripts/*.js` never read `location`, `hash` or `URLSearchParams` (`grep`, section 11). A "key out this series in DST" link therefore cannot preselect a taxon today. That needs a DST change, which is out of scope, so it is an open question.
- **Better source than raw KST txt?** Yes for navigation and hierarchy: DST has parent/child indices, clause trees, HTML content and a glossary. SKB criteria JSON already has page and chapter refs and the Spanish 2014 version. Raw txt is only needed for full-text passages. **Recommendation:** use DST `code_names` plus `parent_by_code` for the tree, and the SKB 2022 criteria JSON for per-taxon criteria text and page refs. Both use the same codes.

### 7.4 How taxonomy can drive browse and index pages (proposals)

- A taxonomy tree from order to subgroup to family to series, with counts per node from SC. Each node page shows the KST criteria clause (SKB criteria JSON, with page ref) and a sketch strip of member series.
- Home-page facets: status, order, suborder, great group, subgroup, family classes (`taxpartsize`, `taxminalogy`, `taxceactcl`, `taxreaction`, `taxtempcl`), state, MLRA office, benchmark and STATSGO flags, and established-year range.
- A series-page breadcrumb (order › suborder › great group › subgroup › family) with each crumb linked to its tree node, plus tooltips showing the KST definition.
- A glossary or definition page for each diagnostic horizon or feature: 2014 featurelist (140) plus DST glossary (136). Auto-link terms in OSD text only by exact term match **(open question)**.
- "Obsolete taxon" flags where SC taxa are missing from KST 2022.
- **Formative elements and family-class definitions** could come from the SoilTaxonomy R package (`ST_formative_elements`, `ST_family_classes`; GPL ≥ 3). That needs a one-time export to JSON with a license check.

---

## 8. Future ideas (from soilDB `fetchOSD`): inspiration only, no SoilWeb data

`fetchOSD(extended=TRUE)` calls the SoilWeb API `…/api/soil-series.php?q=all&s=` (`SDB/R/fetchOSD.R:174`). The extended tables are listed at `SDB/R/fetchOSD.R:343` and documented at `:72-97`. The list is assembled at `:431-449`. Below, each component gets our own equivalent recipe. The SSURGO tables named exist in local `/data/SSURGO/data/SSURGO.duckdb` (checked with `show tables`).

| Component | What it shows | soilDB ref | Data it needs | Our equivalent? How |
|---|---|---|---|---|
| `SPC` (site/hz) | OSD morphology plus estimated colors (`dry_color_estimated`, `moist_color_estimated`) and boundary offsets | `fetchOSD.R:274,302,334-337` | OSD parse | **Yes, from SKB HORIZONS.** Estimating missing colors is new logic; mark estimated colors in the UI |
| `competing` | Same-family series list | `:76`, `:427` | SC `taxclname` | **Yes, from SC alone**: group by `taxclname` (12,409 families) |
| `geog_assoc_soils` | Names in GEOGRAPHICALLY ASSOCIATED SOILS | `:77` | OSD section | **Yes**: SKB text plus name matching against SC (same step as cross-links) |
| `geomcomp`, `hillpos`, `mtnpos`, `terrace`, `flats` | Empirical proportions of geomorphic component and position by series, with Shannon entropy | `:78-82`, `:14-46` | SSURGO `component` + `cogeomordesc` + `cosurfmorphgc/hpp/mr` | **P-SSURGO**: comppct-weighted counts by compname (Established names) |
| `shape_across`, `shape_down` | Surface shape proportions | `:84-85` | `cosurfmorphss` | P-SSURGO |
| `pmkind`, `pmorigin` | Parent material kind and origin proportions | `:87-88`, `:416-423` | `copmgrp` + `copm` | P-SSURGO |
| `geomorphons` | Landform proportions from a 30 m grid | `:89` | gSSURGO raster + geomorphons grid | **Hard** (raster zonal stats); defer |
| `mlra` | MLRA membership | `:90` | `laoverlap` (areatype MLRA) joined to map units | P-SSURGO (by area or acres) |
| `ecoclassid` | Ecosite by series, major components | `:91` | `coecoclass` | P-SSURGO; soillite already picks an ecosite deterministically (section 5 row 10) |
| `climate.annual`/`monthly` | PRISM summaries (ppt, pet, MAAT, FFD) by series extent | `:92`, `:398-411` | PRISM rasters over series extent | **Hard** (external rasters; CONUS only). Use OSD text values as an interim |
| `NCCPI` | NCCPI quantiles | `:94` | `cointerp` (NCCPI rules) | P-SSURGO |
| `siblings()` | Co-occurring series in map units | `SDB/R/siblings.R:47-81` (API `q=siblings`) | `component` grouped by `mukey` | P-SSURGO (count co-occurrence) |
| `OSDquery()` | Full-text search by section (Postgres FTS) | `SDB/R/OSDquery.R:93,123,138` | OSD text | **Yes, client-side**: Pagefind or MiniSearch over SKB sections |
| Lab data / water balance (SDE) | KSSL percentiles, monthly WB | SDE capture (section 3.4) | KSSL snapshot, PRISM | Defer (external datasets) |
| Extent map | Generalized polygons | SDE/SEE | `mupolygon` | **Partly done locally**: `series-extent/output/compname_tol250.fgb` |

---

## 9. Candidate build architecture options

### 9.1 Pipeline shape (all options)

`SKB JSON + SC CSV (+ KST/DST JSON) [+ optional SSURGO DuckDB summaries]` → normalize (name key, unwrap HORIZONS, strip section prefixes, link enrichment, precomputed Munsell hex) → **per-series HTML** + `series/<KEY>.json` (trimmed) + `.txt` passthrough copy + per-series sketch (`.svg`) → **indexes**: home gallery shards, taxonomy tree pages, A-Z and state pages, search index.

Incremental builds: hash each series' inputs (SKB file bytes + SC row + template version), on the same principle as `variant_id` (`SL/plugin_api/series_identity.py:86-105`). Rebuild only changed pages. Weekly refreshes touch about 10 files (`git show --stat HEAD` in SKB: 10 JSON changed).

### 9.2 Options

| Option | Stack | Pros | Cons |
|---|---|---|---|
| A. **Node/TS generator (recommended)** | Node ≥ 20 (SPJ CI uses 20.x per `SPJ/AGENTS.md`), plain template literals or a small engine; `soilprofiles` from npm/local; Pagefind (`npx pagefind`) | SoilProfiles.js runs natively at build time (verified); DST and SPJ are JS; one language for build and client; Pagefind indexes the static output after the build (https://pagefind.app/docs/) | Second language next to the R upstreams; a Munsell accuracy fix is needed in SPJ or locally |
| B. Python generator (Jinja2) + Node subprocess for SVG | uv/Python ≥ 3.12 like openssurgo (`OSS/pyproject.toml`) | Reuses openssurgo name normalization, variant hashing and DuckDB SSURGO summaries directly | SVG needs Node anyway, so two runtimes |
| C. R generator (rmarkdown/whisker) | R like SKB/OSDR | Closest to SKB, can call aqp `munsell2rgb` and SoilTaxonomy | Slow for 25k pages **(inferred)**; SPJ is not available in R, so it would mean aqp PNG sketches instead |
| D. Client-only SPA (fetch SKB JSON from raw.githubusercontent) | as SPJ demo (`SPJ/examples/soilknowledgebase-demo.js:111-120`) | No build | Needs the network, no SEO, no offline use, rate limits; does not reproduce static OSD pages |

**Search index**: (1) a prebuilt compact JSON name and facet index (26.6k rows; shard if >2 MB **(inferred)**) for instant filter and prefix search on the home page; (2) Pagefind for full-text search over section content.

**Hosting**:
- GitHub Pages: published sites are capped at 1 GB and deployments time out after 10 minutes (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). 25k pages at 15-25 KB, plus ~170 MB of SVGs if they are files, comes to roughly 0.6 GB **(inferred)**. That is close to the cap, so prefer client-rendered sketches from color strips, or Option C sprites.
- Cloudflare R2 or Pages is already used by soillite (`SL/scripts/sync_to_r2.sh`, `SL/DEPLOYMENT_R2.md`).

**Update cadence**: a scheduled CI job after SKB's Monday 06:00 UTC refresh (`SKB/.github/workflows/refresh-extdata.yml:3`) pulls SKB (git or raw), builds incrementally and deploys.

**Offline**: optionally reuse DST's service-worker pattern (`DST/sw.js`).

---

## 10. Risks, unknowns, open questions

1. **Hosting target and size budget**: GitHub Pages (1 GB, 10-minute deploys) or R2/Cloudflare? This decides whether sketches are files or rendered in the client.
2. **SSURGO dependency for v1?** Extent, map units, siblings, geomorphic and pm summaries need the 126 GB DuckDB at build time. Alternatively keep v1 to OSD + SC + KST only.
3. **Link enrichment allowed?** Recreating the old competing and associated cross-links means matching names over SKB text. Is that compatible with "no new parser"? The same question applies to type-location coordinates and glossary auto-linking.
4. **Parse defects**: *RESOLVED: keep SKB output as is; see §0 and `skb-issues.md`.* (Original question: fix upstream in SKB (rupture and structure regex, lost blank lines, ASCII transliteration, `HORIZONS` nesting) or hide and annotate fields in the viewer? Who owns the upstream PRs?)
5. **RIC**: wait for `osd-ric-dev2` to merge, or show RIC as text only?
6. **KST edition**: show 2022 (13th) definitions everywhere, or the edition cited in each OSD (many say 12th)? Spanish 2014 exists; is bilingual in scope?
7. **Obsolete taxa**: how to show SC taxa missing from KST 2022 (130 great groups on Inactive series, 30 on Established)?
8. **Scope of statuses**: include Tentative (1,943) and Inactive (1,201)? Only about 58% and 19% of them have SKB JSON. Also, 138 SKB docs have no SC row.
9. **Munsell accuracy**: patch SPJ to use the LUT (upstream PR), or precompute hex in our build? Which reference: the aqp renotation table?
10. **Missing colors and depths**: fallback styling for 16,786 horizons without moist hue. Use dry color, or estimate as SoilWeb does?
11. **URLs**: *RESOLVED: mirror old paths through URL rewriting; static files not required (§0).* (Original:) mirror `OSD_Docs/<L>/<NAME>.html` paths exactly so soillite and others can switch hosts? soillite's broken `osd_url` (`SL/frontend/index.html:2715-2717`) could point at the new site.
12. **DST integration**: DST has no deep links. Ask for a DST change (`?taxon=KEFQ`), embed DST's engine, or only link to the DST home?
13. **Name-to-file edge cases**: periods, backtick→`@` and `MT_ROGERS` versus `MT._*`. Adopt one canonical slug and redirect the others?
14. **Licensing statement**: the site's own license. OSD and KST content is a US Government work (inferred public domain); SPJ and DST are MIT; SoilTaxonomy-derived data is GPL-3.
15. **Local OSDRegistry is stale** (2026-03-23). Should the build read SKB/OSDR from GitHub releases rather than sibling checkouts?

---

## 11. Candidate goals (for magic-wand ranking)

IDs are stable for dependency references. "Evidence" points at feasibility proof in this document.

| ID | Goal (one-line outcome) | Depends on | Evidence of feasibility |
|---|---|---|---|
| G1 | **Data loader**: one module reads SKB JSON + SC CSV, normalizes name keys, unwraps HORIZONS, strips section prefixes, and joins by key with a coverage report | — | §2.1 join stats; `SL/scripts/build_artifacts.py:780-860` pattern |
| G2 | **Series page v1**: static HTML per series that reproduces the old OSD anatomy (header lines, H1, bold sections, bold horizon names) from SKB JSON, plus `.txt`/`.json` download links | G1 | §3.1 anatomy; §4.1 schema |
| G3 | **Old-school theme**: CSS tokens based on `usdastyle.css` (Verdana 11 px, `#3e3e3e` chrome, 767 px body, `#248621` headers, `#000099` links), responsive and with print styles | — | §3.2 |
| G4 | **Profile sketch per series** via SoilProfiles.js at build time (SVG) with color fallbacks | G1 | §6 Node verification |
| G5 | **Accurate Munsell colors**: LUT-based hue/value/chroma → hex (upstream SPJ PR or local) with tests against a reference | — | §6 hue-collapse finding; `SPJ/soilprofiles-munsell/munsell-data.json` |
| G6 | **Home page profile gallery**: virtualized grid of thumbnails from compact color strips, filterable | G1, G4 (G5 improves) | §6 option A |
| G7 | **Client-side search and filter**: name prefix, fuzzy and wildcard search plus SC facets (status, taxonomy levels, family classes, state, MLRA office, benchmark) | G1 | §7.1 columns/counts |
| G8 | **Full-text search** over OSD sections via Pagefind | G2 | §9.2 |
| G9 | **Taxonomy tree browse pages** (order → series) with counts and member sketch strips | G1, G4 | §7.1, §7.4 |
| G10 | **KST definitions**: per-taxon criteria text with page refs on tree nodes and as breadcrumb tooltips (SKB 2022 criteria + DST code tree) | G9 | §7.2-7.3 code identity |
| G11 | **Glossary and diagnostic-feature pages** (DST glossary + SKB featurelist), with links from series pages | G10 | §7.2-7.3; 15 empty DST definitions noted |
| G12 | **Series cross-links** in Competing and Associated sections (name matching against SC), plus hover cards | G2 | §3.1 lines 110-123; open question 3 |
| G13 | **Competing-series panel computed from SC family** (`taxclname`), with a sketch strip | G1, G4 | §8 row "competing" |
| G14 | **Incremental build + CI**: input hashing, weekly schedule after SKB refresh, deploy | G2 | §9.1; SKB cron |
| G15 | **Hosting and URL scheme**: canonical slugs, `OSD_Docs/L/NAME.html` compatibility paths, redirects for odd names | G2 | §2.1 naming; open questions 11 and 13 |
| G16 | **Data-quality annotations** (handles `skb-issues.md` SKB-1 to SKB-17 on the display side): flag parse gaps (missing colors and depths, suspect rupture values, obsolete taxa, no SC row) on pages and in a QA report | G1 | §4.1-4.3, §7.2 |
| G17 | ~~**Upstream SKB fixes**~~ **DROPPED (§0: SKB used as is; issues are only logged in `skb-issues.md`)** (rupture/structure regex, keep blank lines, unnest HORIZONS) as PRs | — | `SKB/R/parseOSD_functions.R:253-267`; `create_OSD.R:98` |
| G18 | **SPJ upstream fixes**: `parseOSDJson` unwraps nested HORIZONS; sync soillite/geolibre bundles | — | §6; `SPJ/src/parsers/osd.ts:78-109` |
| G19 | **Interactive horizon tooltips and comparison** on series pages (SPJ events) | G4 | `SPJ/src/render/events.ts:28`; soillite usage |
| G20 | **Offline/PWA** using DST's service-worker pattern | G2 | `DST/sw.js` |
| G21 | **(future)** Series extent map + survey-area list from SSURGO (`mupolygon`, area_series) or `series-extent` FGB | G2; SSURGO decision | §5 row 8; §2 series-extent |
| G22 | **(future)** Siblings panel from SSURGO co-occurrence | G21 infra | §8 siblings row |
| G23 | **(future)** Geomorphic position and parent-material proportion charts from SSURGO | G21 infra | §8 rows |
| G24 | **(future)** MLRA, ecosite and NCCPI summaries per series from SSURGO | G21 infra | §8 rows; §5 row 10 |
| G25 | **(future)** Climate summaries (PRISM) per series extent | G21 | §8 climate row (hard) |
| G26 | **(future)** "Key it out" DST deep link once DST supports URL state | G10; DST change | §7.3 deep-link finding |
| G27 | **(future)** RIC structured tables once `osd-ric-dev2` merges | G2 | §4.3 |

Suggested critical path **(inferred)**: G1 → G2 + G3 → G4 → G6/G7 → G9 → G10 → G14/G15. G5 and G18 can run in parallel (SPJ work). G17 is dropped (§0).

---

## 12. Sources

### Web (accessed 2026-11-26)
- https://web.archive.org/web/20260308005129id_/https://soilseries.sc.egov.usda.gov/OSD_Docs/A/AMADOR.html (saved `REF/osd_AMADOR_20260308005129.html`; identical to 20220816135024)
- https://web.archive.org/cdx/search/cdx?url=soilseries.sc.egov.usda.gov/OSD_Docs/A/AMADOR.html (captures 20140830061036 to 20260308005129)
- https://web.archive.org/web/20201030203242id_/https://soilseries.sc.egov.usda.gov/osdname.aspx (saved)
- https://web.archive.org/web/20201129164421id_/https://soilseries.sc.egov.usda.gov/ (saved)
- https://web.archive.org/web/2020id_/https://soilseries.sc.egov.usda.gov/Resources/usdastyle.css and `/Resources/supplemental.css` (saved)
- https://web.archive.org/cdx/search/cdx?url=soilseries.sc.egov.usda.gov/ (home captures 20151204151855 to 20251103172211)
- https://web.archive.org/web/20260212162714id_/https://casoilresource.lawr.ucdavis.edu/sde/?series=amador (feature review only; not saved in repo)
- https://web.archive.org/web/20160927035856id_/http://casoilresource.lawr.ucdavis.edu/sde/?series=amador (feature review only)
- https://web.archive.org/cdx/search/cdx?url=casoilresource.lawr.ucdavis.edu/sde/?series=&matchType=prefix
- https://soilseries.sc.egov.usda.gov/OSD_Docs/A/AMADOR.html (live: HTTP 200, body "500 - Internal server error")
- https://api.github.com/repos/ncss-tech/OSDRegistry/commits?per_page=3 (latest 2026-11-16) and https://api.github.com/repos/ncss-tech/OSDRegistry/releases/tags/main (assets updated 2026-11-23)
- https://github.com/ncss-tech/OSDRegistry/releases/download/main/OSD-data-snapshot.zip (cited in `SKB/R/create_OSD.R:22`)
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://pagefind.app/docs/
- NSSH Part 614 as linked from `OSDR/README.md`: https://directives.sc.egov.usda.gov/44230.wba (not fetched; the section list was taken from `OSDR/misc/GUIDELINES.R`)
- https://ncss-tech.github.io/aqp/reference/munsell2rgb.html (reference only, not fetched)

### Local files
- OSDRegistry: `README.md`, `DESCRIPTION`, `R/registry.R:27,177-224`, `R/download.R:19-90`, `R/nasis_sc_db.R:1-14`, `misc/GUIDELINES.R:1-40`, `.github/workflows/refresh-osd.yml:9,37-41,58`, `OSD/A/AMADOR.txt`, `OSD/M/MT._AIRY.txt`, `OSD/K/KANA@A.txt`, `SC/SCDB.csv`
- SoilKnowledgeBase: `DESCRIPTION`, `LICENSE.md:3-4,28`, `SUMMARY.md`, `R/create_OSD.R:10-77,87-366,379-419`, `R/parseOSD_functions.R:13-34,41-69,73-267,273-301,306-515`, `R/create_KST.R:457,521-536,548-601`, `R/create_KST13.R:34,413,482-497`, `inst/extdata/OSD/A/AMADOR.json`, `inst/extdata/OSD/OSD.log`, `inst/extdata/OSD-error-reporting/*`, `inst/extdata/KST/*`, `.github/workflows/refresh-extdata.yml:3`, branch `osd-ric-dev2:R/parseRIC_functions.R:2105`
- openssurgo/soillite: `AGENTS.md`, `pyproject.toml:11`, `soillite/AGENTS.md`, `soillite/UPDATE_SOILPROFILES.md:1-19`, `soillite/scripts/build_artifacts.py:102-283,570-1000`, `soillite/scripts/national_series.py:1-25`, `soillite/plugin_api/series_identity.py:18-115`, `soillite/core/app.py:943,953-1004`, `soillite/frontend/index.html:1611-1614,2701-2718,3132-3560`, `soillite/docs/decisions/0004-national-series-offline-only.md`, `src/ssurgo/sddt/aggregation.py:211-605`, `src/ssurgo/sddt/depth_harmonization.py:1-52`, `src/ssurgo/sddt/utils.py:180`
- SoilProfiles.js: `package.json`, `LICENSE`, `AGENTS.md`, `.gitignore:3`, `src/index.ts`, `src/core/{mapping.ts:12-55,munsell.ts:12-79,colors.ts:29,69,types.ts,depthRepair.ts,texture.ts,phScale.ts,tooltipUtils.ts:136}`, `src/utils/munsell-approx.ts:27-264`, `src/parsers/osd.ts:78-109`, `src/render/{static.ts:16-311,comparison.ts:25-158,interactive.ts:10,events.ts:28}`, `soilprofiles-munsell/{munsell.ts,munsell-data.json}`, `examples/soilknowledgebase-demo.js:111-180`
- geolibre-plugin-soillite: `package.json`, `LICENSE`, `README.md`, `package-lock.json:3942-3944`, `src/soillite.ts:3157-3160,3304-3305,3513-3516`
- DST: `AGENTS.md:9-25`, `package.json`, `LICENSE`, `data/dst-data.json`, `glossary_matches.json`, `scripts/dst-core.js:6-8,18,193-289`, `sw.js:1-30`, `style.css:19-46,233`
- soilDB: `R/fetchOSD.R:1-46,55-115,165-200,274-337,343-449`, `R/siblings.R:1-81`, `R/OSDquery.R:1-138`, `R/get_OSD.R:20-133,197-223`
- Others: `/home/andrew/workspace/series-extent/README.md`, `series-extent/output/`, `/home/andrew/workspace/SoilTaxonomy/DESCRIPTION`, `SoilTaxonomy/data/`, `/data/SSURGO/data/SSURGO.duckdb` (table list only)

### Scratch scripts (read-only analysis; not part of the repo)
Under `/tmp/claude-1000/-home-andrew-workspace-soil-series-viewer/f5373d7c-8fc6-4195-a728-df8c390e0724/scratchpad/`: `sc_profile.py` (SC and coverage stats), `skb_stats.py` (SKB schema and NA stats) and `sp_test.js` (SoilProfiles.js Node render and Munsell check). The KST/DST joins were run inline with `python3 -I`. The SDE captures are in `sde_dl/` there, kept outside the repo on purpose.
