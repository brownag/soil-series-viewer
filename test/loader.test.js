import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { seriesNameToKey, keyToRelativePath } from "../src/loader/keys.js";
import {
  naToNull,
  unwrapNestedList,
  stripSectionHeaderPrefix,
  normalizeSkbDoc,
} from "../src/loader/normalize.js";
import {
  DEFAULT_SKB_DIR,
  parseCsvRows,
  parseCsv,
  loadSkbFile,
  loadCorpus,
} from "../src/loader/index.js";

test("keys: seriesNameToKey and keyToRelativePath handle special characters", () => {
  assert.equal(seriesNameToKey("AMADOR"), "AMADOR");
  assert.equal(seriesNameToKey("  amador "), "AMADOR");
  assert.equal(seriesNameToKey("MT. AIRY"), "MT._AIRY");
  assert.equal(seriesNameToKey("MT._AIRY"), "MT._AIRY");
  assert.equal(seriesNameToKey("KANA`A"), "KANA@A");
  assert.equal(seriesNameToKey("KANA@A"), "KANA@A");
  assert.equal(seriesNameToKey("O'BRIEN"), "O'BRIEN");

  assert.equal(keyToRelativePath("AMADOR", "json"), "A/AMADOR.json");
  assert.equal(keyToRelativePath("MT._AIRY", ".json"), "M/MT._AIRY.json");
  assert.equal(keyToRelativePath("KANA@A", "txt"), "K/KANA@A.txt");
  assert.equal(keyToRelativePath("MT. AIRY", "html"), "M/MT._AIRY.html");
});

test("normalize: SKB-1, SKB-12, and SKB-17 on synthetic and real SKB docs", async () => {
  // SKB-17 recursive NA -> null
  assert.deepEqual(
    naToNull({ a: "NA", b: ["NA", { c: "NA", d: 1 }] }),
    { a: null, b: [null, { c: null, d: 1 }] }
  );

  // SKB-1 unwrap [[...]] and drop [{}]
  assert.deepEqual(unwrapNestedList([[{ name: "A" }, { name: "Bt" }]]), [
    { name: "A" },
    { name: "Bt" },
  ]);
  assert.deepEqual(unwrapNestedList([{}]), []);

  // SKB-12 strip leading header prefix including SKB-11 joined headers
  assert.equal(
    stripSectionHeaderPrefix(
      "MLRA SOIL SURVEY REGIONAL OFFICE (MO) RESPONSIBLE: RALEIGH, NC",
      "MLRA SOIL SURVEY REGIONAL OFFICE (MO) RESPONSIBLE & MLRA SOIL SURVEY REGIONAL OFFICE (MO) RESPONSIBLE",
      "REGIONAL OFFICE"
    ),
    "RALEIGH, NC"
  );

  // Real AMADOR.json
  const amador = await loadSkbFile(path.join(DEFAULT_SKB_DIR, "A/AMADOR.json"));
  assert.equal(amador.SERIES, "AMADOR");
  assert.equal(amador.SITE.length, 1);
  assert.equal(amador.SITE[0].drainage, "well");
  assert.equal(amador.HORIZONS.length, 4);
  assert.deepEqual(
    amador.HORIZONS.map((h) => h.name),
    ["A", "Bw1", "Bw2", "Cr"]
  );
  assert.equal(amador.HORIZONS[0].coherence, null);
  assert.equal(amador.HORIZONS[0].cf_class, null);
  assert.equal(amador.HORIZONS[0].eff_class, null);
  assert.equal(
    amador["TAXONOMIC CLASS"].content,
    "Loamy, mixed, superactive, thermic, shallow Typic Haploxerepts"
  );
  assert.equal(amador["REGIONAL OFFICE"].content, "Davis, California");
  assert.ok(
    amador["RANGE IN CHARACTERISTICS"].content.startsWith("Soil temperature:")
  );

  // Real MT._AIRY.json with NA section contents
  const mtAiry = await loadSkbFile(path.join(DEFAULT_SKB_DIR, "M/MT._AIRY.json"));
  assert.equal(mtAiry["COMPETING SERIES"].content, null);
  assert.equal(mtAiry["ADDITIONAL DATA"].content, null);
  assert.ok(mtAiry["TYPE LOCATION"].content.startsWith("Frederick County, Maryland"));

  // Real ANCHOR_BAY.json ([{}] horizons -> [])
  const anchorBay = await loadSkbFile(path.join(DEFAULT_SKB_DIR, "A/ANCHOR_BAY.json"));
  assert.deepEqual(anchorBay.HORIZONS, []);

  // Ensure normalizeSkbDoc does not mutate raw input
  const raw = {
    SERIES: "TEST",
    SITE: [[{ drainage: "NA" }]],
    HORIZONS: [[{ name: "A", eff_class: "NA" }]],
    REMARKS: { section: "REMARKS", content: "REMARKS: hello" },
  };
  const norm = normalizeSkbDoc(raw);
  assert.equal(raw.HORIZONS[0][0].eff_class, "NA");
  assert.equal(norm.HORIZONS[0].eff_class, null);
  assert.equal(norm.SITE[0].drainage, null);
  assert.equal(norm.REMARKS.content, "hello");
});

