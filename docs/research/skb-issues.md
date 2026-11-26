# SoilKnowledgeBase OSD JSON: known issues

**Policy (decided 2026-11-26):** the viewer uses SKB output **as is**. We do not
patch, fork or re-parse SKB. Each issue below is handled in the viewer, by showing
the source text as authoritative, adding a visible note, or applying a documented
display-side workaround. This file records the issues so they can be reported
upstream later if wanted.

- Upstream: <https://github.com/ncss-tech/SoilKnowledgeBase>, verified at
  `origin/main` = `fbf3e54e61` ("Update inst/extdata/ JSON files"), fetched 2026-11-26.
  The local checkout's tracked files match this commit.
- Corpus: `inst/extdata/OSD/**.json`, 24,928 docs and 144,414 horizons.
- No open upstream PRs (`gh pr list`). The branches `osd-multiline1` and
  `fix-hz-and` are already merged into main. `osd-ric-dev2` adds RIC parsing but
  does not touch any of the lines below.
- **Counting method:** counts come from a string-match scan of the narrative
  against the parsed field (script in this session, not committed). Treat them
  as approximate lower bounds, not exact counts. The scan conditions are listed
  under each issue.

## Summary

| ID | Issue | Source (origin/main) | Affected | Viewer handling |
|---|---|---|---|---|
| SKB-1 | `HORIZONS` nested one extra list level | output shape | 24,906 / 24,928 docs | Unwrap `[[...]]` → `[...]` when reading |
| SKB-2 | Dry rupture: "slightly hard" parsed as `"hard"` | `R/parseOSD_functions.R:257-259` | ≥26,199 horizons | Show narrative; mark field as unreliable |
| SKB-3 | Moist rupture: "very friable" → `"friable"`, "very/extremely firm" → `"firm"` | `R/parseOSD_functions.R:261-263` | ≥36,376 + ≥8,931 horizons | Same as SKB-2 |
| SKB-4 | Cementation: "very/extremely weakly" → `"weakly"` | `R/parseOSD_functions.R:265-267` | ≥404 horizons | Same as SKB-2 |
| SKB-5 | Structure: the last of several structure phrases is kept | `R/parseOSD_functions.R:253-255` | ≥1,089 horizons | Show narrative; tooltip |
| SKB-6 | Blank lines and indentation removed from all text | `R/create_OSD.R:98` | all docs | Render each source line as a line; offer raw `.txt` download |
| SKB-7 | Text transliterated to ASCII | `R/create_OSD.R:96` | docs with diacritics | Accept; raw `.txt` is the original |
| SKB-8 | Only the first dry and first moist color per horizon kept | `R/parseOSD_functions.R:437-444` | ≥30,529 horizons mention >2 colors | Sketch uses first color; narrative shows all |
| SKB-9 | Missing moist hue | — | 16,786 horizons (11.6%) | Sketch fallback: dry color → neutral gray → hatched "unknown" |
| SKB-10 | Missing horizon depths | — | 5,021 horizons (3.5%) | Omit from sketch; list in table with a "depth not parsed" note |
| SKB-11 | Repeated section headers joined with `" & "` | `R/create_OSD.R:345` | ≥395 RIC, ≥208 REMARKS, ≥87 TYPICAL PEDON docs | Display `" & "` as a paragraph break? (open question) |
| SKB-12 | Section `content` includes its own header text | output shape | all sections | Strip a leading `HEADER:` when rendering |
| SKB-13 | Coarse-fragment parse documented as "too greedy" | `R/parseOSD_functions.R:135` (TODO comment) | not measured | Don't show `cf_class` as a separate value without the narrative |
| SKB-14 | Depth unit taken from the first horizon only | `R/parseOSD_functions.R:483-488` | not measured | None; note in docs |
| SKB-15 | No parsed RIC on main | RIC is only on branch `osd-ric-dev2` | all docs | RIC shown as text |
| SKB-16 | `SITE` holds only drainage class | `R/parseOSD_functions.R:273-301` | all docs | Slope, elevation and climate stay in section text |
| SKB-17 | Missing values are the string `"NA"`, not `null` | output shape | many fields/sections | Normalize `"NA"` → absent when reading |

