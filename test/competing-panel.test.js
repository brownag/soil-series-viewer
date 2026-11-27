import test from "node:test";
import assert from "node:assert/strict";

import { munsellToHex } from "/home/andrew/workspace/SoilProfiles.js/dist/index.js";
import {
  buildFamilyIndex,
  normalizeTaxonomicFamily,
  renderCompetingPanel,
} from "../src/render/competing-panel.js";

function makeRecord({
  key,
  name = key,
  letter,
  status = "Established",
  taxclname = null,
  horizons = [],
}) {
  return {
    key,
    name,
    ...(letter !== undefined ? { letter } : {}),
    status,
    sc: taxclname === undefined ? null : { taxclname },
    horizons,
  };
}

test("normalizeTaxonomicFamily: trims, lowercases, and rejects non-strings or empty values", () => {
  assert.equal(normalizeTaxonomicFamily(null), "");
  assert.equal(normalizeTaxonomicFamily(undefined), "");
  assert.equal(normalizeTaxonomicFamily(42), "");
  assert.equal(normalizeTaxonomicFamily(""), "");
  assert.equal(normalizeTaxonomicFamily("   \t\n "), "");
  assert.equal(
    normalizeTaxonomicFamily("  Fine-loamy, mixed, superactive, mesic Typic Hapludolls  "),
    "fine-loamy, mixed, superactive, mesic typic hapludolls"
  );
});

test("buildFamilyIndex: groups by normalized taxclname, skips empty families, and sorts alphabetically", () => {
  const familyA = "Fine-loamy, mixed, active, mesic Typic Hapludalfs";
  const familyAVariant = "  fine-loamy, mixed, active, mesic typic hapludalfs  ";
  const familyB = "Sandy, mixed, frigid Typic Udipsamments";

  const records = [
    makeRecord({
      key: "ZETA",
      name: "Zeta",
      taxclname: familyA,
      horizons: [
        {
          name: "Ap",
          top: 0,
          bottom: 20,
          moist_hue: "10YR",
          moist_value: 3,
          moist_chroma: 2,
        },
      ],
    }),
    makeRecord({ key: "NO_FAM_NULL", taxclname: null }),
    makeRecord({ key: "NO_FAM_BLANK", taxclname: "   " }),
    makeRecord({
      key: "ALPHA",
      name: "alpha",
      taxclname: familyAVariant,
      horizons: [],
    }),
    makeRecord({
      key: "KANA@A",
      name: "KANA`A",
      taxclname: familyA,
      horizons: [],
    }),
    makeRecord({
      key: "SOLO",
      name: "Solo",
      taxclname: familyB,
      horizons: [],
    }),
  ];

  const index = buildFamilyIndex(records);

  assert.equal(index.size, 2);

  const peersA = index.get(normalizeTaxonomicFamily(familyA));
  assert.ok(peersA);
  assert.deepEqual(
    peersA.map((p) => p.name),
    ["alpha", "KANA`A", "Zeta"]
  );
  assert.deepEqual(
    peersA.map((p) => p.href),
    ["../A/ALPHA.html", "../K/KANA@A.html", "../Z/ZETA.html"]
  );

  const zetaPeer = peersA.find((p) => p.key === "ZETA");
  assert.deepEqual(zetaPeer.stripHorizons, [
    {
      t: 0,
      b: 20,
      hex: munsellToHex("10YR", 3, 2),
      n: "Ap",
    },
  ]);

  const alphaPeer = peersA.find((p) => p.key === "ALPHA");
  assert.deepEqual(alphaPeer.stripHorizons, []);

  assert.equal(index.get(normalizeTaxonomicFamily(familyB))?.length, 1);
});

test("renderCompetingPanel: excludes self, renders sorted peer cards with mini strip SVGs", () => {
  const family = "Loamy, mixed, superactive, thermic Typic Haploxerepts";
  const records = [
    makeRecord({
      key: "CHINO",
      name: "CHINO",
      status: "Established",
      taxclname: family,
      horizons: [
        {
          name: "A",
          top: 0,
          bottom: 18,
          moist_hue: "10YR",
          moist_value: 4,
          moist_chroma: 2,
        },
        {
          name: "Bw",
          top: 18,
          bottom: 50,
          moist_hue: "10YR",
          moist_value: 5,
          moist_chroma: 3,
        },
      ],
    }),
    makeRecord({
      key: "AMADOR",
      name: "AMADOR",
      status: "Established",
      taxclname: family,
      horizons: [
        {
          name: "A1",
          top: 0,
          bottom: 12,
          dry_hue: "10YR",
          dry_value: 6,
          dry_chroma: 3,
        },
      ],
    }),
    makeRecord({
      key: "BERNARDO",
      name: "BERNARDO",
      status: "Tentative",
      taxclname: family,
      horizons: [],
    }),
  ];

  const familyIndex = buildFamilyIndex(records);
  const html = renderCompetingPanel(records[1], familyIndex);

  assert.match(html, /<section class="osd-section osd-competing-panel" id="same-family-series">/);
  assert.match(html, /Same Taxonomic Family \(2 competing series\)/);
  assert.match(html, /<p class="osd-competing-family">Loamy, mixed, superactive, thermic Typic Haploxerepts<\/p>/);

  // Self (AMADOR) must be excluded
  assert.doesNotMatch(html, /href="\.\.\/A\/AMADOR\.html"/);

  // Alphabetical order: BERNARDO before CHINO
  const bernardoPos = html.indexOf('href="../B/BERNARDO.html"');
  const chinoPos = html.indexOf('href="../C/CHINO.html"');
  assert.ok(bernardoPos !== -1 && chinoPos !== -1 && bernardoPos < chinoPos);

  // Cards embed mini strip SVG sized 28x72
  assert.match(html, /<a class="osd-competing-card" href="\.\.\/C\/CHINO\.html" title="CHINO \(Established\)">/);
  assert.match(html, /<span class="osd-competing-strip"><svg[^>]*width="28" height="72"/);
  assert.match(html, /<span class="osd-competing-name">CHINO<\/span>/);
  assert.doesNotMatch(html, /osd-competing-more/);
});

