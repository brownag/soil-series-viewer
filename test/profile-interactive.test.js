import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { munsellToHex } from "/home/andrew/workspace/SoilProfiles.js/dist/index.js";
import { loadCorpus } from "../src/loader/index.js";
import { FALLBACK_HORIZON_COLOR } from "../src/render/profile-sketch.js";
import { buildInteractiveProfileData } from "../src/render/profile-interactive-data.js";
import {
  COMPARE_STORAGE_KEY,
  MAX_PINNED_PROFILES,
  formatHorizonTooltip,
  initProfileInteractive,
  loadPinnedProfiles,
  renderComparisonTrayHtml,
  savePinnedProfiles,
  togglePinnedProfile,
} from "../src/client/profile-interactive.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_MODULE_PATH = path.resolve(__dirname, "../src/client/profile-interactive.js");

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

function createMockElement(tagName, id = "", attrs = {}) {
  const attributes = new Map(Object.entries(attrs));
  const listeners = new Map();
  const el = {
    tagName: tagName.toUpperCase(),
    id,
    className: "",
    textContent: "",
    _innerHTML: "",
    hidden: false,
    disabled: false,
    children: [],
    style: {},
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(val) {
      this._innerHTML = String(val);
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(fn);
    },
    dispatch(type, eventInit = {}) {
      const event = { target: el, preventDefault() {}, ...eventInit };
      for (const fn of listeners.get(type) || []) {
        fn(event);
      }
    },
  };
  return el;
}

