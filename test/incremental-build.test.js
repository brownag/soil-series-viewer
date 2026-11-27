import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildSite, parseCliArgs } from "../src/cli/build.js";
import {
  CACHE_SCHEMA_VERSION,
  computeSeriesHash,
  loadBuildCache,
  saveBuildCache,
  shouldRebuildSeries,
} from "../src/cli/incremental-cache.js";

test("computeSeriesHash is deterministic and changes on record or templateVersion change", () => {
  const recA = { key: "AMADOR", name: "Amador", sc: { status: "Established" }, skb: null, horizons: [] };
  const recB = { key: "AMADOR", name: "Amador", sc: { status: "Inactive" }, skb: null, horizons: [] };

  const h1 = computeSeriesHash(recA, "v1");
  const h2 = computeSeriesHash(recA, "v1");
  const h3 = computeSeriesHash(recB, "v1");
  const h4 = computeSeriesHash(recA, "v2");

  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.notEqual(h1, h4);
});

test("shouldRebuildSeries checks both hash match and output file existence", async () => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "osd-cache-unit-"));
  try {
    const outHtml = path.join(tmpDir, "AMADOR.html");
    const cache = { schemaVersion: CACHE_SCHEMA_VERSION, templateVersion: "v1", hashes: { AMADOR: "abc123" } };

    // Hash matches, but file missing -> rebuild
    assert.equal(shouldRebuildSeries("AMADOR", "abc123", cache, outHtml), true);

    // File exists and hash matches -> skip
    await fsp.writeFile(outHtml, "<html></html>", "utf8");
    assert.equal(shouldRebuildSeries("AMADOR", "abc123", cache, outHtml), false);

    // File exists but hash changed -> rebuild
    assert.equal(shouldRebuildSeries("AMADOR", "def456", cache, outHtml), true);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("loadBuildCache and saveBuildCache round-trip cleanly", async () => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "osd-cache-io-"));
  try {
    const cachePath = path.join(tmpDir, ".build-cache.json");
    assert.deepEqual(loadBuildCache(cachePath).hashes, {});

    await saveBuildCache(cachePath, { templateVersion: "v1", hashes: { AMADOR: "h1" } });
    const loaded = loadBuildCache(cachePath);
    assert.equal(loaded.schemaVersion, CACHE_SCHEMA_VERSION);
    assert.equal(loaded.hashes.AMADOR, "h1");
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("parseCliArgs parses --incremental and --cache-file flags", () => {
  const defaults = parseCliArgs([]);
  assert.equal(defaults.incremental, false);
  assert.equal(defaults.cacheFile, null);

  const parsed = parseCliArgs(["--incremental", "--cache-file", "/tmp/cache.json"]);
  assert.equal(parsed.incremental, true);
  assert.equal(parsed.cacheFile, "/tmp/cache.json");
});

test("buildSite --incremental skips unchanged series on second pass and rebuilds on missing HTML or templateVersion bump", async () => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "osd-inc-e2e-"));
  try {
    // Pass 1: cold cache -> builds both series
    const pass1 = await buildSite({
      seriesFilter: ["AMADOR", "MT._AIRY"],
      outDir: tmpDir,
      incremental: true,
    });
    assert.equal(pass1.rebuiltCount, 2);
    assert.equal(pass1.skippedCount, 0);
    assert.equal(fs.existsSync(path.join(tmpDir, ".build-cache.json")), true);

    // Pass 2: warm cache -> skips both series
    const pass2 = await buildSite({
      seriesFilter: ["AMADOR", "MT._AIRY"],
      outDir: tmpDir,
      incremental: true,
    });
    assert.equal(pass2.rebuiltCount, 0);
    assert.equal(pass2.skippedCount, 2);

    // Pass 3: delete one HTML file -> rebuilds only that one
    await fsp.unlink(path.join(tmpDir, "OSD_Docs", "A", "AMADOR.html"));
    const pass3 = await buildSite({
      seriesFilter: ["AMADOR", "MT._AIRY"],
      outDir: tmpDir,
      incremental: true,
    });
    assert.equal(pass3.rebuiltCount, 1);
    assert.equal(pass3.skippedCount, 1);

    // Pass 4: bump templateVersion -> rebuilds both
    const pass4 = await buildSite({
      seriesFilter: ["AMADOR", "MT._AIRY"],
      outDir: tmpDir,
      incremental: true,
      templateVersion: "v2",
    });
    assert.equal(pass4.rebuiltCount, 2);
    assert.equal(pass4.skippedCount, 0);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});
