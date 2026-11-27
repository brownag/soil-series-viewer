import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_DST_DATA_PATH,
  DEFAULT_FEATURELIST_PATH,
  buildGlossaryIndex,
  slugifyTerm,
} from "../src/index/glossary.js";

test("slugifyTerm produces stable lowercase kebab-case HTML anchor IDs", () => {
  assert.equal(slugifyTerm("Mineral Soil Material"), "mineral-soil-material");
  assert.equal(
    slugifyTerm("Diagnostic Surface Horizons:"),
    "diagnostic-surface-horizons"
  );
  assert.equal(
    slugifyTerm("Coefficient of Linear Extensibility (COLE)"),
    "coefficient-of-linear-extensibility-cole"
  );
  assert.equal(slugifyTerm("  Albic_Horizon / E  "), "albic-horizon-e");
  assert.equal(slugifyTerm(""), "");
  assert.equal(slugifyTerm(null), "");
});

test("buildGlossaryIndex merges real local SKB featurelist and DST dst-data.json", () => {
  assert.equal(fs.existsSync(DEFAULT_FEATURELIST_PATH), true);
  assert.equal(fs.existsSync(DEFAULT_DST_DATA_PATH), true);

  const index = buildGlossaryIndex();

  // SKB 2014 featurelist has 140 raw items with 4 duplicate term names,
  // yielding 136 unique normalized terms all also present in DST.
  assert.equal(index.totalTerms, index.terms.length);
  assert.ok(
    index.totalTerms >= 136,
    `expected at least 136 deduplicated terms, got ${index.totalTerms}`
  );
  assert.ok(index.groups.length >= 10);

  const mineral = index.terms.find(
    (entry) => entry.term === "Mineral Soil Material"
  );
  assert.ok(mineral, "expected Mineral Soil Material in merged index");
  assert.equal(mineral.id, "mineral-soil-material");
  assert.equal(mineral.group, "Soil Materials");
  assert.equal(mineral.chapter, 2);
  assert.equal(mineral.page, 3);
  assert.ok(mineral.sources.includes("SKB-KST-2014"));
  assert.ok(mineral.definition.includes("Mineral soil material"));

  // Duplicate featurelist entry with 0-len second item keeps the longer non-empty definition.
  const mineralogy = index.terms.find(
    (entry) => entry.term === "Key to Mineralogy Classes"
  );
  assert.ok(mineralogy);
  assert.equal(mineralogy.group, "Mineral Family");
  assert.ok(mineralogy.definition.length > 100);
  assert.ok(mineralogy.sources.includes("SKB-KST-2014"));

  // Verify groups are sorted alphabetically.
  const sortedGroups = [...index.groups].sort(
    (a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" }) ||
      a.localeCompare(b, "en")
  );
  assert.deepEqual(index.groups, sortedGroups);

  // Verify terms are sorted alphabetically (case-insensitive) and have unique IDs.
  const sortedTerms = [...index.terms].sort(
    (a, b) =>
      a.term.localeCompare(b.term, "en", { sensitivity: "base" }) ||
      a.term.localeCompare(b.term, "en")
  );
  assert.deepEqual(
    index.terms.map((t) => t.term),
    sortedTerms.map((t) => t.term)
  );
  const uniqueIds = new Set(index.terms.map((t) => t.id));
  assert.equal(uniqueIds.size, index.terms.length);
});

test("buildGlossaryIndex deduplicates by normalized term and prefers longer non-empty definition", (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "glossary-test-"));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const featurelistPath = path.join(tmpDir, "featurelist.json");
  const dstDataPath = path.join(tmpDir, "dst-data.json");

  fs.writeFileSync(
    featurelistPath,
    JSON.stringify([
      {
        group: "Subsurface",
        name: "Argillic Horizon",
        chapter: 3,
        page: 14,
        description: "Short SKB note.",
      },
      {
        group: "Surface",
        name: "Mollic Epipedon",
        chapter: 3,
        page: 7,
        description:
          "Detailed SKB description of a thick, dark-colored surface horizon.",
      },
      {
        group: "Soil Materials",
        name: "Gelic Materials",
        chapter: 2,
        page: 5,
        description: "SKB-only gelic materials definition.",
      },
      {
        group: "Surface",
        name: "Mollic Epipedon",
        chapter: 3,
        page: 99,
        description: "",
      },
    ])
  );

  fs.writeFileSync(
    dstDataPath,
    JSON.stringify({
      glossary: {
        argillic_horizon: {
          id: "argillic_horizon",
          term: "  argillic horizon ",
          definition:
            "Longer DST definition describing illuvial accumulation of silicate clay.",
        },
        mollic_epipedon: {
          id: "mollic_epipedon",
          term: "Mollic Epipedon",
          definition: "Short DST.",
        },
        zebra_feature: {
          id: "zebra_feature",
          term: "zebra feature",
          definition: "DST-only glossary term.",
        },
      },
    })
  );

  const index = buildGlossaryIndex({ featurelistPath, dstDataPath });

  assert.equal(index.totalTerms, 4);
  assert.deepEqual(index.groups, [
    "Glossary",
    "Soil Materials",
    "Subsurface",
    "Surface",
  ]);
  assert.deepEqual(
    index.terms.map((entry) => entry.term),
    ["Argillic Horizon", "Gelic Materials", "Mollic Epipedon", "zebra feature"]
  );

  const argillic = index.terms[0];
  assert.deepEqual(argillic, {
    id: "argillic-horizon",
    term: "Argillic Horizon",
    group: "Subsurface",
    chapter: 3,
    page: 14,
    definition:
      "Longer DST definition describing illuvial accumulation of silicate clay.",
    sources: ["SKB-KST-2014", "DST"],
  });

  const gelic = index.terms[1];
  assert.deepEqual(gelic, {
    id: "gelic-materials",
    term: "Gelic Materials",
    group: "Soil Materials",
    chapter: 2,
    page: 5,
    definition: "SKB-only gelic materials definition.",
    sources: ["SKB-KST-2014"],
  });

  const mollic = index.terms[2];
  assert.deepEqual(mollic, {
    id: "mollic-epipedon",
    term: "Mollic Epipedon",
    group: "Surface",
    chapter: 3,
    page: 7,
    definition:
      "Detailed SKB description of a thick, dark-colored surface horizon.",
    sources: ["SKB-KST-2014", "DST"],
  });

  const zebra = index.terms[3];
  assert.deepEqual(zebra, {
    id: "zebra-feature",
    term: "zebra feature",
    group: "Glossary",
    chapter: null,
    page: null,
    definition: "DST-only glossary term.",
    sources: ["DST"],
  });
});

