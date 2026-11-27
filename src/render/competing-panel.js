/**
 * Build-time Same-Family Competing-Series Panel renderer.
 * Groups soil series by normalized taxonomic family (`sc.taxclname`) and
 * renders an HTML section linking to competing peers with mini SVG color strips.
 */

import { renderStripSvg } from "../client/strip-svg.js";
import { buildColorStripShards } from "../index/color-strips.js";
import { resolveShardLetter } from "../index/search-index.js";
import { escapeHtml } from "./series-page.js";

/**
 * Encode one URL path segment safely while preserving `@`, `.`, `_`, and `'`.
 *
 * @param {unknown} value
 * @returns {string}
 */
function encodeHrefPart(value) {
  return encodeURI(String(value ?? "")).replaceAll("#", "%23").replaceAll("?", "%3F");
}

/**
 * Normalize a taxonomic family (`sc.taxclname`) string for grouping/lookup.
 *
 * @param {unknown} taxclname
 * @returns {string}
 */
export function normalizeTaxonomicFamily(taxclname) {
  if (typeof taxclname !== "string") {
    return "";
  }
  return taxclname.trim().toLowerCase();
}

/**
 * Build an index mapping normalized taxonomic family strings to sorted arrays
 * of peer series descriptors with precomputed compact strip horizons.
 *
 * @param {Array<Record<string, any>>} records
 * @returns {Map<string, Array<{ key: string, letter: string, name: string, status: string, href: string, stripHorizons: Array<{ t: number, b: number, hex: string, n: string }> }>>}
 */
export function buildFamilyIndex(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("records must be an array");
  }

  const stripShards = buildColorStripShards(records);
  const familyIndex = new Map();

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const familyKey = normalizeTaxonomicFamily(record.sc?.taxclname);
    if (!familyKey) {
      continue;
    }

    const key =
      typeof record.key === "string" && record.key.length > 0
        ? record.key
        : typeof record.name === "string"
          ? record.name
          : "";
    if (!key) {
      continue;
    }

    const letter = resolveShardLetter(record);
    const name =
      typeof record.name === "string" && record.name.length > 0 ? record.name : key;
    const status =
      typeof record.status === "string"
        ? record.status
        : typeof record.sc?.soilseriesstatus === "string"
          ? record.sc.soilseriesstatus
          : "";
    const href = `../${encodeHrefPart(letter)}/${encodeHrefPart(key)}.html`;
    const stripHorizons = stripShards[letter]?.[key] ?? [];

    let peers = familyIndex.get(familyKey);
    if (!peers) {
      peers = [];
      familyIndex.set(familyKey, peers);
    }

    peers.push({
      key,
      letter,
      name,
      status,
      href,
      stripHorizons,
    });
  }

  for (const peers of familyIndex.values()) {
    peers.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
      return cmp !== 0 ? cmp : a.key.localeCompare(b.key);
    });
  }

  return familyIndex;
}

/**
 * Render the Same-Family Competing-Series panel HTML for a soil series record.
 * Returns `""` when the series has no taxonomic family or no competing peers.
 *
 * @param {Record<string, any>} record
 * @param {Map<string, Array<Record<string, any>>>|null|undefined} familyIndex
 * @param {object} [options]
 * @param {number} [options.maxPeers=16]
 * @returns {string}
 */
export function renderCompetingPanel(record, familyIndex, options = {}) {
  const familyKey = normalizeTaxonomicFamily(record?.sc?.taxclname);
  if (!familyKey || !(familyIndex instanceof Map) || !familyIndex.has(familyKey)) {
    return "";
  }

  const selfKey = typeof record?.key === "string" ? record.key : "";
  const allPeers = familyIndex.get(familyKey) ?? [];
  const peers = allPeers.filter((peer) => peer.key !== selfKey);
  if (peers.length === 0) {
    return "";
  }

  const opts = options && typeof options === "object" ? options : {};
  const maxPeers =
    typeof opts.maxPeers === "number" && Number.isFinite(opts.maxPeers) && opts.maxPeers > 0
      ? Math.floor(opts.maxPeers)
      : 16;

  const visible = peers.slice(0, maxPeers);
  const remaining = peers.length - visible.length;

  const cardsHtml = visible
    .map((peer) => {
      const stripSvg = renderStripSvg(peer.stripHorizons, { width: 28, height: 72 });
      return (
        `<a class="osd-competing-card" href="${escapeHtml(peer.href)}" ` +
        `title="${escapeHtml(peer.name)} (${escapeHtml(peer.status || "")})">` +
        `<span class="osd-competing-strip">${stripSvg}</span>` +
        `<span class="osd-competing-name">${escapeHtml(peer.name)}</span>` +
        `</a>`
      );
    })
    .join("\n      ");

  const moreHtml =
    remaining > 0
      ? `\n    <p class="osd-competing-more">+${remaining} more in this family</p>`
      : "";

  return [
    `  <section class="osd-section osd-competing-panel" id="same-family-series">`,
    `    <h2 class="osd-competing-heading">Same Taxonomic Family (${peers.length} competing ${peers.length === 1 ? "series" : "series"})</h2>`,
    `    <p class="osd-competing-family">${escapeHtml(record.sc.taxclname)}</p>`,
    `    <div class="osd-competing-grid">`,
    `      ${cardsHtml}`,
    `    </div>${moreHtml}`,
    `  </section>`,
  ].join("\n");
}