test("renderCompetingPanel: truncates at maxPeers and shows +N more in this family", () => {
  const family = "Coarse-loamy, mixed, mesic Typic Dystrudepts";
  const records = Array.from({ length: 20 }, (_, i) => {
    const label = `SERIES_${String(i).padStart(2, "0")}`;
    return makeRecord({
      key: label,
      name: label,
      taxclname: family,
    });
  });

  const familyIndex = buildFamilyIndex(records);

  // Default maxPeers = 16 -> 19 competing peers -> 16 cards + "+3 more in this family"
  const defaultHtml = renderCompetingPanel(records[0], familyIndex);
  const defaultCardCount = (defaultHtml.match(/class="osd-competing-card"/g) ?? []).length;
  assert.equal(defaultCardCount, 16);
  assert.match(defaultHtml, /Same Taxonomic Family \(19 competing series\)/);
  assert.match(defaultHtml, /<p class="osd-competing-more">\+3 more in this family<\/p>/);

  // Custom maxPeers = 5 -> 5 cards + "+14 more in this family"
  const customHtml = renderCompetingPanel(records[0], familyIndex, { maxPeers: 5 });
  const customCardCount = (customHtml.match(/class="osd-competing-card"/g) ?? []).length;
  assert.equal(customCardCount, 5);
  assert.match(customHtml, /<p class="osd-competing-more">\+14 more in this family<\/p>/);
});

test("renderCompetingPanel: returns empty string when taxclname is missing or series is sole family member", () => {
  const soloRecord = makeRecord({
    key: "SOLO",
    taxclname: "Ashy, glassy, frigid Vitrandic Haplocryands",
  });
  const noTaxRecord = makeRecord({
    key: "NOTAX",
    taxclname: null,
  });
  const emptyTaxRecord = makeRecord({
    key: "EMPTYTAX",
    taxclname: "   ",
  });

  const familyIndex = buildFamilyIndex([soloRecord, noTaxRecord, emptyTaxRecord]);

  assert.equal(renderCompetingPanel(soloRecord, familyIndex), "");
  assert.equal(renderCompetingPanel(noTaxRecord, familyIndex), "");
  assert.equal(renderCompetingPanel(emptyTaxRecord, familyIndex), "");
  assert.equal(renderCompetingPanel(soloRecord, null), "");
  assert.equal(renderCompetingPanel(null, familyIndex), "");
});

test("renderCompetingPanel: escapes HTML special characters in taxclname, series names, status, and href", () => {
  const dangerousFamily = 'Fine <script>alert("xss")</script> & "loamy"';
  const records = [
    makeRecord({
      key: "SELF_SERIES",
      name: "Self & Co",
      status: "Established",
      taxclname: dangerousFamily,
    }),
    makeRecord({
      key: "PEER#1",
      name: 'Peer <"One"> & \'Two\'',
      status: 'Tentative <"test">',
      taxclname: dangerousFamily,
    }),
  ];

  const familyIndex = buildFamilyIndex(records);
  const html = renderCompetingPanel(records[0], familyIndex);

  assert.doesNotMatch(html, /<script>/);
  assert.match(
    html,
    /<p class="osd-competing-family">Fine &lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt; &amp; &quot;loamy&quot;<\/p>/
  );
  assert.match(
    html,
    /<span class="osd-competing-name">Peer &lt;&quot;One&quot;&gt; &amp; &#39;Two&#39;<\/span>/
  );
  assert.match(
    html,
    /title="Peer &lt;&quot;One&quot;&gt; &amp; &#39;Two&#39; \(Tentative &lt;&quot;test&quot;&gt;\)"/
  );
  assert.match(html, /href="\.\.\/P\/PEER%231\.html"/);
});
