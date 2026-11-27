import test from "node:test";
import assert from "node:assert/strict";

import { buildSeriesLinkIndex, linkSeriesNames } from "../src/render/cross-links.js";

const SAMPLE_RECORDS = [
  { key: "AMADOR", name: "Amador", letter: "A" },
  { key: "AUBURN", name: "Auburn", letter: "A" },
  { key: "EXCHEQUER", name: "Exchequer", letter: "E" },
  { key: "MT._AIRY", name: "Mt. Airy", letter: "M" },
  { key: "SAN", name: "San", letter: "S" },
  { key: "SAN_JOAQUIN", name: "San Joaquin", letter: "S" },
  { key: "KANA@A", name: "Kana`a", letter: "K" },
  { key: "FINE", name: "Fine", letter: "F" },
  { key: "RED", name: "Red", letter: "R" },
  { key: "DEEP", name: "Deep", letter: "D" },
];

test("buildSeriesLinkIndex: indexes display names, key-derived names, and builds longest-first matcher", () => {
  const index = buildSeriesLinkIndex(SAMPLE_RECORDS);

  assert.ok(index.byUpperName instanceof Map);
  assert.ok(index.matcher instanceof RegExp);

  assert.deepEqual(index.byUpperName.get("AMADOR"), {
    key: "AMADOR",
    letter: "A",
    name: "Amador",
    href: "../A/AMADOR.html",
  });
  assert.equal(index.byUpperName.get("MT. AIRY")?.href, "../M/MT._AIRY.html");
  assert.equal(index.byUpperName.get("SAN JOAQUIN")?.href, "../S/SAN_JOAQUIN.html");
  // Both display name (KANA`A) and key-derived name (KANA@A) are indexed when they differ
  assert.equal(index.byUpperName.get("KANA`A")?.href, "../K/KANA@A.html");
  assert.equal(index.byUpperName.get("KANA@A")?.href, "../K/KANA@A.html");

  // Empty / non-array inputs return empty index with null matcher
  const empty = buildSeriesLinkIndex([]);
  assert.equal(empty.byUpperName.size, 0);
  assert.equal(empty.matcher, null);
});

test("buildSeriesLinkIndex: encodes # and ? while preserving @, ., _, ' in href", () => {
  const index = buildSeriesLinkIndex([
    { key: "O'NEILL#1?A_B.C@D", name: "O'Neill", letter: "O" },
  ]);

  assert.equal(
    index.byUpperName.get("O'NEILL")?.href,
    "../O/O'NEILL%231%3FA_B.C@D.html"
  );
});

test("linkSeriesNames: links single-word, multi-word, and punctuation series", () => {
  const index = buildSeriesLinkIndex(SAMPLE_RECORDS);

  const single = linkSeriesNames("Related to Amador and EXCHEQUER.", index);
  assert.equal(
    single,
    'Related to <a class="osd-series-link" href="../A/AMADOR.html">Amador</a> and <a class="osd-series-link" href="../E/EXCHEQUER.html">EXCHEQUER</a>.'
  );

  const multi = linkSeriesNames(
    "Adjacent to Mt. Airy, San Joaquin, Kana@a, and Kana`a soils.",
    index
  );
  assert.equal(
    multi,
    'Adjacent to <a class="osd-series-link" href="../M/MT._AIRY.html">Mt. Airy</a>, <a class="osd-series-link" href="../S/SAN_JOAQUIN.html">San Joaquin</a>, <a class="osd-series-link" href="../K/KANA@A.html">Kana@a</a>, and <a class="osd-series-link" href="../K/KANA@A.html">Kana`a</a> soils.'
  );
});

test("linkSeriesNames: matches punctuation-adjacent names without swallowing punctuation", () => {
  const index = buildSeriesLinkIndex(SAMPLE_RECORDS);

  const result = linkSeriesNames("Amador, Auburn, and Exchequer soils.", index);
  assert.equal(
    result,
    '<a class="osd-series-link" href="../A/AMADOR.html">Amador</a>, <a class="osd-series-link" href="../A/AUBURN.html">Auburn</a>, and <a class="osd-series-link" href="../E/EXCHEQUER.html">Exchequer</a> soils.'
  );
});

test("linkSeriesNames: excludes selfKey from linking", () => {
  const index = buildSeriesLinkIndex(SAMPLE_RECORDS);

  const result = linkSeriesNames(
    "Amador soils are similar to Auburn and Amador variants.",
    index,
    "AMADOR"
  );
  assert.equal(
    result,
    'Amador soils are similar to <a class="osd-series-link" href="../A/AUBURN.html">Auburn</a> and Amador variants.'
  );
});

test("linkSeriesNames: guards against linking lowercase prose words", () => {
  const index = buildSeriesLinkIndex(SAMPLE_RECORDS);

  const result = linkSeriesNames(
    "These are fine, red, deep soils near Amador and Deep Creek.",
    index
  );
  assert.equal(
    result,
    'These are fine, red, deep soils near <a class="osd-series-link" href="../A/AMADOR.html">Amador</a> and <a class="osd-series-link" href="../D/DEEP.html">Deep</a> Creek.'
  );
});

test("linkSeriesNames: escapes HTML characters in surrounding text and attributes", () => {
  const index = buildSeriesLinkIndex([
    ...SAMPLE_RECORDS,
    { key: "O'NEALS", name: "O'Neals", letter: "O" },
  ]);

  const result = linkSeriesNames(
    `See <script>alert("xss")</script> & 'Amador' and O'Neals.`,
    index
  );
  assert.equal(
    result,
    `See &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;<a class="osd-series-link" href="../A/AMADOR.html">Amador</a>&#39; and <a class="osd-series-link" href="../O/O&#39;NEALS.html">O&#39;Neals</a>.`
  );
});

test("linkSeriesNames: handles multiline text, empty text, and null/empty linkIndex", () => {
  const index = buildSeriesLinkIndex(SAMPLE_RECORDS);

  assert.equal(linkSeriesNames(null, index), "");
  assert.equal(linkSeriesNames(undefined, index), "");
  assert.equal(linkSeriesNames("", index), "");

  const multiline = linkSeriesNames("Line 1: Amador\r\nLine 2: Exchequer & Auburn", index);
  assert.equal(
    multiline,
    'Line 1: <a class="osd-series-link" href="../A/AMADOR.html">Amador</a><br>\nLine 2: <a class="osd-series-link" href="../E/EXCHEQUER.html">Exchequer</a> &amp; <a class="osd-series-link" href="../A/AUBURN.html">Auburn</a>'
  );

  // Repeat call verifies matcher.lastIndex resets cleanly across calls
  assert.equal(
    linkSeriesNames("Amador", index),
    '<a class="osd-series-link" href="../A/AMADOR.html">Amador</a>'
  );

  assert.equal(
    linkSeriesNames("Amador & <Auburn>\nLine 2", null),
    "Amador &amp; &lt;Auburn&gt;<br>\nLine 2"
  );
  assert.equal(
    linkSeriesNames("Amador", { byUpperName: new Map(), matcher: null }),
    "Amador"
  );
});
