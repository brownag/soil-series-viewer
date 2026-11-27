import test from "node:test";
import assert from "node:assert/strict";

import { loadCorpus } from "../src/loader/index.js";
import { detectRecordIssues, renderQaNotes } from "../src/qa/detect.js";
import { buildQaReport } from "../src/qa/report.js";

function makeCleanRecord(overrides = {}) {
  return {
    key: "CLEAN",
    name: "CLEAN",
    hasSc: true,
    hasSkb: true,
    sc: { soilseriesname: "CLEAN" },
    skb: {
      SERIES: "CLEAN",
      REMARKS: { section: "REMARKS", content: "Clean remarks with no ampersand join." },
      HORIZONS: [],
    },
    horizons: [
      {
        name: "A",
        top: 0,
        bottom: 15,
        moist_hue: "10YR",
        moist_value: 3,
        moist_chroma: 2,
        dry_rupture: "hard",
        moist_rupture: "friable",
        cementation: null,
        coherence: null,
        narrative: "A--0 to 15 cm; brown loam; moderate medium subangular blocky structure; hard, friable; clear boundary.",
      },
    ],
    ...overrides,
  };
}

test("detectRecordIssues: clean record returns [] and does not mutate input", () => {
  const record = makeCleanRecord();
  const snapshot = structuredClone(record);

  const issues = detectRecordIssues(record);
  assert.deepEqual(issues, []);
  assert.deepEqual(record, snapshot);
  assert.equal(renderQaNotes(issues), "");
});

test("detectRecordIssues: detects SC-MISSING and SKB-MISSING", () => {
  const noSc = detectRecordIssues(makeCleanRecord({ hasSc: false, sc: null }));
  assert.deepEqual(noSc, [
    {
      code: "SC-MISSING",
      severity: "warn",
      summary: "No Series Classification (SCDB) record; taxonomy metadata unavailable.",
    },
  ]);

  const noSkb = detectRecordIssues(makeCleanRecord({ hasSkb: false, skb: null, horizons: [] }));
  assert.deepEqual(noSkb, [
    {
      code: "SKB-MISSING",
      severity: "warn",
      summary: "No SoilKnowledgeBase OSD narrative JSON available.",
    },
  ]);

  const neither = detectRecordIssues({ key: "EMPTY", hasSc: false, hasSkb: false });
  assert.deepEqual(
    neither.map((i) => i.code),
    ["SC-MISSING", "SKB-MISSING"]
  );
});

test("detectRecordIssues: detects SKB-9 for plottable horizons missing moist color", () => {
  const record = makeCleanRecord({
    horizons: [
      { name: "A", top: 0, bottom: 10, moist_hue: null, moist_value: 4, moist_chroma: 2, narrative: "A" },
      { name: "Bw", top: 10, bottom: 30, moist_hue: "10YR", moist_value: null, moist_chroma: 3, narrative: "Bw" },
      { name: "C1", top: 30, bottom: 50, moist_hue: "10YR", moist_value: 5, moist_chroma: undefined, narrative: "C1" },
      // Zero value/chroma are valid numbers (should NOT trigger SKB-9)
      { name: "C2", top: 50, bottom: 70, moist_hue: "N", moist_value: 0, moist_chroma: 0, narrative: "C2" },
      // Missing bottom triggers SKB-10, not SKB-9
      { name: "2R", top: 70, bottom: null, moist_hue: null, moist_value: null, moist_chroma: null, narrative: "2R" },
      // Inverted bounds (bottom <= top) is not plottable so should not trigger SKB-9
      { name: "Bad", top: 80, bottom: 80, moist_hue: null, moist_value: null, moist_chroma: null, narrative: "Bad" },
    ],
  });

  const issues = detectRecordIssues(record);
  const skb9 = issues.find((i) => i.code === "SKB-9");
  const skb10 = issues.find((i) => i.code === "SKB-10");

  assert.deepEqual(skb9, {
    code: "SKB-9",
    severity: "info",
    count: 3,
    summary: "3 horizon(s) missing parsed moist Munsell color; sketch uses dry-color or neutral fallback.",
  });
  assert.deepEqual(skb10, {
    code: "SKB-10",
    severity: "warn",
    count: 1,
    summary: "1 horizon(s) missing parsed depth bounds; omitted from profile sketch.",
  });
});

test("detectRecordIssues: detects SKB-10 for missing or non-finite depth bounds", () => {
  const record = makeCleanRecord({
    horizons: [
      { name: "A", top: null, bottom: 10, moist_hue: "10YR", moist_value: 4, moist_chroma: 2 },
      { name: "B", top: 10, bottom: undefined, moist_hue: "10YR", moist_value: 4, moist_chroma: 2 },
      { name: "C", top: "NA", bottom: 40, moist_hue: "10YR", moist_value: 4, moist_chroma: 2 },
      { name: "D", top: 40, bottom: "", moist_hue: "10YR", moist_value: 4, moist_chroma: 2 },
      { name: "E", top: 40, bottom: Infinity, moist_hue: "10YR", moist_value: 4, moist_chroma: 2 },
    ],
  });

  const issues = detectRecordIssues(record);
  assert.deepEqual(issues, [
    {
      code: "SKB-10",
      severity: "warn",
      count: 5,
      summary: "5 horizon(s) missing parsed depth bounds; omitted from profile sketch.",
    },
  ]);
});

