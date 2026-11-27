import test from "node:test";
import assert from "node:assert/strict";

import { loadCorpus } from "../src/loader/index.js";
import {
  slugifyTaxon,
  buildTaxonomyTree,
  buildTaxonBreadcrumb,
} from "../src/index/taxonomy-tree.js";

test("slugifyTaxon: converts strings to kebab-case and handles edge cases", () => {
  assert.equal(slugifyTaxon("Inceptisols"), "inceptisols");
  assert.equal(slugifyTaxon("  Typic Haploxerepts  "), "typic-haploxerepts");
  assert.equal(
    slugifyTaxon("LOAMY, MIXED, SUPERACTIVE, THERMIC, SHALLOW TYPIC HAPLOXEREPTS"),
    "loamy-mixed-superactive-thermic-shallow-typic-haploxerepts"
  );
  assert.equal(slugifyTaxon("---Fine / Loamy-Skeletal (12)!---"), "fine-loamy-skeletal-12");
  assert.equal(slugifyTaxon(""), "");
  assert.equal(slugifyTaxon("   ---   "), "");
  assert.equal(slugifyTaxon(null), "");
  assert.equal(slugifyTaxon(undefined), "");
  assert.equal(slugifyTaxon(42), "");
});

test("buildTaxonomyTree: groups, counts, sorts case-insensitively, attaches KST codes, and handles missing ranks/unclassified", () => {
  const kstMap = new Map([
    ["inceptisols", "F"],
    ["alfisols", "E"],
    ["xeralfs", "EE"],
    ["haploxeralfs", "EED"],
    ["typic haploxeralfs", "EEDF"],
  ]);

  const records = [
    {
      key: "Z_SERIES",
      name: "z_series",
      letter: "Z",
      status: "Established",
      sc: {
        taxorder: "Inceptisols",
        taxsuborder: "Xerepts",
        taxgrtgroup: "Haploxerepts",
        taxsubgrp: "Typic Haploxerepts",
        taxclname: "Loamy, mixed, thermic Typic Haploxerepts",
      },
    },
    {
      key: "ALPHA",
      name: "Alpha",
      letter: "A",
      status: "Tentative",
      sc: {
        taxorder: "Inceptisols",
        taxsuborder: "Xerepts",
        taxgrtgroup: "Haploxerepts",
        taxsubgrp: "Typic Haploxerepts",
        taxclname: "Loamy, mixed, thermic Typic Haploxerepts",
      },
    },
    {
      key: "BETA",
      name: "BETA",
      letter: "B",
      status: "Established",
      sc: {
        taxorder: "Alfisols",
        taxsuborder: "xeralfs",
        taxgrtgroup: "Haploxeralfs",
        taxsubgrp: "Typic Haploxeralfs",
        taxclname: "Fine, smectitic, mesic Typic Haploxeralfs",
      },
    },
    {
      key: "NO_FAMILY",
      name: "No Family",
      letter: "N",
      status: "Tentative",
      sc: {
        taxorder: "Alfisols",
        taxsuborder: "xeralfs",
        taxgrtgroup: "Haploxeralfs",
        taxsubgrp: "Typic Haploxeralfs",
        taxclname: null,
      },
    },
    {
      key: "ORDER_ONLY",
      name: "Order Only",
      letter: "O",
      status: "Established",
      sc: {
        taxorder: "Entisols",
        taxsuborder: "",
        taxgrtgroup: "Orthents", // ignored because suborder is missing
      },
    },
    {
      key: "SKB_ONLY",
      name: "SKB ONLY",
      letter: "S",
      status: "Unclassified",
      sc: null,
    },
    {
      key: "EMPTY_ORDER",
      name: "EMPTY ORDER",
      letter: "E",
      status: "Tentative",
      sc: {
        taxorder: "   ",
      },
    },
  ];

  const tree = buildTaxonomyTree(records, { kstCodesByName: kstMap });

  assert.equal(tree.totalSeries, 7);
  assert.equal(tree.classifiedSeries, 5);
  assert.deepEqual(
    tree.orders.map((o) => o.name),
    ["Alfisols", "Entisols", "Inceptisols"]
  );

  // Alfisols: 2 series under Typic Haploxeralfs (1 with family, 1 missing family)
  const alfisols = tree.orders[0];
  assert.equal(alfisols.rank, "order");
  assert.equal(alfisols.slug, "alfisols");
  assert.equal(alfisols.code, "E");
  assert.equal(alfisols.count, 2);
  assert.equal(alfisols.series, undefined);

  const xeralfs = alfisols.children[0];
  assert.equal(xeralfs.code, "EE");
  assert.equal(xeralfs.count, 2);

  const haploxeralfs = xeralfs.children[0];
  assert.equal(haploxeralfs.code, "EED");
  assert.equal(haploxeralfs.count, 2);

  const typicHaploxeralfs = haploxeralfs.children[0];
  assert.equal(typicHaploxeralfs.code, "EEDF");
  assert.equal(typicHaploxeralfs.count, 2);
  assert.deepEqual(typicHaploxeralfs.series, [
    { k: "NO_FAMILY", n: "No Family", l: "N", s: "Tentative" },
  ]);
  assert.equal(typicHaploxeralfs.children.length, 1);
  assert.equal(typicHaploxeralfs.children[0].rank, "family");
  assert.equal(typicHaploxeralfs.children[0].code, null);
  assert.equal(typicHaploxeralfs.children[0].count, 1);
  assert.deepEqual(typicHaploxeralfs.children[0].series, [
    { k: "BETA", n: "BETA", l: "B", s: "Established" },
  ]);

  // Entisols: stops at order rank when suborder is missing
  const entisols = tree.orders[1];
  assert.equal(entisols.rank, "order");
  assert.equal(entisols.code, null);
  assert.equal(entisols.count, 1);
  assert.equal(entisols.children, undefined);
  assert.deepEqual(entisols.series, [
    { k: "ORDER_ONLY", n: "Order Only", l: "O", s: "Established" },
  ]);

  // Inceptisols: two series in same family sorted case-insensitively by n
  const inceptisols = tree.orders[2];
  assert.equal(inceptisols.code, "F");
  assert.equal(inceptisols.count, 2);
  const family =
    inceptisols.children[0].children[0].children[0].children[0];
  assert.equal(family.rank, "family");
  assert.equal(family.count, 2);
  assert.equal(family.children, undefined);
  assert.deepEqual(family.series, [
    { k: "ALPHA", n: "Alpha", l: "A", s: "Tentative" },
    { k: "Z_SERIES", n: "z_series", l: "Z", s: "Established" },
  ]);
});

