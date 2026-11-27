import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCliArgs } from "../src/cli/build.js";
import {
  DEFAULT_SOIL_PROFILES_PATH,
  munsellToHex,
  renderStaticSVG,
} from "../src/lib/soil-profiles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

test("soil-profiles wrapper exports required SoilProfiles.js symbols", () => {
  assert.equal(typeof DEFAULT_SOIL_PROFILES_PATH, "string");
  assert.equal(typeof munsellToHex, "function");
  assert.equal(typeof renderStaticSVG, "function");
});

test("parseCliArgs accepts --kst-dir, --dst-data, and --featurelist overrides", () => {
  const parsed = parseCliArgs([
    "--kst-dir",
    "/tmp/kst",
    "--dst-data",
    "/tmp/dst-data.json",
    "--featurelist",
    "/tmp/features.json",
  ]);
  assert.equal(parsed.kstDir, "/tmp/kst");
  assert.equal(parsed.dstDataPath, "/tmp/dst-data.json");
  assert.equal(parsed.featurelistPath, "/tmp/features.json");
});

test("environment variables override default upstream data paths", () => {
  const script = `
    import { DEFAULT_SC_PATH, DEFAULT_SKB_DIR } from "./src/loader/index.js";
    import { DEFAULT_KST_DIR } from "./src/index/kst-criteria.js";
    import { DEFAULT_DST_DATA_PATH, DEFAULT_FEATURELIST_PATH } from "./src/index/glossary.js";
    import { DEFAULT_OSD_TXT_DIR } from "./src/cli/build.js";
    console.log(JSON.stringify({
      DEFAULT_SC_PATH,
      DEFAULT_SKB_DIR,
      DEFAULT_KST_DIR,
      DEFAULT_DST_DATA_PATH,
      DEFAULT_FEATURELIST_PATH,
      DEFAULT_OSD_TXT_DIR,
    }));
  `;
  const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      OSD_SC_PATH: "/custom/SCDB.csv",
      OSD_SKB_DIR: "/custom/OSD",
      OSD_TXT_DIR: "/custom/OSD_TXT",
      OSD_KST_DIR: "/custom/KST",
      OSD_DST_DATA_PATH: "/custom/dst-data.json",
      OSD_FEATURELIST_PATH: "/custom/featurelist.json",
    },
    encoding: "utf8",
  });
  const result = JSON.parse(stdout.trim());
  assert.equal(result.DEFAULT_SC_PATH, "/custom/SCDB.csv");
  assert.equal(result.DEFAULT_SKB_DIR, "/custom/OSD");
  assert.equal(result.DEFAULT_OSD_TXT_DIR, "/custom/OSD_TXT");
  assert.equal(result.DEFAULT_KST_DIR, "/custom/KST");
  assert.equal(result.DEFAULT_DST_DATA_PATH, "/custom/dst-data.json");
  assert.equal(result.DEFAULT_FEATURELIST_PATH, "/custom/featurelist.json");
});
