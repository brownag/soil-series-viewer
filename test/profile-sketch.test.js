import test from "node:test";
import assert from "node:assert/strict";

import { munsellToHex } from "/home/andrew/workspace/SoilProfiles.js/dist/index.js";
import { loadCorpus } from "../src/loader/index.js";
import { renderProfileSketch } from "../src/render/profile-sketch.js";

test("renderProfileSketch: AMADOR renders valid SVG with accurate 10YR fills", async () => {
  const { records } = await loadCorpus({ seriesFilter: ["AMADOR"] });
  assert.equal(records.length, 1);

  const { svg, omittedHorizons } = renderProfileSketch(records[0]);

  assert.deepEqual(omittedHorizons, []);
  assert.equal(typeof svg, "string");
  assert.match(svg, /^<svg\b/);
  assert.match(svg, /<\/svg>$/);
  assert.match(svg, /width="140"/);
  assert.match(svg, /height="320"/);

  // AMADOR A horizon is 10YR 4/2 moist -> #6e5f4c (not the old 5YR-collapsed #6e5f4d)
  assert.ok(svg.includes('fill="#6e5f4c"'), "expected accurate 10YR 4/2 fill #6e5f4c");
  assert.ok(!svg.includes('fill="#6e5f4d"'), "must not use old collapsed 5YR fill #6e5f4d");

  // Bw1/Bw2 are 10YR 5/3 moist and Cr is 2.5Y 7/4 moist
  const bwColor = munsellToHex("10YR", 5, 3);
  const crColor = munsellToHex("2.5Y", 7, 4);
  assert.ok(bwColor && svg.includes(`fill="${bwColor}"`), `expected Bw fill ${bwColor}`);
  assert.ok(crColor && svg.includes(`fill="${crColor}"`), `expected Cr fill ${crColor}`);

  for (const label of ["A", "Bw1", "Bw2", "Cr"]) {
    assert.ok(svg.includes(`>${label}<`), `expected horizon label ${label}`);
  }
});

test("renderProfileSketch: SKB-9 fallback uses moist, then dry, then #cccccc", () => {
  const dryOnlyColor = munsellToHex("10YR", 7, 2);
  assert.ok(dryOnlyColor);

  const record = {
    key: "FALLBACK_TEST",
    name: "FALLBACK_TEST",
    horizons: [
      {
        name: "A",
        top: 0,
        bottom: 20,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
        dry_hue: "10YR",
        dry_value: 7,
        dry_chroma: 2,
      },
      {
        name: "Bw",
        top: 20,
        bottom: 45,
        moist_hue: null,
        moist_value: null,
        moist_chroma: null,
        dry_hue: "10YR",
        dry_value: 7,
        dry_chroma: 2,
      },
      {
        name: "C1",
        top: 45,
        bottom: 70,
        // Partial moist triplet (missing value/chroma) + no dry -> must fall back to #cccccc, not 10YR 0/0
        moist_hue: "10YR",
        moist_value: null,
        moist_chroma: null,
        dry_hue: null,
        dry_value: null,
        dry_chroma: null,
      },
      {
        name: "C2",
        top: 70,
        bottom: 100,
        moist_hue: null,
        moist_value: null,
        moist_chroma: null,
        dry_hue: null,
        dry_value: null,
        dry_chroma: null,
      },
    ],
  };

  const { svg, omittedHorizons } = renderProfileSketch(record);
  assert.deepEqual(omittedHorizons, []);
  assert.equal(typeof svg, "string");

  const fills = Array.from(svg.matchAll(/<rect\b[^>]*data-horizon-id="[^"]+"[^>]*>/g)).map(
    (m) => m[0].match(/\bfill="([^"]+)"/)?.[1]
  );

  assert.deepEqual(fills, ["#6e5f4c", dryOnlyColor, "#cccccc", "#cccccc"]);
});

test("renderProfileSketch: SKB-10 omits missing/invalid depths and returns null svg when none remain", () => {
  const missingTop = { name: "O", top: null, bottom: 5, moist_hue: "10YR", moist_value: 3, moist_chroma: 2 };
  const missingBottom = { name: "Bt", top: 20, bottom: null, moist_hue: "10YR", moist_value: 5, moist_chroma: 4 };
  const zeroThickness = { name: "C1", top: 30, bottom: 30, moist_hue: "10YR", moist_value: 6, moist_chroma: 2 };
  const inverted = { name: "C2", top: 50, bottom: 40, moist_hue: "10YR", moist_value: 6, moist_chroma: 2 };
  const valid = { name: "A", top: 5, bottom: 20, moist_hue: "10YR", moist_value: 4, moist_chroma: 2 };

  const partialRecord = {
    key: "FRYINGPAN_SYNTH",
    name: "FRYINGPAN_SYNTH",
    horizons: [missingTop, valid, missingBottom, zeroThickness, inverted],
  };

  const partialResult = renderProfileSketch(partialRecord);
  assert.equal(typeof partialResult.svg, "string");
  assert.match(partialResult.svg, /^<svg\b/);
  assert.equal(partialResult.omittedHorizons.length, 4);
  assert.deepEqual(partialResult.omittedHorizons, [
    missingTop,
    missingBottom,
    zeroThickness,
    inverted,
  ]);
  assert.ok(partialResult.svg.includes(">A<"));
  assert.ok(!partialResult.svg.includes(">Bt<"));

  const unplottableRecord = {
    key: "NO_PLOTTABLE",
    name: "NO_PLOTTABLE",
    horizons: [missingTop, missingBottom, zeroThickness, inverted],
  };
  const emptyResult = renderProfileSketch(unplottableRecord);
  assert.equal(emptyResult.svg, null);
  assert.equal(emptyResult.omittedHorizons.length, 4);

  const noHorizonsResult = renderProfileSketch({ key: "EMPTY", name: "EMPTY", horizons: [] });
  assert.equal(noHorizonsResult.svg, null);
  assert.deepEqual(noHorizonsResult.omittedHorizons, []);
});

test("renderProfileSketch: forwards width, height, and mode options to renderStaticSVG", () => {
  const record = {
    key: "CUSTOM_OPTS",
    name: "CUSTOM_OPTS",
    horizons: [
      {
        name: "A",
        top: 0,
        bottom: 25,
        moist_hue: "10YR",
        moist_value: 4,
        moist_chroma: 2,
      },
    ],
  };

  const { svg, omittedHorizons } = renderProfileSketch(record, {
    width: 45,
    height: 200,
    mode: "thumbnail",
  });

  assert.deepEqual(omittedHorizons, []);
  assert.match(svg, /width="45"/);
  assert.match(svg, /height="200"/);
  assert.ok(svg.includes('fill="#6e5f4c"'));
  // Thumbnail mode omits the depth axis label "Depth (cm)"
  assert.ok(!svg.includes("Depth (cm)"));
});
