import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  CLIENT_ASSET_FILES,
  buildSite,
  parseCliArgs,
} from "../src/cli/build.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

test("parseCliArgs parses --pagefind flag with false default and preserves other flags", () => {
  const defaults = parseCliArgs([]);
  assert.equal(defaults.pagefind, false);
  assert.equal(defaults.help, false);
  assert.equal(defaults.limit, null);
  assert.equal(defaults.seriesFilter, null);

  const withPagefind = parseCliArgs([
    "--series",
    "AMADOR,MT._AIRY",
    "--limit",
    "2",
    "--out",
    "out-dir",
    "--pagefind",
  ]);
  assert.equal(withPagefind.pagefind, true);
  assert.deepEqual(withPagefind.seriesFilter, ["AMADOR", "MT._AIRY"]);
  assert.equal(withPagefind.limit, 2);
  assert.equal(withPagefind.outDir, "out-dir");
});

test("CLI --help documents --pagefind flag", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.join(REPO_ROOT, "src/cli/build.js"), "--help"],
    { cwd: REPO_ROOT }
  );
  assert.match(stdout, /--pagefind/);
});

test("CLIENT_ASSET_FILES includes fulltext-search.js and profile-interactive.js in sorted order", () => {
  assert.ok(CLIENT_ASSET_FILES.includes("fulltext-search.js"));
  assert.ok(CLIENT_ASSET_FILES.includes("profile-interactive.js"));
  const sorted = [...CLIENT_ASSET_FILES].sort();
  assert.deepEqual(CLIENT_ASSET_FILES, sorted);
});

test("buildSite emits manifest.json, deterministic sw.js, client modules, and interactive/Pagefind series HTML", async (t) => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "ssv-build-cli-"));
  t.after(async () => {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  const outA = path.join(tmpRoot, "site-a");
  const outB = path.join(tmpRoot, "site-b");
  const outC = path.join(tmpRoot, "site-c");

  const summaryA = await buildSite({
    seriesFilter: ["AMADOR", "MT._AIRY"],
    outDir: outA,
  });
  const summaryB = await buildSite({
    seriesFilter: ["AMADOR", "MT._AIRY"],
    outDir: outB,
  });
  const summaryC = await buildSite({
    seriesFilter: ["AMADOR"],
    outDir: outC,
  });

  assert.equal(summaryA.builtCount, 2);
  assert.equal(summaryA.pagefindResult, null);
  assert.ok(summaryA.stripShards >= 2);
  assert.ok(summaryA.taxonomyOrders >= 1);
  assert.ok(summaryA.glossaryTerms >= 1);
  assert.equal(summaryA.qaSummary.totalRecords, 2);

  // manifest.json exists and is valid JSON
  const manifestPath = path.join(outA, "manifest.json");
  assert.ok(fs.existsSync(manifestPath), "manifest.json should exist");
  const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
  assert.equal(manifest.short_name, "Soil OSD");
  assert.equal(manifest.theme_color, "#1a472a");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);

  // sw.js exists, is syntactically valid JS, and has deterministic CACHE_VERSION
  const swPathA = path.join(outA, "sw.js");
  const swPathB = path.join(outB, "sw.js");
  const swPathC = path.join(outC, "sw.js");
  assert.ok(fs.existsSync(swPathA), "sw.js should exist");

  const [swA, swB, swC] = await Promise.all([
    fsp.readFile(swPathA, "utf8"),
    fsp.readFile(swPathB, "utf8"),
    fsp.readFile(swPathC, "utf8"),
  ]);
  assert.doesNotThrow(() => new Function(swA));

  const versionA = swA.match(/const CACHE_VERSION = "([^"]+)";/)?.[1];
  const versionB = swB.match(/const CACHE_VERSION = "([^"]+)";/)?.[1];
  const versionC = swC.match(/const CACHE_VERSION = "([^"]+)";/)?.[1];
  assert.ok(versionA && versionA.startsWith("v1-2-"), `unexpected CACHE_VERSION: ${versionA}`);
  assert.equal(versionA, versionB, "CACHE_VERSION should be deterministic for identical corpus");
  assert.notEqual(versionA, versionC, "CACHE_VERSION should change when corpus records change");

  // Client interactive & fulltext modules emitted under client/ and assets/
  for (const relPath of [
    "client/fulltext-search.js",
    "client/profile-interactive.js",
    "client/strip-svg.js",
    "assets/fulltext-search.js",
    "assets/profile-interactive.js",
  ]) {
    const fullPath = path.join(outA, relPath);
    assert.ok(fs.existsSync(fullPath), `expected ${relPath} to exist`);
    const stat = await fsp.stat(fullPath);
    assert.ok(stat.size > 0, `${relPath} should be non-empty`);
  }

  // Built series HTML contains data-pagefind-body and valid #osd-profile-data JSON
  const amadorHtml = await fsp.readFile(
    path.join(outA, "OSD_Docs", "A", "AMADOR.html"),
    "utf8"
  );
  assert.ok(amadorHtml.includes("data-pagefind-body"), "series HTML should include data-pagefind-body");
  assert.ok(
    amadorHtml.includes('data-pagefind-meta="series"'),
    "series HTML should include Pagefind series metadata"
  );
  const profileDataMatch = amadorHtml.match(
    /<script type="application\/json" id="osd-profile-data">([\s\S]*?)<\/script>/
  );
  assert.ok(profileDataMatch, "series HTML should embed #osd-profile-data");
  const profileData = JSON.parse(profileDataMatch[1]);
  assert.equal(profileData.key, "AMADOR");
  assert.ok(Array.isArray(profileData.horizons) && profileData.horizons.length > 0);
  assert.ok(amadorHtml.includes('src="../../client/profile-interactive.js"'));
  assert.ok(amadorHtml.includes('href="../../manifest.json"'));
  assert.ok(amadorHtml.includes("../../sw.js"));

  // Home page includes full-text search panel and PWA integration
  const indexHtml = await fsp.readFile(path.join(outA, "index.html"), "utf8");
  assert.ok(indexHtml.includes('id="fulltext-search-panel"'));
  assert.ok(indexHtml.includes('href="./manifest.json"'));
  assert.ok(indexHtml.includes("./sw.js"));
});