test("buildTaxonomyTree: accepts plain object for kstCodesByName, sorts mixed-case children, and validates input", () => {
  const tree = buildTaxonomyTree(
    [
      {
        key: "S1",
        name: "S1",
        letter: "S",
        status: "Established",
        sc: { taxorder: "Mollisols", taxsuborder: "xerolls" },
      },
      {
        key: "S2",
        name: "S2",
        letter: "S",
        status: "Established",
        sc: { taxorder: "Mollisols", taxsuborder: "Albolls" },
      },
      {
        key: "S3",
        name: "S3",
        letter: "S",
        status: "Established",
        sc: { taxorder: "Mollisols", taxsuborder: "Udolls" },
      },
    ],
    {
      kstCodesByName: {
        mollisols: "I",
        albolls: "IA",
      },
    }
  );

  assert.equal(tree.orders[0].code, "I");
  assert.deepEqual(
    tree.orders[0].children.map((c) => c.name),
    ["Albolls", "Udolls", "xerolls"]
  );
  assert.equal(tree.orders[0].children[0].code, "IA");
  assert.equal(tree.orders[0].children[1].code, null);

  assert.throws(() => buildTaxonomyTree(null), TypeError);
  assert.throws(() => buildTaxonomyTree([null]), TypeError);
});

test("buildTaxonBreadcrumb: builds hashPath through subgroup, stops at missing rank, and handles missing SC", () => {
  const kstCodes = {
    alfisols: "E",
    xeralfs: "EE",
    haploxeralfs: "EED",
  };

  assert.deepEqual(
    buildTaxonBreadcrumb(
      {
        sc: {
          taxorder: "Alfisols",
          taxsuborder: "Xeralfs",
          taxgrtgroup: "Haploxeralfs",
          taxsubgrp: "Typic Haploxeralfs",
          taxclname: "Fine, mixed, thermic Typic Haploxeralfs",
        },
      },
      kstCodes
    ),
    [
      {
        rank: "order",
        name: "Alfisols",
        slug: "alfisols",
        hashPath: "alfisols",
        code: "E",
      },
      {
        rank: "suborder",
        name: "Xeralfs",
        slug: "xeralfs",
        hashPath: "alfisols/xeralfs",
        code: "EE",
      },
      {
        rank: "greatgroup",
        name: "Haploxeralfs",
        slug: "haploxeralfs",
        hashPath: "alfisols/xeralfs/haploxeralfs",
        code: "EED",
      },
      {
        rank: "subgroup",
        name: "Typic Haploxeralfs",
        slug: "typic-haploxeralfs",
        hashPath: "alfisols/xeralfs/haploxeralfs/typic-haploxeralfs",
        code: null,
      },
    ]
  );

  // Stops at first missing rank (taxgrtgroup missing)
  assert.deepEqual(
    buildTaxonBreadcrumb(
      {
        sc: {
          taxorder: "Alfisols",
          taxsuborder: "Xeralfs",
          taxgrtgroup: null,
          taxsubgrp: "Typic Haploxeralfs",
        },
      },
      new Map(Object.entries(kstCodes))
    ),
    [
      {
        rank: "order",
        name: "Alfisols",
        slug: "alfisols",
        hashPath: "alfisols",
        code: "E",
      },
      {
        rank: "suborder",
        name: "Xeralfs",
        slug: "xeralfs",
        hashPath: "alfisols/xeralfs",
        code: "EE",
      },
    ]
  );

  // Missing SC or missing taxorder
  assert.deepEqual(buildTaxonBreadcrumb(null), []);
  assert.deepEqual(buildTaxonBreadcrumb({}), []);
  assert.deepEqual(buildTaxonBreadcrumb({ sc: null }), []);
  assert.deepEqual(buildTaxonBreadcrumb({ sc: { taxorder: "" } }), []);
  assert.deepEqual(buildTaxonBreadcrumb({ sc: { taxsuborder: "Xerepts" } }), []);
});

