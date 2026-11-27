import test from "node:test";
import assert from "node:assert/strict";

import { munsellToHex } from "../src/lib/soil-profiles.js";
import { loadCorpus } from "../src/loader/index.js";
import { buildSearchIndex } from "../src/index/search-index.js";
import { buildColorStripShards } from "../src/index/color-strips.js";

test("buildSearchIndex: produces compact rows and sorted facets for AMADOR, MT._AIRY, and KANA@A", async () => {
  const { records } = await loadCorpus({
    seriesFilter: ["AMADOR", "MT._AIRY", "KANA@A"],
  });
  assert.equal(records.length, 3);

  const index = buildSearchIndex(records);

  assert.equal(index.version, 1);
  assert.equal(index.total, 3);
  assert.equal(index.items.length, 3);

  const byKey = new Map(index.items.map((item) => [item.k, item]));

  assert.deepEqual(byKey.get("AMADOR"), {
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
    mo: "davis, ca",
    bm: false,
    hasSkb: true,
  });

  assert.deepEqual(byKey.get("MT._AIRY"), {
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
    ce: null,
    rx: null,
    tc: "mesic",
    st: "MD",
    mo: "morgantown, wv",
    bm: false,
    hasSkb: true,
  });

  assert.deepEqual(byKey.get("KANA@A"), {
    k: "KANA@A",
    n: "KANA`A",
    l: "K",
    s: "Established",
    o: "Entisols",
    so: "Orthents",
    gg: "Ustorthents",
    sg: "Vitrandic Ustorthents",
    ps: "cindery",
    mn: "glassy",
    ce: null,
    rx: null,
    tc: "frigid",
    st: "AZ",
    mo: "davis, ca",
    bm: false,
    hasSkb: true,
  });

  assert.deepEqual(index.facets, {
    status: ["Established"],
    order: ["Entisols", "Inceptisols"],
    suborder: ["Orthents", "Udepts", "Xerepts"],
    grtgroup: ["Dystrudepts", "Haploxerepts", "Ustorthents"],
    subgrp: ["Typic Dystrudepts", "Typic Haploxerepts", "Vitrandic Ustorthents"],
    partsize: ["cindery", "loamy", "loamy-skeletal"],
    minalogy: ["glassy", "micaceous", "mixed"],
    ceactcl: ["superactive"],
    reaction: [],
    tempcl: ["frigid", "mesic", "thermic"],
    state: ["AZ", "CA", "MD"],
    mlraoffice: ["davis, ca", "morgantown, wv"],
  });
});

test("buildColorStripShards: groups AMADOR, MT._AIRY, KANA@A into letter shards with accurate Munsell hex", async () => {
  const { records } = await loadCorpus({
    seriesFilter: ["AMADOR", "MT._AIRY", "KANA@A"],
  });

  const shards = buildColorStripShards(records);

  assert.deepEqual(Object.keys(shards).sort(), ["A", "K", "M"]);

  const amadorStrip = shards.A.AMADOR;
  assert.ok(Array.isArray(amadorStrip) && amadorStrip.length === 4);
  assert.deepEqual(
    amadorStrip.map((h) => h.n),
    ["A", "Bw1", "Bw2", "Cr"]
  );
  // AMADOR A horizon is 10YR 4/2 moist -> matches SoilProfiles.js munsellToHex("10YR", 4, 2) (not old collapsed #6e5f4d)
  const expectedAHex = munsellToHex("10YR", 4, 2);
  assert.ok(expectedAHex);
  assert.equal(amadorStrip[0].hex, expectedAHex);
  assert.notEqual(amadorStrip[0].hex, "#6e5f4d");
  assert.equal(amadorStrip[1].hex, munsellToHex("10YR", 5, 3));
  assert.equal(amadorStrip[3].hex, munsellToHex("2.5Y", 7, 4));
  assert.ok(amadorStrip[0].t < amadorStrip[0].b);

  for (const [key, strip] of [
    ["MT._AIRY", shards.M["MT._AIRY"]],
    ["KANA@A", shards.K["KANA@A"]],
  ]) {
    assert.ok(Array.isArray(strip) && strip.length > 0, `expected non-empty strip for ${key}`);
    for (const h of strip) {
      assert.equal(typeof h.t, "number");
      assert.equal(typeof h.b, "number");
      assert.ok(h.b > h.t);
      assert.match(h.hex, /^#[0-9a-f]{6}$/i);
      assert.equal(typeof h.n, "string");
    }
  }
});

test("buildSearchIndex: handles benchmark flags, non-A-Z letter fallback, and validation", () => {
  const index = buildSearchIndex([
    {
      key: "123_SERIES",
      name: "123 SERIES",
      letter: "1",
      status: "Tentative",
      sc: {
        soilseriesstatus: "Tentative",
        benchmarksoilflag: "TRUE",
        taxorder: "Mollisols",
        taxreaction: "nonacid",
      },
      hasSkb: false,
    },
    {
      key: "BENCH_BOOL",
      name: "BENCH BOOL",
      letter: "b",
      status: "Established",
      sc: {
        benchmarksoilflag: true,
        taxorder: "Alfisols",
      },
      hasSkb: true,
    },
  ]);

  assert.equal(index.total, 2);
  assert.equal(index.items[0].l, "_");
  assert.equal(index.items[0].bm, true);
  assert.equal(index.items[0].hasSkb, false);
  assert.equal(index.items[1].l, "B");
  assert.equal(index.items[1].bm, true);
  assert.equal(index.items[1].hasSkb, true);
  assert.deepEqual(index.facets.order, ["Alfisols", "Mollisols"]);
  assert.deepEqual(index.facets.reaction, ["nonacid"]);

  assert.throws(() => buildSearchIndex(null), TypeError);
});

test("buildColorStripShards: applies SKB-9 color fallback, SKB-10 depth omission, and _ shard fallback", () => {
  const expected10YR42 = munsellToHex("10YR", 4, 2);
  const dryHex = munsellToHex("10YR", 7, 2);
  assert.ok(expected10YR42 && dryHex);

  const shards = buildColorStripShards([
    {
      key: "9SYNTH",
      name: "9SYNTH",
      letter: "9",
      horizons: [
        { name: "O", top: null, bottom: 5, moist_hue: "10YR", moist_value: 3, moist_chroma: 2 },
        { name: "A", top: 0, bottom: 15, moist_hue: "10YR", moist_value: 4, moist_chroma: 2 },
        { name: "Bw", top: 15, bottom: 40, moist_hue: null, moist_value: null, moist_chroma: null, dry_hue: "10YR", dry_value: 7, dry_chroma: 2 },
        { name: "C1", top: 40, bottom: 70, moist_hue: "10YR", moist_value: null, moist_chroma: null },
        { name: "Bad", top: 70, bottom: 70, moist_hue: "10YR", moist_value: 5, moist_chroma: 2 },
      ],
    },
    {
      key: "SC_ONLY",
      name: "SC ONLY",
      letter: "S",
      horizons: [],
    },
  ]);

  assert.deepEqual(Object.keys(shards), ["_"]);
  assert.deepEqual(shards._["9SYNTH"], [
    { t: 0, b: 15, hex: expected10YR42, n: "A" },
    { t: 15, b: 40, hex: dryHex, n: "Bw" },
    { t: 40, b: 70, hex: "#cccccc", n: "C1" },
  ]);
  assert.equal(shards.S, undefined);

  assert.throws(() => buildColorStripShards("not-an-array"), TypeError);
});