test("detectRecordIssues: detects SKB-2 only when dry_rupture is hard and narrative has slightly hard without standalone hard", () => {
  const record = makeCleanRecord({
    horizons: [
      {
        name: "A",
        top: 0,
        bottom: 10,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        dry_rupture: "Hard",
        narrative: "A--0 to 10 cm; slightly hard, friable; clear boundary.",
      },
      {
        name: "Bt1",
        top: 10,
        bottom: 20,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        dry_rupture: "hard",
        narrative: "Bt1--10 to 20 cm; slightly   hard in upper part, hard in lower part.",
      },
      {
        name: "Bt2",
        top: 20,
        bottom: 30,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        dry_rupture: "hard",
        narrative: "Bt2--20 to 30 cm; slightly hard over hardwood roots.",
      },
      {
        name: "C",
        top: 30,
        bottom: 40,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        dry_rupture: "soft",
        narrative: "C--30 to 40 cm; slightly hard.",
      },
    ],
  });

  const issues = detectRecordIssues(record);
  const skb2 = issues.find((i) => i.code === "SKB-2");
  assert.equal(skb2?.severity, "info");
  assert.equal(skb2?.count, 2);
});

test("detectRecordIssues: detects SKB-3 for truncated moist_rupture", () => {
  const record = makeCleanRecord({
    horizons: [
      {
        name: "A",
        top: 0,
        bottom: 10,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        moist_rupture: "Friable",
        narrative: "A--0 to 10 cm; very friable, nonsticky.",
      },
      {
        name: "Bt1",
        top: 10,
        bottom: 20,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        moist_rupture: "firm",
        narrative: "Bt1--10 to 20 cm; very firm, sticky.",
      },
      {
        name: "Bt2",
        top: 20,
        bottom: 30,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        moist_rupture: "firm",
        narrative: "Bt2--20 to 30 cm; extremely firm, very sticky.",
      },
      {
        name: "C",
        top: 30,
        bottom: 40,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        moist_rupture: "very friable",
        narrative: "C--30 to 40 cm; very friable.",
      },
    ],
  });

  const issues = detectRecordIssues(record);
  const skb3 = issues.find((i) => i.code === "SKB-3");
  assert.equal(skb3?.severity, "info");
  assert.equal(skb3?.count, 3);
});

test("detectRecordIssues: detects SKB-4 for cementation/coherence weakly vs very/extremely weakly", () => {
  const record = makeCleanRecord({
    horizons: [
      {
        name: "Bs1",
        top: 0,
        bottom: 10,
        moist_hue: "7.5YR",
        moist_value: 4,
        moist_chroma: 4,
        cementation: "weakly",
        narrative: "Bs1--very weakly cemented by iron.",
      },
      {
        name: "Bs2",
        top: 10,
        bottom: 20,
        moist_hue: "7.5YR",
        moist_value: 4,
        moist_chroma: 4,
        cementation: "weakly cemented",
        narrative: "Bs2--extremely weakly cemented by silica.",
      },
      {
        name: "Bs3",
        top: 20,
        bottom: 30,
        moist_hue: "7.5YR",
        moist_value: 4,
        moist_chroma: 4,
        coherence: "weakly cemented",
        narrative: "Bs3--very weakly cemented in places.",
      },
      {
        name: "C",
        top: 30,
        bottom: 40,
        moist_hue: "7.5YR",
        moist_value: 4,
        moist_chroma: 4,
        cementation: "strongly",
        narrative: "C--very weakly cemented.",
      },
    ],
  });

  const issues = detectRecordIssues(record);
  const skb4 = issues.find((i) => i.code === "SKB-4");
  assert.equal(skb4?.severity, "info");
  assert.equal(skb4?.count, 3);
});

test("detectRecordIssues: detects SKB-5 for parting to or >=2 structure occurrences", () => {
  const record = makeCleanRecord({
    horizons: [
      {
        name: "Bt1",
        top: 0,
        bottom: 15,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        narrative: "Bt1--strong medium prismatic structure parting to moderate medium subangular blocky.",
      },
      {
        name: "Bt2",
        top: 15,
        bottom: 30,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        narrative: "Bt2--weak platy structure in upper part and moderate granular structure in lower part.",
      },
      {
        name: "C",
        top: 30,
        bottom: 50,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        narrative: "C--massive structureless.",
      },
    ],
  });

  const issues = detectRecordIssues(record);
  const skb5 = issues.find((i) => i.code === "SKB-5");
  assert.equal(skb5?.severity, "info");
  assert.equal(skb5?.count, 2);
});

