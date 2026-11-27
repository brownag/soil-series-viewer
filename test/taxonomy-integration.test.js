import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildSite } from "../src/cli/build.js";

test("taxonomy integration: buildSite emits taxonomy, KST criteria, glossary, and series breadcrumbs", async (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "ssv-taxonomy-"));
  t.after(async () => {
    await fsp.rm(outDir, { recursive: true, force: true });
  });

  const summary = await buildSite({
    seriesFilter: ["AMADOR", "EXCHEQUER", "AUBURN", "MT._AIRY"],
    outDir,
  });

  assert.equal(summary.builtCount, 4);
  assert.ok(summary.taxonomyOrders >= 1);
  assert.ok(summary.glossaryTerms >= 136);

  const expectedFiles = [
    "taxonomy.css",
    path.join("assets", "taxonomy-app.js"),
    path.join("assets", "glossary-app.js"),
    path.join("taxonomy", "index.html"),
    path.join("glossary", "index.html"),
    path.join("data", "taxonomy-tree.json"),
    path.join("data", "kst-criteria.json"),
    path.join("data", "glossary.json"),
  ];

  for (const relPath of expectedFiles) {
    assert.ok(
      fs.existsSync(path.join(outDir, relPath)),
      `Expected output file to exist: ${relPath}`
    );
  }

  const [
    taxonomyTreeRaw,
    kstCriteriaRaw,
    glossaryRaw,
    taxonomyHtml,
    glossaryHtml,
    amadorHtml,
    indexHtml,
  ] = await Promise.all([
    fsp.readFile(path.join(outDir, "data", "taxonomy-tree.json"), "utf8"),
    fsp.readFile(path.join(outDir, "data", "kst-criteria.json"), "utf8"),
    fsp.readFile(path.join(outDir, "data", "glossary.json"), "utf8"),
    fsp.readFile(path.join(outDir, "taxonomy", "index.html"), "utf8"),
    fsp.readFile(path.join(outDir, "glossary", "index.html"), "utf8"),
    fsp.readFile(path.join(outDir, "OSD_Docs", "A", "AMADOR.html"), "utf8"),
    fsp.readFile(path.join(outDir, "index.html"), "utf8"),
  ]);

  const taxonomyTree = JSON.parse(taxonomyTreeRaw);
  assert.ok(taxonomyTree.classifiedSeries >= 4);
  assert.ok(Array.isArray(taxonomyTree.orders) && taxonomyTree.orders.length >= 1);

  const kstCriteria = JSON.parse(kstCriteriaRaw);
  const kstEntries = Object.values(kstCriteria);
  assert.ok(kstEntries.length > 0, "kst-criteria.json should be a non-empty object");
  assert.ok(
    kstEntries.some((entry) => entry.chapter !== null && entry.chapter !== undefined),
    "kst-criteria.json entries should include KST chapters"
  );
  assert.ok(
    kstEntries.some((entry) => Array.isArray(entry.clauses) && entry.clauses.length > 0),
    "kst-criteria.json entries should include KST clauses"
  );

  const glossary = JSON.parse(glossaryRaw);
  assert.ok(glossary.totalTerms >= 136);
  assert.ok(Array.isArray(glossary.groups) && glossary.groups.length >= 1);
  assert.ok(Array.isArray(glossary.terms) && glossary.terms.length === glossary.totalTerms);

  assert.ok(taxonomyHtml.includes('href="../taxonomy.css"'));
  assert.ok(taxonomyHtml.includes('src="../assets/taxonomy-app.js"'));
  assert.ok(glossaryHtml.includes('href="../taxonomy.css"'));
  assert.ok(glossaryHtml.includes('src="../assets/glossary-app.js"'));

  assert.ok(amadorHtml.includes("osd-taxon-breadcrumb"));
  assert.ok(amadorHtml.includes("../../taxonomy/index.html#"));
  assert.ok(amadorHtml.includes("../../glossary/index.html"));
  assert.match(amadorHtml, /class="osd-taxon-breadcrumb[\s\S]*title="[^"]*KST Ch\./);

  assert.ok(indexHtml.includes('href="taxonomy/index.html"'));
  assert.ok(indexHtml.includes('href="glossary/index.html"'));
});
