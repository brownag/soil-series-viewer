import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { loadCorpus } from "../src/loader/index.js";
import {
  NSSH_SECTIONS,
  escapeHtml,
  formatLocationLine,
  renderSeriesPage,
} from "../src/render/series-page.js";
import { parseCliArgs } from "../src/cli/build.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const AMADOR_REF_PATH = path.join(
  REPO_ROOT,
  "docs/research/reference/osd_AMADOR_20260308005129.html"
);

/**
 * Decode basic HTML entities and strip tags to compare normalized text lines.
 */
function stripHtml(fragment) {
  return fragment
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

test("renderSeriesPage: AMADOR matches reference OSD anatomy, headers, sections, and horizons", async () => {
  const refHtml = await fsp.readFile(AMADOR_REF_PATH, "utf8");
  const { records } = await loadCorpus({ seriesFilter: ["AMADOR"] });
  assert.equal(records.length, 1);

  const html = renderSeriesPage(records[0], {
    hasTxt: true,
    hasJson: true,
  });

  // Stylesheet link and .osd-* container classes
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/usdastyle\.css">/);
  for (const cls of [
    "osd-page",
    "osd-chrome",
    "osd-header",
    "osd-meta",
    "osd-location",
    "osd-downloads",
    "osd-narrative",
    "osd-title",
    "osd-section",
    "osd-section-label",
    "osd-pedon-layout",
    "osd-pedon-text",
    "osd-horizon",
    "osd-horizon-name",
    "osd-footer",
  ]) {
    assert.ok(html.includes(cls), `expected class ${cls}`);
  }
  assert.ok(
    !html.includes("osd-pedon-sketch"),
    "sketch slot should be omitted when sketchSvg is not provided"
  );

  // Download links for raw .txt and .json
  assert.match(html, /href="AMADOR\.txt"/);
  assert.match(html, /href="AMADOR\.json"/);

  // Title, header metadata, H1, and footer aligned with reference capture
  assert.match(
    html,
    /<title>Official Series Description - AMADOR Series<\/title>/
  );
  assert.ok(refHtml.includes("<TITLE>Official Series Description - AMADOR Series</TITLE>"));
  assert.equal(formatLocationLine("AMADOR", "CA"), "LOCATION AMADOR                 CA");
  assert.ok(html.includes("LOCATION AMADOR                 CA"));
  assert.ok(html.includes("Established Series"));
  assert.ok(html.includes("Rev. AJT/WBS/DJE/ET/AGB/TKK/JW"));
  assert.ok(html.includes("10/2018"));
  assert.match(html, /<h1 class="osd-title">AMADOR SERIES<\/h1>/);
  assert.ok(refHtml.includes("<H1>AMADOR SERIES</H1>"));

  // Check every bold section header in reference HTML appears in exact NSSH order
  const refLabels = Array.from(refHtml.matchAll(/<B>([A-Z][^<]+:)<\/B>/g)).map(
    (m) => m[1]
  );
  const renderedLabels = Array.from(
    html.matchAll(/<strong class="osd-section-label">([^<]+)<\/strong>/g)
  ).map((m) => m[1]);
  assert.deepEqual(renderedLabels, refLabels);

  // Check bold horizon designations match reference <B>    Hz</B>
  const refHorizons = Array.from(
    refHtml.matchAll(/<B>(\s+[A-Za-z0-9]+)<\/B>--/g)
  ).map((m) => m[1]);
  const renderedHorizons = Array.from(
    html.matchAll(/<span class="osd-horizon-name">([^<]+)<\/span>--/g)
  ).map((m) => m[1]);
  assert.deepEqual(renderedHorizons, refHorizons);
  assert.deepEqual(renderedHorizons, ["    A", "    Bw1", "    Bw2", "    Cr"]);

  // Compare key overview and section content text against reference
  assert.ok(
    stripHtml(html).includes(
      "The Amador series consists of shallow, well drained soils"
    )
  );
  assert.ok(
    stripHtml(html).includes(
      "Loamy, mixed, superactive, thermic, shallow Typic Haploxerepts"
    )
  );
  assert.ok(html.includes("National Cooperative Soil Survey"));
  assert.ok(html.includes("U.S.A."));
});

test("renderSeriesPage: escapes HTML entities and handles sketchSvg slot", () => {
  assert.equal(
    escapeHtml(`<script>"a" & 'b'</script>`),
    "&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;"
  );

  const xssRecord = {
    key: "XSS_TEST",
    name: 'XSS <"TEST">',
    letter: "X",
    status: "Tentative",
    hasSc: true,
    hasSkb: true,
    sc: { areasymbol: "CA" },
    skb: {
      SERIES: 'XSS <"TEST">',
      STATUS: "Tentative & <Draft>",
      BYREV: "Rev. <A&B>",
      REVDATE: "01/2026",
      STATES: "CA",
      OVERVIEW: "Overview with <script>alert(1)</script> & quotes ' \"",
      "TAXONOMIC CLASS": {
        section: "TAXONOMIC CLASS",
        content: "Fine <loamy> & mixed",
      },
      "TYPICAL PEDON": {
        section: "TYPICAL PEDON",
        content: "Pedon <intro>\nA--0 to 10 cm; <dark> soil.",
      },
    },
    horizons: [
      {
        name: "A<1>",
        narrative: "A<1>--0 to 10 cm; <dark> & rich.",
      },
    ],
  };

  const withoutSketch = renderSeriesPage(xssRecord, { sketchSvg: null });
  assert.ok(!withoutSketch.includes("<script>"));
  assert.ok(withoutSketch.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(withoutSketch.includes("XSS &lt;&quot;TEST&quot;&gt;"));
  assert.ok(withoutSketch.includes("    A&lt;1&gt;"));
  assert.ok(!withoutSketch.includes("osd-pedon-sketch"));

  const fakeSvg = '<svg viewBox="0 0 45 200" data-test="ok"><rect width="45" height="200"/></svg>';
  const withSketch = renderSeriesPage(xssRecord, { sketchSvg: fakeSvg });
  assert.match(
    withSketch,
    /<div class="osd-pedon-sketch"><svg viewBox="0 0 45 200" data-test="ok">/
  );
});

test("renderSeriesPage: handles missing sections, empty horizons, and SC-only records", async () => {
  const { records } = await loadCorpus({
    seriesFilter: ["MT. AIRY", "ANCHOR BAY"],
  });
  const byKey = new Map(records.map((r) => [r.key, r]));

  const mtAiryHtml = renderSeriesPage(byKey.get("MT._AIRY"), {
    hasTxt: true,
    hasJson: true,
  });
  assert.ok(mtAiryHtml.includes("MT. AIRY SERIES"));
  assert.ok(!mtAiryHtml.includes("COMPETING SERIES:"));
  assert.ok(!mtAiryHtml.includes("ADDITIONAL DATA:"));
  assert.ok(mtAiryHtml.includes("    A1"));
  assert.ok(mtAiryHtml.includes("    R"));

  const anchorBayHtml = renderSeriesPage(byKey.get("ANCHOR_BAY"));
  assert.ok(anchorBayHtml.includes("ANCHOR BAY SERIES"));
  assert.ok(anchorBayHtml.includes("TYPICAL PEDON:"));

  // SC-only synthetic record (no SKB JSON)
  const scOnlyHtml = renderSeriesPage(
    {
      key: "SC_ONLY_SERIES",
      name: "SC ONLY SERIES",
      letter: "S",
      status: "Inactive",
      hasSc: true,
      hasSkb: false,
      sc: {
        soilseriesname: "SC ONLY SERIES",
        soilseriesstatus: "Inactive",
        areasymbol: "OR",
        taxclname: "COARSE-LOAMY, MIXED, MESIC TYPIC HAPLOXEROLLS",
      },
      skb: null,
      skbPath: null,
      horizons: [],
    },
    { hasTxt: false, hasJson: false }
  );
  assert.ok(scOnlyHtml.includes("LOCATION SC ONLY SERIES"));
  assert.ok(scOnlyHtml.includes("Inactive Series"));
  assert.ok(scOnlyHtml.includes("COARSE-LOAMY, MIXED, MESIC TYPIC HAPLOXEROLLS"));
  assert.ok(!scOnlyHtml.includes("osd-downloads"));

  assert.equal(NSSH_SECTIONS.length, 14);
});

test("cli/build.js: parseCliArgs and --series AMADOR,MT._AIRY build output", async () => {
  const parsed = parseCliArgs([
    "--series",
    "AMADOR,MT._AIRY",
    "--limit",
    "5",
    "--out",
    "custom-dist",
  ]);
  assert.deepEqual(parsed.seriesFilter, ["AMADOR", "MT._AIRY"]);
  assert.equal(parsed.limit, 5);
  assert.equal(parsed.outDir, "custom-dist");

  const tmpOut = await fsp.mkdtemp(path.join(os.tmpdir(), "ssv-build-test-"));
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        path.join(REPO_ROOT, "src/cli/build.js"),
        "--series",
        "AMADOR,MT._AIRY",
        "--out",
        tmpOut,
      ],
      { cwd: REPO_ROOT }
    );
    assert.match(stdout, /Built 2 series pages/);

    assert.ok(fs.existsSync(path.join(tmpOut, "usdastyle.css")));

    for (const [letter, key] of [
      ["A", "AMADOR"],
      ["M", "MT._AIRY"],
    ]) {
      const htmlPath = path.join(tmpOut, "OSD_Docs", letter, `${key}.html`);
      const txtPath = path.join(tmpOut, "OSD_Docs", letter, `${key}.txt`);
      const jsonPath = path.join(tmpOut, "OSD_Docs", letter, `${key}.json`);

      assert.ok(fs.existsSync(htmlPath), `missing ${htmlPath}`);
      assert.ok(fs.existsSync(txtPath), `missing ${txtPath}`);
      assert.ok(fs.existsSync(jsonPath), `missing ${jsonPath}`);

      const html = await fsp.readFile(htmlPath, "utf8");
      assert.ok(html.includes(`href="${key}.txt"`));
      assert.ok(html.includes(`href="${key}.json"`));
      assert.ok(html.includes(`href="../../usdastyle.css"`));
    }

    // Verify --limit flag works cleanly
    const limitOut = path.join(tmpOut, "limited");
    const { stdout: limitStdout } = await execFileAsync(
      process.execPath,
      [
        path.join(REPO_ROOT, "src/cli/build.js"),
        "--limit",
        "3",
        "--out",
        limitOut,
      ],
      { cwd: REPO_ROOT }
    );
    assert.match(limitStdout, /Built 3 series pages/);
  } finally {
    await fsp.rm(tmpOut, { recursive: true, force: true });
  }
});