test("csv: RFC 4180 parser handles quoted commas, escaped quotes, newlines, and NA", () => {
  const sample = [
    '"id","name","notes","flag"',
    '1,"MT. AIRY","Loamy, ""micaceous"", mesic",NA',
    '2,"KANA`A","Line 1\nLine 2",TRUE',
  ].join("\r\n");

  const rows = parseCsvRows(sample);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], ["1", "MT. AIRY", 'Loamy, "micaceous", mesic', "NA"]);

  const parsed = parseCsv(sample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, "MT. AIRY");
  assert.equal(parsed[0].notes, 'Loamy, "micaceous", mesic');
  assert.equal(parsed[0].flag, null);
  assert.equal(parsed[1].notes, "Line 1\nLine 2");
});

test("loader: filtered load for AMADOR, MT._AIRY, and KANA@A plus limit option", async () => {
  const { records, report } = await loadCorpus({
    seriesFilter: ["AMADOR", "MT. AIRY", "KANA`A"],
  });

  assert.equal(records.length, 3);
  assert.deepEqual(
    records.map((r) => r.key),
    ["AMADOR", "KANA@A", "MT._AIRY"]
  );

  for (const rec of records) {
    assert.equal(rec.hasSc, true);
    assert.equal(rec.hasSkb, true);
    assert.equal(rec.status, "Established");
    assert.ok(rec.horizons.length > 0);
  }

  assert.equal(report.totalSc, 3);
  assert.equal(report.totalSkb, 3);
  assert.equal(report.matchedTotal, 3);
  assert.equal(report.matchedByStatus.Established, 3);
  assert.equal(report.scOnly, 0);
  assert.equal(report.skbOnly, 0);

  const limited = await loadCorpus({ limit: 15 });
  assert.equal(limited.records.length, 15);
  assert.equal(
    limited.report.matchedTotal + limited.report.scOnly,
    limited.report.totalSc
  );
  assert.equal(
    limited.report.matchedTotal + limited.report.skbOnly,
    limited.report.totalSkb
  );
});

test("loader: full-corpus load and coverage report invariants", async () => {
  const { records, report } = await loadCorpus();

  assert.equal(report.totalSc, 26668);
  assert.equal(report.totalSkb, 24928);
  assert.equal(
    report.matchedTotal + report.scOnly,
    report.totalSc,
    "matchedTotal + scOnly === totalSc"
  );
  assert.equal(
    report.matchedTotal + report.skbOnly,
    report.totalSkb,
    "matchedTotal + skbOnly === totalSkb"
  );
  assert.equal(
    report.matchedByStatus.Established +
      report.matchedByStatus.Tentative +
      report.matchedByStatus.Inactive,
    report.matchedTotal
  );
  assert.equal(
    records.length,
    report.matchedTotal + report.scOnly + report.skbOnly
  );

  assert.ok(report.matchedByStatus.Established > 23000);
  assert.ok(report.matchedByStatus.Tentative > 1000);
  assert.ok(report.matchedByStatus.Inactive > 200);
  assert.ok(report.scOnly > 1500);
  assert.ok(report.skbOnly > 0);

  const byKey = new Map(records.map((r) => [r.key, r]));
  for (const key of ["AMADOR", "MT._AIRY", "KANA@A"]) {
    const rec = byKey.get(key);
    assert.ok(rec, `Expected ${key} in full corpus`);
    assert.equal(rec.hasSc, true);
    assert.equal(rec.hasSkb, true);
  }

  const unclassified = records.find((r) => !r.hasSc && r.hasSkb);
  assert.ok(unclassified, "Expected at least one unclassified SKB-only record");
  assert.equal(unclassified.status, "Unclassified");
});
