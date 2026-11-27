import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildSite } from "../src/cli/build.js";

test("enrichment integration: cross-links, QA notes, qa-report.json, and same-family panel", async (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "ssv-enrichment-"));
  t.after(async () => {
    await fsp.rm(outDir, { recursive: true, force: true });
  });

  const summary = await buildSite({
    seriesFilter: ["AMADOR", "BORREGUERO", "EXCHEQUER", "AUBURN", "FRYINGPAN"],
    outDir,
  });

  assert.equal(summary.builtCount, 5);
  assert.ok(summary.qaSummary, "buildSite summary should include qaSummary");
  assert.equal(summary.qaSummary.totalRecords, 5);
  assert.ok(summary.qaSummary.recordsWithIssues > 0);
  assert.ok(summary.qaSummary.countsByCode["SKB-2"] >= 1);
  assert.ok(summary.qaSummary.countsByCode["SKB-10"] >= 1);

  const [amadorHtml, auburnHtml, exchequerHtml, fryingpanHtml, qaReportRaw] =
    await Promise.all([
      fsp.readFile(path.join(outDir, "OSD_Docs", "A", "AMADOR.html"), "utf8"),
      fsp.readFile(path.join(outDir, "OSD_Docs", "A", "AUBURN.html"), "utf8"),
      fsp.readFile(path.join(outDir, "OSD_Docs", "E", "EXCHEQUER.html"), "utf8"),
      fsp.readFile(path.join(outDir, "OSD_Docs", "F", "FRYINGPAN.html"), "utf8"),
      fsp.readFile(path.join(outDir, "data", "qa-report.json"), "utf8"),
    ]);

  assert.ok(amadorHtml.includes('href="../../index.html"'));
  assert.ok(amadorHtml.includes("All Series"));
  assert.ok(
    amadorHtml.includes('<a class="osd-series-link" href="../B/BORREGUERO.html">'),
    "AMADOR should cross-link to BORREGUERO"
  );
  assert.ok(
    auburnHtml.includes('<a class="osd-series-link" href="../E/EXCHEQUER.html">'),
    "AUBURN should cross-link to EXCHEQUER"
  );
  assert.ok(
    exchequerHtml.includes('<a class="osd-series-link" href="../A/AUBURN.html">'),
    "EXCHEQUER should cross-link to AUBURN"
  );

  assert.ok(
    amadorHtml.includes('<details class="osd-qa-notes no-print">'),
    "AMADOR should render collapsible QA notes"
  );
  assert.ok(
    amadorHtml.includes("SKB-2"),
    "AMADOR QA notes should mention SKB-2"
  );

  assert.ok(
    fryingpanHtml.includes('<details class="osd-qa-notes no-print">'),
    "FRYINGPAN should render collapsible QA notes"
  );
  assert.ok(
    fryingpanHtml.includes("SKB-10"),
    "FRYINGPAN QA notes should mention SKB-10"
  );

  assert.ok(
    amadorHtml.includes('id="same-family-series"'),
    "AMADOR should render same-family competing panel when sibling BORREGUERO is present"
  );
  assert.match(
    amadorHtml,
    /<a class="osd-competing-card" href="\.\.\/B\/BORREGUERO\.html"[^>]*><span class="osd-competing-strip"><svg[\s\S]*?<\/svg><\/span><span class="osd-competing-name">BORREGUERO<\/span><\/a>/
  );

  const qaReport = JSON.parse(qaReportRaw);
  assert.equal(qaReport.totalRecords, 5);
  assert.ok(qaReport.recordsWithIssues > 0);
  assert.equal(typeof qaReport.countsByCode, "object");
  assert.equal(typeof qaReport.seriesByCode, "object");
  assert.ok(qaReport.seriesByCode["SKB-2"].includes("AMADOR"));
  assert.ok(qaReport.seriesByCode["SKB-10"].includes("FRYINGPAN"));
});

test("enrichment integration: --limit 40 build emits qa-report.json and valid pages", async (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "ssv-enrichment-limit-"));
  t.after(async () => {
    await fsp.rm(outDir, { recursive: true, force: true });
  });

  const summary = await buildSite({
    limit: 40,
    outDir,
  });

  assert.equal(summary.builtCount, 40);
  assert.equal(summary.qaSummary.totalRecords, 40);

  const qaReportPath = path.join(outDir, "data", "qa-report.json");
  assert.ok(fs.existsSync(qaReportPath));
  const qaReport = JSON.parse(await fsp.readFile(qaReportPath, "utf8"));
  assert.equal(qaReport.totalRecords, 40);
  assert.ok(qaReport.recordsWithIssues > 0);
  assert.ok(Object.keys(qaReport.countsByCode).length > 0);
  assert.ok(Object.keys(qaReport.seriesByCode).length > 0);
});
