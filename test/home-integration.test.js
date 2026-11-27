import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { munsellToHex } from "../src/lib/soil-profiles.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

test("home integration: CLI emits index.html, home.css, client assets, search index, and strip shards", async () => {
  const tmpOut = await fsp.mkdtemp(path.join(os.tmpdir(), "ssv-home-int-"));
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        path.join(REPO_ROOT, "src/cli/build.js"),
        "--series",
        "AMADOR,MT._AIRY,KANA@A",
        "--out",
        tmpOut,
      ],
      { cwd: REPO_ROOT }
    );
    assert.match(stdout, /Built 3 series pages/);

    const indexHtmlPath = path.join(tmpOut, "index.html");
    const homeCssPath = path.join(tmpOut, "home.css");
    assert.ok(fs.existsSync(indexHtmlPath), "index.html should exist");
    assert.ok(fs.existsSync(homeCssPath), "home.css should exist");

    const [indexHtml, homeCssStat] = await Promise.all([
      fsp.readFile(indexHtmlPath, "utf8"),
      fsp.stat(homeCssPath),
    ]);
    assert.ok(homeCssStat.size > 0, "home.css should be non-empty");
    assert.match(indexHtml, /^<!doctype html>/i);
    assert.ok(indexHtml.includes('href="./usdastyle.css"'));
    assert.ok(indexHtml.includes('href="./home.css"'));
    assert.ok(indexHtml.includes('src="./assets/home-app.js"'));
    assert.ok(indexHtml.includes("Loading 3 series..."));

    for (const assetName of ["home-app.js", "search-engine.js", "strip-svg.js"]) {
      const assetPath = path.join(tmpOut, "assets", assetName);
      assert.ok(fs.existsSync(assetPath), `missing assets/${assetName}`);
      const stat = await fsp.stat(assetPath);
      assert.ok(stat.size > 0, `assets/${assetName} should be non-empty`);
    }

    const searchIndexPath = path.join(tmpOut, "data", "search-index.json");
    assert.ok(fs.existsSync(searchIndexPath), "data/search-index.json should exist");
    const searchIndex = JSON.parse(await fsp.readFile(searchIndexPath, "utf8"));
    assert.equal(searchIndex.version, 1);
    assert.equal(searchIndex.total, 3);
    assert.equal(searchIndex.items.length, 3);
    assert.deepEqual(
      searchIndex.items.map((item) => item.k).sort(),
      ["AMADOR", "KANA@A", "MT._AIRY"]
    );

    const shardAPath = path.join(tmpOut, "data", "strips", "A.json");
    assert.ok(fs.existsSync(shardAPath), "data/strips/A.json should exist");
    const shardA = JSON.parse(await fsp.readFile(shardAPath, "utf8"));
    assert.ok(Array.isArray(shardA.AMADOR) && shardA.AMADOR.length === 4);

    const expected10YR42 = munsellToHex("10YR", 4, 2);
    assert.ok(expected10YR42, "munsellToHex('10YR', 4, 2) should return a hex color");
    assert.notEqual(expected10YR42, "#6e5f4d");
    assert.equal(shardA.AMADOR[0].hex, expected10YR42);
    assert.notEqual(shardA.AMADOR[0].hex, "#6e5f4d");
  } finally {
    await fsp.rm(tmpOut, { recursive: true, force: true });
  }
});
