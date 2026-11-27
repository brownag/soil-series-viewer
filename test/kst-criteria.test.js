import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_KST_DIR,
  loadKstCriteriaIndex,
  buildKstCriteriaPayload,
} from "../src/index/kst-criteria.js";

test("loadKstCriteriaIndex: loads real KST 2022 files from DEFAULT_KST_DIR", () => {
  const index = loadKstCriteriaIndex();

  assert.equal(index.byCode.size, 3153);
  assert.equal(index.byName.size, 3153);
  assert.equal(index.codesByName.size, 3153);

  const alfisolsCode = index.codesByName.get("alfisols");
  assert.equal(alfisolsCode, "J");
  const alfisols = index.byName.get("alfisols");
  assert.deepEqual(alfisols, index.byCode.get("J"));
  assert.equal(alfisols.code, "J");
  assert.equal(alfisols.name, "Alfisols");
  assert.equal(alfisols.chapter, 4);
  assert.equal(alfisols.page, 70);
  assert.equal(alfisols.key, "Key to Soil Orders");
  assert.deepEqual(alfisols.clauses, [
    "J. Other soils that do not have a plaggen epipedon and that have either:",
    "1. An argillic, kandic, or natric horizon; or",
    "2. A fragipan that has clay films 1 mm or more thick in some part.",
    "Alfisols, p. 73",
  ]);

  const gelisolsCode = index.codesByName.get("gelisols");
  assert.equal(gelisolsCode, "A");
  const gelisols = index.byName.get("gelisols");
  assert.deepEqual(gelisols, index.byCode.get("A"));
  assert.equal(gelisols.code, "A");
  assert.equal(gelisols.name, "Gelisols");
  assert.equal(gelisols.chapter, 4);
  assert.equal(gelisols.page, 67);
  assert.equal(gelisols.key, "Key to Soil Orders");
  assert.ok(gelisols.clauses.length >= 3);
  assert.equal(gelisols.clauses[0], "A. Soils that have:");
  assert.ok(gelisols.clauses.some((clause) => clause.includes("Permafrost within 100 cm")));
});

test("buildKstCriteriaPayload: filters by usedCodes (Set and Array) and sorts keys by code", () => {
  const index = loadKstCriteriaIndex();

  const fromSet = buildKstCriteriaPayload(index, new Set(["J", "A", "NONEXISTENT"]));
  assert.deepEqual(Object.keys(fromSet), ["A", "J"]);
  assert.equal(fromSet.A.name, "Gelisols");
  assert.equal(fromSet.J.name, "Alfisols");
  assert.equal(fromSet.J.chapter, 4);
  assert.equal(fromSet.J.page, 70);

  const fromArray = buildKstCriteriaPayload(index, ["J", "A", "J"]);
  assert.deepEqual(fromArray, fromSet);

  // JSON round-trip preserves exact structure
  assert.deepEqual(JSON.parse(JSON.stringify(fromSet)), fromSet);

  // Empty usedCodes produces empty object
  assert.deepEqual(buildKstCriteriaPayload(index, []), {});
  assert.deepEqual(buildKstCriteriaPayload(index, new Set()), {});
});

test("buildKstCriteriaPayload: returns all codes sorted when usedCodes is omitted or null", () => {
  const index = loadKstCriteriaIndex();
  const payload = buildKstCriteriaPayload(index);
  const keys = Object.keys(payload);

  assert.equal(keys.length, 3153);
  const sorted = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  assert.deepEqual(keys, sorted);
  assert.equal(payload.A.name, "Gelisols");
  assert.equal(payload.J.name, "Alfisols");
});

test("loadKstCriteriaIndex: handles missing kstDir or missing files gracefully without throwing", () => {
  const missingDir = path.join(os.tmpdir(), `missing-kst-dir-${Date.now()}-${Math.random()}`);
  const emptyFromMissingDir = loadKstCriteriaIndex({ kstDir: missingDir });

  assert.ok(emptyFromMissingDir.byCode instanceof Map);
  assert.ok(emptyFromMissingDir.byName instanceof Map);
  assert.ok(emptyFromMissingDir.codesByName instanceof Map);
  assert.equal(emptyFromMissingDir.byCode.size, 0);
  assert.equal(emptyFromMissingDir.byName.size, 0);
  assert.equal(emptyFromMissingDir.codesByName.size, 0);
  assert.deepEqual(buildKstCriteriaPayload(emptyFromMissingDir), {});

  // Also test directory containing only one of the two files
  const partialDir = fs.mkdtempSync(path.join(os.tmpdir(), "partial-kst-"));
  try {
    fs.writeFileSync(
      path.join(partialDir, "2022_KST_codes.json"),
      JSON.stringify([{ code: "A", name: "Gelisols" }]),
      "utf8"
    );
    const emptyFromPartial = loadKstCriteriaIndex({ kstDir: partialDir });
    assert.equal(emptyFromPartial.byCode.size, 0);
    assert.equal(emptyFromPartial.byName.size, 0);
    assert.equal(emptyFromPartial.codesByName.size, 0);
  } finally {
    fs.rmSync(partialDir, { recursive: true, force: true });
  }
});

test("loadKstCriteriaIndex: extracts first non-null metadata and trims/filters clauses", () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "fixture-kst-"));
  try {
    fs.writeFileSync(
      path.join(fixtureDir, "2022_KST_codes.json"),
      JSON.stringify([
        { code: "X1", name: "  Sample Taxon  " },
        { code: "X2", name: "No Criteria Taxon" },
      ]),
      "utf8"
    );
    fs.writeFileSync(
      path.join(fixtureDir, "2022_KST_criteria_EN.json"),
      JSON.stringify({
        X1: [
          { content: "   ", chapter: null, page: null, key: null },
          { content: "  First clause  ", chapter: null, page: 42, key: null },
          { content: "Second clause", chapter: 7, page: 43, key: "Sample Key" },
          { content: null, chapter: 8, page: 44, key: "Other Key" },
        ],
      }),
      "utf8"
    );

    const index = loadKstCriteriaIndex({ kstDir: fixtureDir });
    assert.equal(index.codesByName.get("sample taxon"), "X1");
    assert.deepEqual(index.byName.get("sample taxon"), {
      code: "X1",
      name: "  Sample Taxon  ",
      chapter: 7,
      page: 42,
      key: "Sample Key",
      clauses: ["First clause", "Second clause"],
    });
    assert.deepEqual(index.byCode.get("X2"), {
      code: "X2",
      name: "No Criteria Taxon",
      chapter: null,
      page: null,
      key: null,
      clauses: [],
    });
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("DEFAULT_KST_DIR points to expected SoilKnowledgeBase path", () => {
  assert.equal(
    DEFAULT_KST_DIR,
    process.env.OSD_KST_DIR || "/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/KST"
  );
});