test("detectRecordIssues: detects SKB-11 for SKB sections containing ' & '", () => {
  const record = makeCleanRecord({
    skb: {
      SERIES: "AMP",
      OVERVIEW: "Plain string should not count & neither should A & B",
      "RANGE IN CHARACTERISTICS": {
        section: "RANGE IN CHARACTERISTICS",
        content: "Part one & Part two.",
      },
      REMARKS: {
        section: "REMARKS",
        content: "First remark. & Second remark.",
      },
      "USE AND VEGETATION": {
        section: "USE AND VEGETATION",
        content: "Rangeland and pasture.",
      },
      "ADDITIONAL DATA": {
        section: "ADDITIONAL DATA",
        content: null,
      },
      HORIZONS: [],
    },
  });

  const issues = detectRecordIssues(record);
  const skb11 = issues.find((i) => i.code === "SKB-11");
  assert.equal(skb11?.severity, "info");
  assert.equal(skb11?.count, 2);
});

test("detectRecordIssues: integrates cleanly with real corpus records", async () => {
  const { records } = await loadCorpus({
    seriesFilter: ["AMADOR", "FARNUF", "FLACKVILLE", "FRYINGPAN"],
  });
  const byKey = new Map(records.map((r) => [r.key, detectRecordIssues(r)]));

  assert.ok(byKey.get("AMADOR")?.some((i) => i.code === "SKB-2"));
  assert.ok(byKey.get("FARNUF")?.some((i) => i.code === "SKB-5"));
  assert.ok(byKey.get("FLACKVILLE")?.some((i) => i.code === "SKB-4"));
  assert.ok(byKey.get("FRYINGPAN")?.some((i) => i.code === "SKB-10"));
});

test("renderQaNotes: returns '' for empty/non-array and escapes HTML in rendered list", () => {
  assert.equal(renderQaNotes([]), "");
  assert.equal(renderQaNotes(null), "");
  assert.equal(renderQaNotes(undefined), "");

  const html = renderQaNotes([
    {
      code: "SKB-11<script>",
      severity: "warn",
      summary: 'Section contains " & " and <img onerror=alert(1)>',
    },
    {
      code: "SKB-2",
      severity: "info",
      summary: "1 horizon(s) affected; 'narrative' is authoritative.",
    },
  ]);

  assert.match(html, /^<details class="osd-qa-notes no-print">/);
  assert.match(html, /<summary>Data quality notes \(2\)<\/summary>/);
  assert.match(
    html,
    /<li class="osd-qa-item osd-qa-warn"><strong>SKB-11&lt;script&gt;:<\/strong> Section contains &quot; &amp; &quot; and &lt;img onerror=alert\(1\)&gt;<\/li>/
  );
  assert.match(
    html,
    /<li class="osd-qa-item osd-qa-info"><strong>SKB-2:<\/strong> 1 horizon\(s\) affected; &#39;narrative&#39; is authoritative\.<\/li>/
  );
  assert.ok(!html.includes("<script>"));
});

test("buildQaReport: aggregates Map and plain-object inputs deterministically with sorted keys and series", () => {
  const records = [
    { key: "ZEBRA" },
    { key: "ALPHA" },
    { key: "MIDDLE" },
    { key: "CLEAN" },
  ];

  const issueMap = new Map([
    [
      "ZEBRA",
      [
        { code: "SKB-9", severity: "info", summary: "s1", count: 2 },
        { code: "SC-MISSING", severity: "warn", summary: "s2" },
      ],
    ],
    [
      "ALPHA",
      [
        { code: "SKB-9", severity: "info", summary: "s3", count: 1 },
        { code: "SKB-10", severity: "warn", summary: "s4", count: 1 },
      ],
    ],
    ["MIDDLE", []],
    ["CLEAN", []],
  ]);

  const fixedTime = "2026-11-27T20:00:00.000Z";
  const fromMap = buildQaReport(records, issueMap, { generatedAt: fixedTime });
  const fromObj = buildQaReport(records, Object.fromEntries(issueMap), {
    generatedAt: fixedTime,
  });

  assert.deepEqual(fromMap, fromObj);
  assert.equal(fromMap.generatedAt, fixedTime);
  assert.equal(fromMap.totalRecords, 4);
  assert.equal(fromMap.recordsWithIssues, 2);

  assert.deepEqual(Object.keys(fromMap.countsByCode), ["SC-MISSING", "SKB-10", "SKB-9"]);
  assert.deepEqual(Object.keys(fromMap.seriesByCode), ["SC-MISSING", "SKB-10", "SKB-9"]);
  assert.deepEqual(fromMap.countsByCode, {
    "SC-MISSING": 1,
    "SKB-10": 1,
    "SKB-9": 2,
  });
  assert.deepEqual(fromMap.seriesByCode, {
    "SC-MISSING": ["ZEBRA"],
    "SKB-10": ["ALPHA"],
    "SKB-9": ["ALPHA", "ZEBRA"],
  });

  // Default generatedAt produces a valid ISO timestamp
  const defaultReport = buildQaReport(records, issueMap);
  assert.match(defaultReport.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});