test("src/client/profile-interactive.js contains zero Node-only imports", async () => {
  const src = await fs.readFile(CLIENT_MODULE_PATH, "utf8");

  assert.doesNotMatch(src, /from\s+["']node:/);
  assert.doesNotMatch(src, /import\s+["']node:/);
  assert.doesNotMatch(src, /require\s*\(/);
  assert.doesNotMatch(src, /\bprocess\b/);
  assert.doesNotMatch(src, /\bBuffer\b/);
  assert.match(src, /typeof document !== "undefined"/);
  assert.match(src, /DOMContentLoaded/);
});

test("buildInteractiveProfileData extracts AMADOR metadata and dynamic Munsell colors", async () => {
  const { records } = await loadCorpus({ seriesFilter: ["AMADOR"] });
  assert.equal(records.length, 1);

  const data = buildInteractiveProfileData(records[0]);
  assert.equal(data.key, "AMADOR");
  assert.equal(data.name, "AMADOR");
  assert.ok(typeof data.taxclname === "string" && data.taxclname.length > 0);
  assert.equal(data.horizons.length, 4);

  const expectedA = munsellToHex("10YR", 4, 2);
  const expectedBw1 = munsellToHex("10YR", 5, 3);
  const expectedCr = munsellToHex("2.5Y", 7, 4);

  assert.deepEqual(data.horizons[0], {
    name: "A",
    top: 0,
    bottom: 15,
    color: expectedA,
    munsell: "10YR 4/2",
    texture: "loam",
    pH: 5.1,
    effervescence: null,
  });
  assert.equal(data.horizons[1].color, expectedBw1);
  assert.equal(data.horizons[3].color, expectedCr);
  assert.equal(data.horizons[3].munsell, "2.5Y 7/4");
});

test("buildInteractiveProfileData applies SKB-9 color fallback, SKB-10 depth omission, and effervescence", () => {
  const expectedDryColor = munsellToHex("10YR", 7, 2);
  assert.ok(expectedDryColor);

  const data = buildInteractiveProfileData({
    key: "SYNTH_TEST",
    name: "SYNTH TEST",
    sc: { taxclname: "Fine-loamy, mixed Typic Haplustolls" },
    horizons: [
      { name: "O", top: null, bottom: 5, moist_hue: "10YR", moist_value: 3, moist_chroma: 2 },
      { name: "Bad", top: 20, bottom: 20, moist_hue: "10YR", moist_value: 4, moist_chroma: 2 },
      {
        name: "Bk",
        top: 15,
        bottom: 45,
        moist_hue: null,
        moist_value: null,
        moist_chroma: null,
        dry_hue: "10YR",
        dry_value: 7,
        dry_chroma: 2,
        texture_class: "clay loam",
        pH: "7.8",
        eff_class: "strongly effervescent",
      },
      {
        name: "C",
        top: 45,
        bottom: 80,
        moist_hue: "10YR",
        moist_value: null,
        moist_chroma: null,
      },
    ],
  });

  assert.equal(data.key, "SYNTH_TEST");
  assert.equal(data.name, "SYNTH TEST");
  assert.equal(data.taxclname, "Fine-loamy, mixed Typic Haplustolls");
  assert.equal(data.horizons.length, 2);

  assert.deepEqual(data.horizons[0], {
    name: "Bk",
    top: 15,
    bottom: 45,
    color: expectedDryColor,
    munsell: "10YR 7/2",
    texture: "clay loam",
    pH: 7.8,
    effervescence: "strongly effervescent",
  });

  assert.deepEqual(data.horizons[1], {
    name: "C",
    top: 45,
    bottom: 80,
    color: FALLBACK_HORIZON_COLOR,
    munsell: null,
    texture: null,
    pH: null,
    effervescence: null,
  });

  assert.throws(() => buildInteractiveProfileData(null), TypeError);
});

test("formatHorizonTooltip formats full horizon properties and escapes HTML", () => {
  const color = munsellToHex("10YR", 4, 2);
  const html = formatHorizonTooltip({
    name: "A<1>",
    top: 0,
    bottom: 15,
    color,
    munsell: "10YR 4/2",
    texture: "silty clay & loam",
    pH: 6.4,
    effervescence: "slightly effervescent",
  });

  assert.ok(html.includes("A&lt;1&gt;"));
  assert.ok(html.includes("0–15 cm"));
  assert.ok(html.includes("10YR 4/2"));
  assert.ok(html.includes(`background:${color}`));
  assert.ok(html.includes("silty clay &amp; loam"));
  assert.ok(html.includes("pH: 6.4"));
  assert.ok(html.includes("slightly effervescent"));

  const minimal = formatHorizonTooltip({ name: "C", top: 40, bottom: 75 });
  assert.ok(minimal.includes("C"));
  assert.ok(minimal.includes("40–75 cm"));
  assert.ok(!minimal.includes("pH:"));
  assert.ok(!minimal.includes("Effervescence:"));
  assert.equal(formatHorizonTooltip(null), "");
});

test("togglePinnedProfile handles add, remove, cap at 4, and corrupt storage", () => {
  assert.equal(COMPARE_STORAGE_KEY, "osd-compare-series");
  assert.equal(MAX_PINNED_PROFILES, 4);

  const storage = createMemoryStorage({ [COMPARE_STORAGE_KEY]: "{bad-json" });
  assert.deepEqual(loadPinnedProfiles(storage), []);

  const makeProfile = (key) => ({
    key,
    name: key.replaceAll("_", " "),
    taxclname: `Family for ${key}`,
    horizons: [{ name: "A", top: 0, bottom: 20, color: munsellToHex("10YR", 4, 2) }],
  });

  // Add 1..4
  let pinned = togglePinnedProfile(storage, makeProfile("S1"));
  assert.deepEqual(pinned.map((p) => p.key), ["S1"]);

  togglePinnedProfile(storage, makeProfile("S2"));
  togglePinnedProfile(storage, makeProfile("S3"));
  pinned = togglePinnedProfile(storage, makeProfile("S4"));
  assert.deepEqual(pinned.map((p) => p.key), ["S1", "S2", "S3", "S4"]);

  // Adding a 5th caps at 4 (evicts oldest S1)
  pinned = togglePinnedProfile(storage, makeProfile("S5"));
  assert.equal(pinned.length, 4);
  assert.deepEqual(pinned.map((p) => p.key), ["S2", "S3", "S4", "S5"]);

  // Toggling existing S3 removes it
  pinned = togglePinnedProfile(storage, makeProfile("S3"));
  assert.deepEqual(pinned.map((p) => p.key), ["S2", "S4", "S5"]);
  assert.deepEqual(loadPinnedProfiles(storage).map((p) => p.key), ["S2", "S4", "S5"]);

  // Direct savePinnedProfiles deduplicates via loadPinnedProfiles and normalizes
  savePinnedProfiles(storage, [makeProfile("ALPHA")]);
  assert.deepEqual(loadPinnedProfiles(storage).map((p) => p.key), ["ALPHA"]);
});

test("renderComparisonTrayHtml renders mini-strips, links, taxclname, remove buttons, and current highlight", () => {
  assert.equal(renderComparisonTrayHtml([]), "");

  const colorA = munsellToHex("10YR", 4, 2);
  const profiles = [
    {
      key: "AMADOR",
      name: "AMADOR",
      taxclname: "Loamy, mixed, superactive, thermic, shallow Typic Haploxerepts",
      horizons: [{ name: "A", top: 0, bottom: 15, color: colorA }],
    },
    {
      key: "KANA@A",
      name: "KANA`A",
      taxclname: "Ashy <special>",
      horizons: [{ name: "A", top: 0, bottom: 10, color: colorA }],
    },
  ];

  const html = renderComparisonTrayHtml(profiles, "AMADOR");
  assert.ok(html.includes('class="osd-compare-card osd-compare-card--current"'));
  assert.ok(html.includes('data-series-key="AMADOR"'));
  assert.ok(html.includes('href="../../OSD_Docs/A/AMADOR.html"'));
  assert.ok(html.includes('href="../../OSD_Docs/K/KANA@A.html"'));
  assert.ok(html.includes("Loamy, mixed, superactive, thermic, shallow Typic Haploxerepts"));
  assert.ok(html.includes("Ashy &lt;special&gt;"));
  assert.ok(html.includes('data-remove-key="AMADOR"'));
  assert.ok(html.includes('data-remove-key="KANA@A"'));
  assert.ok(html.includes("<svg "));
  assert.ok(html.includes(`fill="${colorA}"`));
});

test("initProfileInteractive wires tooltips on horizon rects and compare toggle/tray", () => {
  const colorA = munsellToHex("10YR", 4, 2);
  const colorBw = munsellToHex("10YR", 5, 3);
  const embeddedData = {
    key: "AMADOR",
    name: "AMADOR",
    taxclname: "Loamy, mixed Typic Haploxerepts",
    horizons: [
      {
        name: "A",
        top: 0,
        bottom: 15,
        color: colorA,
        munsell: "10YR 4/2",
        texture: "loam",
        pH: 5.1,
        effervescence: null,
      },
      {
        name: "Bw1",
        top: 15,
        bottom: 28,
        color: colorBw,
        munsell: "10YR 5/3",
        texture: "loam",
        pH: 5.1,
        effervescence: null,
      },
    ],
  };

  const dataScript = createMockElement("script", "osd-profile-data");
  dataScript.textContent = JSON.stringify(embeddedData);
  const sketchContainer = createMockElement("div");
  const bgRect = createMockElement("rect");
  const hzRect0 = createMockElement("rect", "", { "data-horizon-id": "amador_hz_a_0" });
  const hzRect1 = createMockElement("rect", "", { "data-horizon-id": "amador_hz_bw1_1" });
  const toggleBtn = createMockElement("button", "osd-compare-toggle");
  const trayEl = createMockElement("div", "osd-compare-tray");

  const doc = {
    body: createMockElement("body"),
    getElementById(id) {
      if (id === "osd-profile-data") return dataScript;
      if (id === "osd-compare-toggle") return toggleBtn;
      if (id === "osd-compare-tray") return trayEl;
      return null;
    },
    querySelector(sel) {
      if (sel === ".osd-pedon-sketch") return sketchContainer;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === ".osd-pedon-sketch svg rect") {
        return [bgRect, hzRect0, hzRect1];
      }
      return [];
    },
    createElement(tag) {
      return createMockElement(tag);
    },
  };

  const storage = createMemoryStorage();
  const controller = initProfileInteractive(doc, storage);
  assert.ok(controller);
  assert.equal(sketchContainer.children.length, 1);

  const tooltipEl = sketchContainer.children[0];
  assert.equal(tooltipEl.className, "osd-horizon-tooltip");
  assert.equal(tooltipEl.hidden, true);

  // Background rect without data-horizon-id was skipped
  assert.equal(bgRect.getAttribute("tabindex"), null);
  assert.equal(hzRect0.getAttribute("tabindex"), "0");

  // Hover & focus on first horizon rect show tooltip
  hzRect0.dispatch("mouseenter");
  assert.equal(tooltipEl.hidden, false);
  assert.ok(tooltipEl.innerHTML.includes("0–15 cm"));
  assert.ok(tooltipEl.innerHTML.includes("10YR 4/2"));

  hzRect0.dispatch("mouseleave");
  assert.equal(tooltipEl.hidden, true);

  hzRect1.dispatch("focus");
  assert.equal(tooltipEl.hidden, false);
  assert.ok(tooltipEl.innerHTML.includes("Bw1"));
  assert.ok(tooltipEl.innerHTML.includes("15–28 cm"));

  hzRect1.dispatch("keydown", { key: "Escape" });
  assert.equal(tooltipEl.hidden, true);

  // Compare toggle pins & unpins AMADOR
  assert.equal(toggleBtn.getAttribute("aria-pressed"), "false");
  assert.equal(trayEl.hidden, true);

  toggleBtn.dispatch("click");
  assert.equal(toggleBtn.getAttribute("aria-pressed"), "true");
  assert.equal(trayEl.hidden, false);
  assert.ok(trayEl.innerHTML.includes("AMADOR"));
  assert.equal(loadPinnedProfiles(storage).length, 1);

  // Removing via tray remove button updates storage and UI
  const removeBtn = createMockElement("button", "", { "data-remove-key": "AMADOR" });
  trayEl.dispatch("click", { target: removeBtn });
  assert.equal(toggleBtn.getAttribute("aria-pressed"), "false");
  assert.equal(trayEl.hidden, true);
  assert.equal(loadPinnedProfiles(storage).length, 0);
});
