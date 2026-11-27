import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  FACET_KEY_MAP,
  matchName,
  filterSeries,
  computeFacetCounts,
} from "../src/client/search-engine.js";

const SAMPLE_ITEMS = [
  {
    k: "AMADOR",
    n: "AMADOR",
    l: "A",
    s: "Established",
    o: "Inceptisols",
    so: "Xerepts",
    gg: "Haploxerepts",
    sg: "Typic Haploxerepts",
    ps: "loamy",
    mn: "mixed",
    ce: "superactive",
    rx: null,
    tc: "thermic",
    st: "CA",
    mo: "Davis, California",
    bm: true,
    hasSkb: true,
  },
  {
    k: "AMADORS",
    n: "AMADORS",
    l: "A",
    s: "Tentative",
    o: "Inceptisols",
    so: "Xerepts",
    gg: "Haploxerepts",
    sg: "Typic Haploxerepts",
    ps: "loamy",
    mn: "mixed",
    ce: "active",
    rx: "acid",
    tc: "thermic",
    st: "CA",
    mo: "Davis, California",
    bm: false,
    hasSkb: true,
  },
  {
    k: "SAN_AMADOR",
    n: "SAN AMADOR",
    l: "S",
    s: "Established",
    o: "Mollisols",
    so: "Xerolls",
    gg: "Haploxerolls",
    sg: "Typic Haploxerolls",
    ps: "fine-loamy",
    mn: "mixed",
    ce: "active",
    rx: "nonacid",
    tc: "thermic",
    st: "CA",
    mo: "Davis, California",
    bm: false,
    hasSkb: true,
  },
  {
    k: "MT._AIRY",
    n: "MT. AIRY",
    l: "M",
    s: "Established",
    o: "Inceptisols",
    so: "Udepts",
    gg: "Dystrudepts",
    sg: "Typic Dystrudepts",
    ps: "loamy-skeletal",
    mn: "micaceous",
    ce: "active",
    rx: "acid",
    tc: "mesic",
    st: "MD",
    mo: "Raleigh, North Carolina",
    bm: true,
    hasSkb: true,
  },
  {
    k: "KANA@A",
    n: "KANA`A",
    l: "K",
    s: "Inactive",
    o: "Andisols",
    so: "Ustands",
    gg: "Haplustands",
    sg: "Typic Haplustands",
    ps: "medial",
    mn: "ferrihydritic",
    ce: null,
    rx: null,
    tc: "isothermic",
    st: "HI",
    mo: "Honolulu, Hawaii",
    bm: false,
    hasSkb: true,
  },
  {
    k: "ALAMEDA",
    n: "ALAMEDA",
    l: "A",
    s: "Established",
    o: "Mollisols",
    so: "Xerolls",
    gg: "Haploxerolls",
    sg: "Calcic Haploxerolls",
    ps: "fine",
    mn: "smectitic",
    ce: "superactive",
    rx: "calcareous",
    tc: "thermic",
    st: "CA",
    mo: "Davis, California",
    bm: false,
    hasSkb: false,
  },
];