## Details

### SKB-1: `HORIZONS` nested
`inst/extdata/OSD/A/AMADOR.json`: `HORIZONS` is a list of length 1 whose element is
the list of horizon objects. Present in 24,906 of 24,928 docs. Downstream code
already works around it: `openssurgo/soillite/scripts/build_artifacts.py:804-807`
unwraps it. SoilProfiles.js `parseOSDJson()` does not
(`SoilProfiles.js/src/parsers/osd.ts:78-109`) and returns 0 horizons.

### SKB-2 to SKB-4: rupture and cementation regexes
Each function is `gsub(".*(alt1|alt2|...).*|.*", "\\1", x)`. The leading greedy
`.*` takes as much text as it can, so the alternation matches the shortest suffix
that still fits. For example, in "slightly hard" `.*` swallows "slightly " and
the match is `hard`. Ordering the alternatives longest-first does not help,
because the greedy prefix runs first.

- AMADOR A horizon: narrative "...structure; slightly hard, friable, ..." →
  `"dry_rupture": "hard"`.
- Scan condition: parsed value is the short form, the narrative contains the long
  form, and the narrative has no standalone short form. Examples: FIRSTVIEW
  (slightly hard), FIROKE (very friable), FREECE (very/extremely firm), FLACKVILLE
  (very weakly cemented).

### SKB-5: structure
`.parse_structure` has the same leading `.*`. When a horizon has compound
structure ("strong medium prismatic structure parting to moderate medium
subangular blocky structure"), the **last** phrase is kept rather than the first
(primary) one. Scan condition: more than one full "grade size type structure"
phrase, and the parsed value matches the last of them but not the first. The
count (≥1,089, e.g. FARNUF) misses "parting to" phrases that drop the word
"structure", so the true number is higher.

### SKB-6: line structure lost
`raw <- trimws(raw[trimws(raw) != ""])` drops every blank line and leading
indentation before sectioning. The old OSD HTML kept paragraphs as `<BR><BR>`.
The viewer renders one line per source line and links the raw `.txt` (unmarked)
for the original layout.

### SKB-7: ASCII transliteration
`stringi::stri_trans_general(raw, "Latin-ASCII")` (`create_OSD.R:96`). Diacritics,
such as those in Spanish place names, are flattened in the JSON.

### SKB-8: first color only
`dry.colors[[i]] <- dc[1, ]` and `moist.colors[[i]] <- mc[1, ]`. Mottles,
redoximorphic features and alternate matrix colors are not in the parsed fields.
The scan counted horizons whose narrative has more than two Munsell notations,
which is a rough proxy (e.g. FEDORA).

### SKB-9 and SKB-10: missing colors and depths
16,786 horizons have `moist_hue == "NA"` and 5,021 have `top` or `bottom` as
`"NA"` (e.g. FRYINGPAN). For SKB-9, 54,369 horizons also lack `dry_hue`.

### SKB-11: `" & "` joins
When a header appears more than once in an OSD, the parts are pasted with
`collapse = " & "` (`create_OSD.R:345`). A literal `" & "` in prose is
indistinguishable from a join, so the viewer cannot split on it safely. Open
question: show it verbatim, or split only where the next part starts with a
known header?

### SKB-12 to SKB-17
- SKB-12: consumers strip it themselves, e.g. `openssurgo/soillite/scripts/build_artifacts.py:811`.
- SKB-13: `## TODO: this is too greedy as 'fine sand' will be found _within_ 'fine sandy loam'`.
- SKB-14: inches→cm applies to all horizons when the first horizon is in inches
  (`round(top * 2.54)`, `:486-487`).
- SKB-15: see the research doc, §4.3 and G27.
- SKB-16 and SKB-17: shape facts, see the research doc, §4.1.

## Reporting upstream (optional, not part of the viewer)
SKB-2 to SKB-5 share one fix (anchor with a word boundary or a non-greedy prefix,
alternatives longest-first). SKB-1, SKB-6 and SKB-11 change the output shape and
would need coordination with downstream consumers (soillite, SoilProfiles.js,
soilDB). Changing them may be undesirable for that reason, which is part of why
the viewer takes the output as is.