test("buildTaxonomyTree and buildTaxonBreadcrumb: real corpus subset AMADOR and MT._AIRY", async () => {
  const { records } = await loadCorpus({
    seriesFilter: ["AMADOR", "MT._AIRY"],
  });
  assert.equal(records.length, 2);

  const kstCodes = new Map([
    ["inceptisols", "F"],
    ["udepts", "FD"],
    ["xerepts", "FE"],
  ]);

  const tree = buildTaxonomyTree(records, { kstCodesByName: kstCodes });
  assert.equal(tree.totalSeries, 2);
  assert.equal(tree.classifiedSeries, 2);
  assert.equal(tree.orders.length, 1);

  const inceptisols = tree.orders[0];
  assert.equal(inceptisols.name, "Inceptisols");
  assert.equal(inceptisols.slug, "inceptisols");
  assert.equal(inceptisols.rank, "order");
  assert.equal(inceptisols.code, "F");
  assert.equal(inceptisols.count, 2);
  assert.deepEqual(
    inceptisols.children.map((c) => c.name),
    ["Udepts", "Xerepts"]
  );

  const udepts = inceptisols.children[0];
  assert.equal(udepts.code, "FD");
  assert.equal(udepts.count, 1);
  const mtAiryFamily = udepts.children[0].children[0].children[0];
  assert.equal(mtAiryFamily.rank, "family");
  assert.equal(mtAiryFamily.name, "LOAMY-SKELETAL, MICACEOUS, MESIC TYPIC DYSTRUDEPTS");
  assert.deepEqual(mtAiryFamily.series, [
    { k: "MT._AIRY", n: "MT. AIRY", l: "M", s: "Established" },
  ]);

  const xerepts = inceptisols.children[1];
  assert.equal(xerepts.code, "FE");
  assert.equal(xerepts.count, 1);
  const amadorFamily = xerepts.children[0].children[0].children[0];
  assert.equal(amadorFamily.rank, "family");
  assert.equal(
    amadorFamily.name,
    "LOAMY, MIXED, SUPERACTIVE, THERMIC, SHALLOW TYPIC HAPLOXEREPTS"
  );
  assert.deepEqual(amadorFamily.series, [
    { k: "AMADOR", n: "AMADOR", l: "A", s: "Established" },
  ]);

  const amadorRecord = records.find((r) => r.key === "AMADOR");
  assert.deepEqual(buildTaxonBreadcrumb(amadorRecord, kstCodes), [
    {
      rank: "order",
      name: "Inceptisols",
      slug: "inceptisols",
      hashPath: "inceptisols",
      code: "F",
    },
    {
      rank: "suborder",
      name: "Xerepts",
      slug: "xerepts",
      hashPath: "inceptisols/xerepts",
      code: "FE",
    },
    {
      rank: "greatgroup",
      name: "Haploxerepts",
      slug: "haploxerepts",
      hashPath: "inceptisols/xerepts/haploxerepts",
      code: null,
    },
    {
      rank: "subgroup",
      name: "Typic Haploxerepts",
      slug: "typic-haploxerepts",
      hashPath: "inceptisols/xerepts/haploxerepts/typic-haploxerepts",
      code: null,
    },
  ]);

  const mtAiryRecord = records.find((r) => r.key === "MT._AIRY");
  assert.deepEqual(buildTaxonBreadcrumb(mtAiryRecord, kstCodes), [
    {
      rank: "order",
      name: "Inceptisols",
      slug: "inceptisols",
      hashPath: "inceptisols",
      code: "F",
    },
    {
      rank: "suborder",
      name: "Udepts",
      slug: "udepts",
      hashPath: "inceptisols/udepts",
      code: "FD",
    },
    {
      rank: "greatgroup",
      name: "Dystrudepts",
      slug: "dystrudepts",
      hashPath: "inceptisols/udepts/dystrudepts",
      code: null,
    },
    {
      rank: "subgroup",
      name: "Typic Dystrudepts",
      slug: "typic-dystrudepts",
      hashPath: "inceptisols/udepts/dystrudepts/typic-dystrudepts",
      code: null,
    },
  ]);
});
