/**
 * Static site builder CLI for soil-series-viewer (v1/v2).
 * Loads joined SC + SKB records, copies styles/client assets, builds search
 * index and color-strip shards, and writes `index.html` + `OSD_Docs/<L>/<KEY>.html`.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildColorStripShards } from "../index/color-strips.js";
import { buildSearchIndex } from "../index/search-index.js";
import {
  DEFAULT_SC_PATH,
  DEFAULT_SKB_DIR,
  loadCorpus,
} from "../loader/index.js";
import { keyToRelativePath } from "../loader/keys.js";
import { detectRecordIssues, renderQaNotes } from "../qa/detect.js";
import { buildQaReport } from "../qa/report.js";
import {
  buildFamilyIndex,
  renderCompetingPanel,
} from "../render/competing-panel.js";
import { buildSeriesLinkIndex } from "../render/cross-links.js";
import { renderHomePage } from "../render/home-page.js";
import { renderProfileSketch } from "../render/profile-sketch.js";
import { renderSeriesPage } from "../render/series-page.js";

/**
 * Default sketch renderer hook for `buildSite`.
 *
 * @param {object} record
 * @returns {string|null}
 */
function defaultRenderSketch(record) {
  return renderProfileSketch(record).svg;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CSS_PATH = path.resolve(__dirname, "../styles/usdastyle.css");
export const DEFAULT_HOME_CSS_PATH = path.resolve(__dirname, "../styles/home.css");
export const DEFAULT_CLIENT_DIR = path.resolve(__dirname, "../client");
export const CLIENT_ASSET_FILES = Object.freeze([
  "home-app.js",
  "search-engine.js",
  "strip-svg.js",
]);
export const DEFAULT_OSD_TXT_DIR = "/home/andrew/workspace/OSDRegistry/OSD";
export const DEFAULT_OUT_DIR = "dist";

/**
 * Parse CLI flags for `src/cli/build.js`.
 *
 * @param {string[]} argv
 * @returns {{
 *   seriesFilter: string[] | null,
 *   limit: number | null,
 *   outDir: string,
 *   scPath: string,
 *   skbDir: string,
 *   osdTxtDir: string,
 *   help: boolean,
 * }}
 */
export function parseCliArgs(argv) {
  const series = [];
  let limit = null;
  let outDir = DEFAULT_OUT_DIR;
  let scPath = DEFAULT_SC_PATH;
  let skbDir = DEFAULT_SKB_DIR;
  let osdTxtDir = DEFAULT_OSD_TXT_DIR;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--series") {
      const val = argv[++i];
      if (!val) {
        throw new Error("--series requires a comma-separated list of series names");
      }
      for (const item of val.split(",")) {
        const trimmed = item.trim();
        if (trimmed) {
          series.push(trimmed);
        }
      }
    } else if (arg.startsWith("--series=")) {
      const val = arg.slice("--series=".length);
      for (const item of val.split(",")) {
        const trimmed = item.trim();
        if (trimmed) {
          series.push(trimmed);
        }
      }
    } else if (arg === "--limit") {
      const val = argv[++i];
      const parsed = Number.parseInt(val, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid --limit value: ${val}`);
      }
      limit = parsed;
    } else if (arg.startsWith("--limit=")) {
      const val = arg.slice("--limit=".length);
      const parsed = Number.parseInt(val, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid --limit value: ${val}`);
      }
      limit = parsed;
    } else if (arg === "--out") {
      const val = argv[++i];
      if (!val) {
        throw new Error("--out requires a directory path");
      }
      outDir = val;
    } else if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length) || DEFAULT_OUT_DIR;
    } else if (arg === "--sc") {
      scPath = argv[++i];
    } else if (arg === "--skb") {
      skbDir = argv[++i];
    } else if (arg === "--osd-txt") {
      osdTxtDir = argv[++i];
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  return {
    seriesFilter: series.length > 0 ? series : null,
    limit,
    outDir,
    scPath,
    skbDir,
    osdTxtDir,
    help,
  };
}

/**
 * Build static series pages and assets into `outDir`.
 *
 * @param {object} [options]
 * @param {string[]|null} [options.seriesFilter=null]
 * @param {number|null} [options.limit=null]
 * @param {string} [options.outDir="dist"]
 * @param {string} [options.scPath]
 * @param {string} [options.skbDir]
 * @param {string} [options.osdTxtDir]
 * @param {string} [options.cssPath]
 * @param {string} [options.homeCssPath]
 * @param {string} [options.clientDir]
 * @param {(record: object) => (string|null)} [options.renderSketch]
 * @returns {Promise<{
 *   outDir: string,
 *   builtCount: number,
 *   txtCopied: number,
 *   jsonCopied: number,
 *   stripShards: number,
 *   report: object,
 *   qaSummary: {
 *     totalRecords: number,
 *     recordsWithIssues: number,
 *     countsByCode: Record<string, number>,
 *   },
 * }>}
 */