test("buildSite invokes pagefindRunner(outDir) when pagefind: true and returns pagefindResult", async (t) => {
  const tmpOut = await fsp.mkdtemp(path.join(os.tmpdir(), "ssv-build-pf-"));
  t.after(async () => {
    await fsp.rm(tmpOut, { recursive: true, force: true });
  });

  const calls = [];
  const summary = await buildSite({
    seriesFilter: ["AMADOR"],
    outDir: tmpOut,
    pagefind: true,
    pagefindRunner: async (targetOutDir) => {
      calls.push({
        outDir: targetOutDir,
        hasIndex: fs.existsSync(path.join(targetOutDir, "index.html")),
        hasSeries: fs.existsSync(path.join(targetOutDir, "OSD_Docs", "A", "AMADOR.html")),
      });
      return { ok: true, skipped: false, indexedPages: 1 };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].outDir, path.resolve(tmpOut));
  assert.equal(calls[0].hasIndex, true);
  assert.equal(calls[0].hasSeries, true);
  assert.deepEqual(summary.pagefindResult, {
    ok: true,
    skipped: false,
    indexedPages: 1,
  });

  // Missing-binary error in runner degrades gracefully via runPagefind
  const fallbackOut = path.join(tmpOut, "fallback");
  const fallbackSummary = await buildSite({
    seriesFilter: ["AMADOR"],
    outDir: fallbackOut,
    pagefind: true,
    pagefindRunner: async () => {
      const err = new Error("spawn npx ENOENT");
      err.code = "ENOENT";
      throw err;
    },
  });
  assert.equal(fallbackSummary.pagefindResult.ok, false);
  assert.equal(fallbackSummary.pagefindResult.skipped, true);
  assert.match(fallbackSummary.pagefindResult.reason, /ENOENT/);
});
