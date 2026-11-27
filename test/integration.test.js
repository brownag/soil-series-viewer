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
import { buildSite } from "../src/cli/build.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

test("integration: CLI builds AMADOR, MT._AIRY, and KANA@A with SVG sketches and assets", async () => {
  const tmpOut = await fsp.mkdtemp(path.join(os.tmpdir(), "ssv-int-test-"));
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

    const cssPath = path.join(tmpOut, "usdastyle.css");
    assert.ok(fs.existsSync(cssPath), "usdastyle.css should exist");
    const cssStat = await fsp.stat(cssPath);
    assert.ok(cssStat.size > 0, "usdastyle.css should be non-empty");

    const targets = [
      ["A", "AMADOR"],
      ["M", "MT._AIRY"],
      ["K", "KANA@A"],
    ];

    for (const [letter, key] of targets) {
      const dir = path.join(tmpOut, "OSD_Docs", letter);
      const htmlPath = path.join(dir, `${key}.html`);
      const txtPath = path.join(dir, `${key}.txt`);
      const jsonPath = path.join(dir, `${key}.json`);

      assert.ok(fs.existsSync(htmlPath), `missing ${htmlPath}`);
      assert.ok(fs.existsSync(txtPath), `missing ${txtPath}`);
      assert.ok(fs.existsSync(jsonPath), `missing ${jsonPath}`);

      const [html, txtStat, jsonStat] = await Promise.all([
        fsp.readFile(htmlPath, "utf8"),
        fsp.stat(txtPath),
        fsp.stat(jsonPath),
      ]);

      assert.ok(txtStat.size > 0, `${txtPath} should be non-empty`);
      assert.ok(jsonStat.size > 0, `${jsonPath} should be non-empty`);
      assert.ok(html.includes("<svg"), `${htmlPath} should contain <svg`);
      assert.ok(
        html.includes('<div class="osd-pedon-sketch"><svg'),
        `${htmlPath} should embed SVG inside .osd-pedon-sketch`
      );
      assert.ok(html.includes(`href="${key}.txt"`));
      assert.ok(html.includes(`href="${key}.json"`));

      if (key === "AMADOR") {
        const expected10YR42 = munsellToHex("10YR", 4, 2);
        assert.ok(expected10YR42, "munsellToHex('10YR', 4, 2) should return a hex color");
        assert.notEqual(expected10YR42, "#6e5f4d");
        assert.ok(
          html.includes(`fill="${expected10YR42}"`),
          `AMADOR.html should contain accurate 10YR 4/2 fill ${expected10YR42}`
        );
        assert.ok(
          !html.includes("#6e5f4d"),
          "AMADOR.html must not contain old 5YR-collapsed fill #6e5f4d"
        );
      }
    }
  } finally {
    await fsp.rm(tmpOut, { recursive: true, force: true });
  }
});

test("integration: buildSite respects renderSketch: null and custom renderSketch overrides", async () => {
  const tmpOut = await fsp.mkdtemp(path.join(os.tmpdir(), "ssv-override-test-"));
  try {
    const nullOut = path.join(tmpOut, "null-sketch");
    const nullSummary = await buildSite({
      seriesFilter: ["AMADOR"],
      outDir: nullOut,
      renderSketch: null,
    });
    assert.equal(nullSummary.builtCount, 1);

    const nullHtml = await fsp.readFile(
      path.join(nullOut, "OSD_Docs/A/AMADOR.html"),
      "utf8"
    );
    assert.ok(!nullHtml.includes("<svg"), "renderSketch: null should omit <svg");
    assert.ok(
      !nullHtml.includes("osd-pedon-sketch"),
      "renderSketch: null should omit .osd-pedon-sketch"
    );

    const customOut = path.join(tmpOut, "custom-sketch");
    const customSummary = await buildSite({
      seriesFilter: ["AMADOR"],
      outDir: customOut,
      renderSketch: (record) =>
        `<svg data-custom-series="${record.key}" width="10" height="10"></svg>`,
    });
    assert.equal(customSummary.builtCount, 1);

    const customHtml = await fsp.readFile(
      path.join(customOut, "OSD_Docs/A/AMADOR.html"),
      "utf8"
    );
    assert.ok(
      customHtml.includes(
        '<div class="osd-pedon-sketch"><svg data-custom-series="AMADOR" width="10" height="10"></svg></div>'
      ),
      "custom renderSketch output should be embedded in .osd-pedon-sketch"
    );
  } finally {
    await fsp.rm(tmpOut, { recursive: true, force: true });
  }
});