export async function buildSite(options = {}) {
  const {
    seriesFilter = null,
    limit = null,
    outDir = DEFAULT_OUT_DIR,
    scPath = DEFAULT_SC_PATH,
    skbDir = DEFAULT_SKB_DIR,
    osdTxtDir = DEFAULT_OSD_TXT_DIR,
    cssPath = DEFAULT_CSS_PATH,
    homeCssPath = DEFAULT_HOME_CSS_PATH,
    clientDir = DEFAULT_CLIENT_DIR,
    renderSketch = defaultRenderSketch,
  } = options;

  const { records, report } = await loadCorpus({
    scPath,
    skbDir,
    seriesFilter,
    limit,
  });

  const resolvedOut = path.resolve(outDir);
  const assetsDir = path.join(resolvedOut, "assets");
  const dataDir = path.join(resolvedOut, "data");
  const stripsDir = path.join(dataDir, "strips");

  await Promise.all([
    fsp.mkdir(resolvedOut, { recursive: true }),
    fsp.mkdir(assetsDir, { recursive: true }),
    fsp.mkdir(stripsDir, { recursive: true }),
  ]);

  await Promise.all([
    fsp.copyFile(cssPath, path.join(resolvedOut, "usdastyle.css")),
    fsp.copyFile(homeCssPath, path.join(resolvedOut, "home.css")),
    ...CLIENT_ASSET_FILES.map((fileName) =>
      fsp.copyFile(path.join(clientDir, fileName), path.join(assetsDir, fileName))
    ),
  ]);

  const searchIndex = buildSearchIndex(records);
  const stripShards = buildColorStripShards(records);
  const shardEntries = Object.entries(stripShards);
  const homeHtml = renderHomePage({ totalCount: records.length });

  const linkIndex = buildSeriesLinkIndex(records);
  const familyIndex = buildFamilyIndex(records);
  const issuesByKey = new Map();
  for (const record of records) {
    issuesByKey.set(record.key, detectRecordIssues(record));
  }
  const qaReport = buildQaReport(records, issuesByKey);

  await Promise.all([
    fsp.writeFile(path.join(resolvedOut, "index.html"), homeHtml, "utf8"),
    fsp.writeFile(
      path.join(dataDir, "search-index.json"),
      JSON.stringify(searchIndex),
      "utf8"
    ),
    fsp.writeFile(
      path.join(dataDir, "qa-report.json"),
      JSON.stringify(qaReport),
      "utf8"
    ),
    ...shardEntries.map(([letter, shard]) =>
      fsp.writeFile(
        path.join(stripsDir, `${letter}.json`),
        JSON.stringify(shard),
        "utf8"
      )
    ),
  ]);

  const osdDocsRoot = path.join(resolvedOut, "OSD_Docs");
  const letters = new Set(records.map((r) => r.letter));
  await Promise.all(
    Array.from(letters).map((letter) =>
      fsp.mkdir(path.join(osdDocsRoot, letter), { recursive: true })
    )
  );

  let builtCount = 0;
  let txtCopied = 0;
  let jsonCopied = 0;

  // Bounded batches prevent EMFILE on full-corpus builds.
  const BATCH_SIZE = 128;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (record) => {
        const htmlRel = keyToRelativePath(record.key, "html");
        const htmlDest = path.join(osdDocsRoot, htmlRel);

        const txtRel = keyToRelativePath(record.key, "txt");
        const txtSrc = path.join(osdTxtDir, txtRel);
        const hasTxt = fs.existsSync(txtSrc);
        if (hasTxt) {
          await fsp.copyFile(txtSrc, path.join(osdDocsRoot, txtRel));
          txtCopied++;
        }

        const hasJson = Boolean(record.skbPath && fs.existsSync(record.skbPath));
        if (hasJson) {
          const jsonRel = keyToRelativePath(record.key, "json");
          await fsp.copyFile(record.skbPath, path.join(osdDocsRoot, jsonRel));
          jsonCopied++;
        }

        const rawSketch =
          typeof renderSketch === "function" ? renderSketch(record) : null;
        const sketchSvg =
          rawSketch && typeof rawSketch === "object" && "svg" in rawSketch
            ? rawSketch.svg
            : rawSketch;

        const competingPanelHtml = renderCompetingPanel(record, familyIndex);
        const qaNotesHtml = renderQaNotes(issuesByKey.get(record.key) ?? []);

        const html = renderSeriesPage(record, {
          cssHref: "../../usdastyle.css",
          hasTxt,
          hasJson,
          sketchSvg,
          linkIndex,
          competingPanelHtml,
          qaNotesHtml,
        });
        await fsp.writeFile(htmlDest, html, "utf8");
        builtCount++;
      })
    );
  }

  return {
    outDir: resolvedOut,
    builtCount,
    txtCopied,
    jsonCopied,
    stripShards: shardEntries.length,
    report,
    qaSummary: {
      totalRecords: qaReport.totalRecords,
      recordsWithIssues: qaReport.recordsWithIssues,
      countsByCode: qaReport.countsByCode,
    },
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Usage: node src/cli/build.js [--series AMADOR,MT._AIRY] [--limit N] [--out dist]"
    );
    return;
  }
  const summary = await buildSite(args);
  console.log(
    `Built ${summary.builtCount} series pages (${summary.txtCopied} txt, ${summary.jsonCopied} json) into ${summary.outDir}`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
