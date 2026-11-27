import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.resolve(__dirname, "..", ".github", "workflows");

test("test.yml workflow exists and configures Node 24, upstream clones, env vars, and npm test", () => {
  const filePath = path.join(WORKFLOWS_DIR, "test.yml");
  assert.equal(fs.existsSync(filePath), true);
  const content = fs.readFileSync(filePath, "utf8");

  assert.match(content, /push:/);
  assert.match(content, /pull_request:/);
  assert.match(content, /node-version:\s*"24"/);
  assert.match(content, /OSD_SC_PATH:/);
  assert.match(content, /OSD_SKB_DIR:/);
  assert.match(content, /SOIL_PROFILES_PATH:/);
  assert.match(content, /git clone --depth 1 https:\/\/github\.com\/ncss-tech\/OSDRegistry\.git/);
  assert.match(content, /git clone --depth 1 https:\/\/github\.com\/ncss-tech\/SoilKnowledgeBase\.git/);
  assert.match(content, /git clone --depth 1 https:\/\/github\.com\/brownag\/SoilProfiles\.js\.git/);
  assert.match(content, /git clone --depth 1 https:\/\/github\.com\/brownag\/DST\.git/);
  assert.match(content, /run:\s*npm test/);
});

test("build-and-deploy.yml workflow configures weekly schedule, incremental cache, Pagefind, and GitHub Pages", () => {
  const filePath = path.join(WORKFLOWS_DIR, "build-and-deploy.yml");
  assert.equal(fs.existsSync(filePath), true);
  const content = fs.readFileSync(filePath, "utf8");

  assert.match(content, /cron:\s*"0 8 \* \* 1"/);
  assert.match(content, /workflow_dispatch:/);
  assert.match(content, /pages:\s*write/);
  assert.match(content, /id-token:\s*write/);
  assert.match(content, /actions\/cache@v4/);
  assert.match(content, /dist\/\.build-cache\.json/);
  assert.match(content, /node src\/cli\/build\.js --out dist --incremental/);
  assert.match(content, /npx --yes pagefind --site dist/);
  assert.match(content, /actions\/upload-pages-artifact@v3/);
  assert.match(content, /actions\/deploy-pages@v4/);
});