test("search-engine: module has zero Node-only imports", () => {
  const src = fs.readFileSync(
    path.resolve("src/client/search-engine.js"),
    "utf8"
  );
  assert.equal(/\bfrom\s+["']node:/.test(src), false);
  assert.equal(/\bimport\s*\(\s*["']node:/.test(src), false);
});

test("matchName: exact, prefix, substring, and fuzzy subsequence scoring order", () => {
  const exact = matchName("AMADOR", "amador");
  const prefix = matchName("AMADORS", "amador");
  const prefixShort = matchName("AMADOR", "am");
  const substring = matchName("SAN AMADOR", "amador");
  const fuzzy = matchName("AMADOR", "amdr");
  const noMatch = matchName("ALAMEDA", "amdr");

  assert.ok(exact > prefix);
  assert.ok(prefix > substring);
  assert.ok(substring > fuzzy);
  assert.ok(fuzzy > 0);
  assert.equal(noMatch, 0);
  assert.ok(prefixShort > 0);
  assert.equal(matchName("", "amador"), 0);
  assert.ok(matchName("AMADOR", "") > 0);
});

test("matchName: wildcard * and ? matching (case-insensitive & anchored)", () => {
  assert.ok(matchName("AMADOR", "AM*") > 0);
  assert.ok(matchName("amador", "AM*") > 0);
  assert.ok(matchName("AMADORS", "AM*") > 0);
  assert.equal(matchName("SAN AMADOR", "AM*"), 0);

  assert.ok(matchName("AMADOR", "A?ADOR") > 0);
  assert.ok(matchName("AMADOR", "a?ador") > 0);
  assert.equal(matchName("AMADORS", "A?ADOR"), 0);
  assert.equal(matchName("ADOR", "A?ADOR"), 0);

  assert.ok(matchName("MT. AIRY", "MT.*") > 0);
  assert.ok(matchName("SAN AMADOR", "*AMADOR") > 0);
  assert.ok(matchName("AMADOR", "AM*") > matchName("SAN AMADOR", "*AMADOR"));
});

test("filterSeries: ranks by score and breaks ties alphabetically on item.n", () => {
  const byQuery = filterSeries(SAMPLE_ITEMS, { query: "amador" });
  assert.deepEqual(
    byQuery.map((item) => item.k),
    ["AMADOR", "AMADORS", "SAN_AMADOR"]
  );

  const wildcardQuery = filterSeries(SAMPLE_ITEMS, { query: "A*" });
  assert.deepEqual(
    wildcardQuery.map((item) => item.k),
    ["ALAMEDA", "AMADOR", "AMADORS"]
  );

  // Empty query returns all items sorted alphabetically by item.n
  const allAlpha = filterSeries(SAMPLE_ITEMS);
  assert.deepEqual(
    allAlpha.map((item) => item.n),
    ["ALAMEDA", "AMADOR", "AMADORS", "KANA`A", "MT. AIRY", "SAN AMADOR"]
  );

  // Exact tie-break check when scores match
  const tied = [
    { k: "B", n: "BETA" },
    { k: "A", n: "ALPHA" },
  ];
  assert.deepEqual(
    filterSeries(tied, { query: "a" }).map((item) => item.n),
    ["ALPHA", "BETA"]
  );
});

test("filterSeries: multi-facet filtering across SC facets and benchmark boolean", () => {
  assert.equal(Object.keys(FACET_KEY_MAP).length, 13);

  // Single and multi-facet filtering
  const caInceptisols = filterSeries(SAMPLE_ITEMS, {
    facets: {
      state: "CA",
      order: "Inceptisols",
      status: "Established",
    },
  });
  assert.deepEqual(
    caInceptisols.map((item) => item.k),
    ["AMADOR"]
  );

  // All 13 facet keys supported
  const fullFacetMatch = filterSeries(SAMPLE_ITEMS, {
    facets: {
      status: "Established",
      order: "Inceptisols",
      suborder: "Udepts",
      grtgroup: "Dystrudepts",
      subgrp: "Typic Dystrudepts",
      partsize: "loamy-skeletal",
      minalogy: "micaceous",
      ceactcl: "active",
      reaction: "acid",
      tempcl: "mesic",
      state: "MD",
      mlraoffice: "Raleigh, North Carolina",
      benchmark: true,
    },
  });
  assert.deepEqual(
    fullFacetMatch.map((item) => item.k),
    ["MT._AIRY"]
  );

  // Benchmark true filters to benchmark-only; false/omitted leaves all items unfiltered
  const benchmarkOnly = filterSeries(SAMPLE_ITEMS, {
    facets: { benchmark: true },
  });
  assert.deepEqual(
    benchmarkOnly.map((item) => item.k),
    ["AMADOR", "MT._AIRY"]
  );

  const benchmarkUnchecked = filterSeries(SAMPLE_ITEMS, {
    facets: { benchmark: false },
  });
  assert.equal(benchmarkUnchecked.length, SAMPLE_ITEMS.length);

  // Combined query + facets
  const fuzzyWithFacet = filterSeries(SAMPLE_ITEMS, {
    query: "amdr",
    facets: { status: "Established" },
  });
  assert.deepEqual(
    fuzzyWithFacet.map((item) => item.k),
    ["AMADOR", "SAN_AMADOR"]
  );
});

test("computeFacetCounts: returns per-facet value counts for filtered items", () => {
  const caItems = filterSeries(SAMPLE_ITEMS, { facets: { state: "CA" } });
  const counts = computeFacetCounts(caItems);

  assert.deepEqual(counts.status, {
    Established: 3,
    Tentative: 1,
  });
  assert.deepEqual(counts.order, {
    Inceptisols: 2,
    Mollisols: 2,
  });
  assert.deepEqual(counts.state, { CA: 4 });
  assert.deepEqual(counts.reaction, {
    acid: 1,
    nonacid: 1,
    calcareous: 1,
  });
  assert.deepEqual(counts.benchmark, {
    true: 1,
    false: 3,
  });

  // Empty input produces empty count buckets for all 13 facets
  const emptyCounts = computeFacetCounts([]);
  assert.equal(Object.keys(emptyCounts).length, 13);
  assert.deepEqual(emptyCounts.status, {});
  assert.deepEqual(emptyCounts.benchmark, {});
});