test("buildGlossaryIndex gracefully skips missing source files without throwing", (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "glossary-missing-"));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const missingFeaturelist = path.join(tmpDir, "no-featurelist.json");
  const missingDst = path.join(tmpDir, "no-dst.json");

  const empty = buildGlossaryIndex({
    featurelistPath: missingFeaturelist,
    dstDataPath: missingDst,
  });
  assert.deepEqual(empty, {
    totalTerms: 0,
    groups: [],
    terms: [],
  });

  const featurelistPath = path.join(tmpDir, "featurelist.json");
  fs.writeFileSync(
    featurelistPath,
    JSON.stringify([
      {
        group: "Surface",
        name: "Anthropic Epipedon",
        chapter: 3,
        page: 6,
        description: "Human-modified surface horizon.",
      },
    ])
  );
  const skbOnly = buildGlossaryIndex({
    featurelistPath,
    dstDataPath: missingDst,
  });
  assert.equal(skbOnly.totalTerms, 1);
  assert.deepEqual(skbOnly.groups, ["Surface"]);
  assert.deepEqual(skbOnly.terms[0].sources, ["SKB-KST-2014"]);

  const dstDataPath = path.join(tmpDir, "dst-data.json");
  fs.writeFileSync(
    dstDataPath,
    JSON.stringify({
      glossary: {
        soil_surface: {
          id: "soil_surface",
          term: "Soil Surface",
          definition: "Upper limit of soil.",
        },
      },
    })
  );
  const dstOnly = buildGlossaryIndex({
    featurelistPath: missingFeaturelist,
    dstDataPath,
  });
  assert.equal(dstOnly.totalTerms, 1);
  assert.deepEqual(dstOnly.groups, ["Glossary"]);
  assert.deepEqual(dstOnly.terms[0], {
    id: "soil-surface",
    term: "Soil Surface",
    group: "Glossary",
    chapter: null,
    page: null,
    definition: "Upper limit of soil.",
    sources: ["DST"],
  });
});
