/**
 * Build-time USDA Soil Taxonomy hierarchy tree and breadcrumb generator.
 */

import { resolveShardLetter } from "./search-index.js";

const TAXON_RANKS = [
  { rank: "order", field: "taxorder" },
  { rank: "suborder", field: "taxsuborder" },
  { rank: "greatgroup", field: "taxgrtgroup" },
  { rank: "subgroup", field: "taxsubgrp" },
  { rank: "family", field: "taxclname" },
];

const BREADCRUMB_RANKS = TAXON_RANKS.slice(0, 4);

/**
 * Convert a taxon name to a lowercase kebab-case slug.
 *
 * @param {unknown} name
 * @returns {string}
 */
export function slugifyTaxon(name) {
  if (typeof name !== "string") {
    return "";
  }
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalize an optional taxon string field to a trimmed non-empty string or null.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function cleanTaxonValue(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Look up a KST 2022 code by lowercase taxon name from a Map or plain object.
 *
 * @param {Map<string, string>|Record<string, string>|null|undefined} kstCodesByName
 * @param {string} taxonName
 * @returns {string|null}
 */
function lookupKstCode(kstCodesByName, taxonName) {
  if (!kstCodesByName || typeof taxonName !== "string") {
    return null;
  }
  const key = taxonName.trim().toLowerCase();
  if (!key) {
    return null;
  }

  let code;
  if (kstCodesByName instanceof Map) {
    code = kstCodesByName.get(key);
  } else if (typeof kstCodesByName === "object") {
    code = Object.hasOwn(kstCodesByName, key) ? kstCodesByName[key] : null;
  }

  return typeof code === "string" && code.length > 0 ? code : null;
}

/**
 * Case-insensitive alphabetical string comparator with deterministic tie-breaking.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareCaseInsensitive(a, b) {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al < bl) return -1;
  if (al > bl) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Extract contiguous taxonomic path from an SC record, stopping at the first missing rank.
 *
 * @param {Record<string, unknown>|null|undefined} sc
 * @param {Array<{ rank: string, field: string }>} ranks
 * @returns {Array<{ rank: string, name: string }>}
 */
function extractTaxonPath(sc, ranks) {
  if (!sc || typeof sc !== "object") {
    return [];
  }
  const path = [];
  for (const { rank, field } of ranks) {
    const name = cleanTaxonValue(sc[field]);
    if (!name) {
      break;
    }
    path.push({ rank, name });
  }
  return path;
}

/**
 * Build a compact series summary entry for leaf/deepest-level attachment.
 *
 * @param {Record<string, any>} record
 * @returns {{ k: string, n: string, l: string, s: string|null }}
 */
function buildSeriesSummary(record) {
  const sc = record.sc ?? null;
  const k = typeof record.key === "string" ? record.key : "";
  const n = typeof record.name === "string" && record.name.length > 0 ? record.name : k;
  const l = resolveShardLetter(record);
  const rawStatus = record.status ?? sc?.soilseriesstatus;
  const s = typeof rawStatus === "string" && rawStatus.length > 0 ? rawStatus : null;
  return { k, n, l, s };
}

/**
 * Convert an internal mutable tree node into the sorted public output shape.
 *
 * @param {object} internalNode
 * @returns {object}
 */
function finalizeNode(internalNode) {
  const node = {
    name: internalNode.name,
    slug: internalNode.slug,
    rank: internalNode.rank,
    code: internalNode.code,
    count: internalNode.count,
  };

  if (internalNode.childrenMap.size > 0) {
    node.children = Array.from(internalNode.childrenMap.values())
      .map(finalizeNode)
      .sort((a, b) => compareCaseInsensitive(a.name, b.name));
  }

  if (internalNode.series.length > 0) {
    node.series = [...internalNode.series].sort(
      (a, b) => compareCaseInsensitive(a.n, b.n) || compareCaseInsensitive(a.k, b.k)
    );
  }

  return node;
}

/**
 * Build the 5-rank USDA Soil Taxonomy tree from joined corpus records.
 *
 * @param {Array<Record<string, any>>} records
 * @param {object} [options]
 * @param {Map<string, string>|Record<string, string>|null} [options.kstCodesByName]
 * @returns {{ totalSeries: number, classifiedSeries: number, orders: Array<object> }}
 */
export function buildTaxonomyTree(records, options = {}) {
  if (!Array.isArray(records)) {
    throw new TypeError("records must be an array");
  }

  const kstCodesByName = options?.kstCodesByName ?? null;
  const orderMap = new Map();
  let classifiedSeries = 0;

  for (const record of records) {
    if (!record || typeof record !== "object") {
      throw new TypeError("Each record must be an object");
    }

    const path = extractTaxonPath(record.sc, TAXON_RANKS);
    if (path.length === 0) {
      continue;
    }

    classifiedSeries++;
    let currentMap = orderMap;
    let deepestNode = null;

    for (const { rank, name } of path) {
      let node = currentMap.get(name);
      if (!node) {
        node = {
          name,
          slug: slugifyTaxon(name),
          rank,
          code: lookupKstCode(kstCodesByName, name),
          count: 0,
          childrenMap: new Map(),
          series: [],
        };
        currentMap.set(name, node);
      }
      node.count++;
      currentMap = node.childrenMap;
      deepestNode = node;
    }

    deepestNode.series.push(buildSeriesSummary(record));
  }

  const orders = Array.from(orderMap.values())
    .map(finalizeNode)
    .sort((a, b) => compareCaseInsensitive(a.name, b.name));

  return {
    totalSeries: records.length,
    classifiedSeries,
    orders,
  };
}

/**
 * Build taxonomy breadcrumb items (order -> suborder -> greatgroup -> subgroup)
 * for a single series record, stopping at the first missing rank.
 *
 * @param {Record<string, any>|null|undefined} record
 * @param {Map<string, string>|Record<string, string>|null} [kstCodesByName]
 * @returns {Array<{ rank: string, name: string, slug: string, hashPath: string, code: string|null }>}
 */
export function buildTaxonBreadcrumb(record, kstCodesByName = null) {
  const path = extractTaxonPath(record?.sc, BREADCRUMB_RANKS);
  if (path.length === 0) {
    return [];
  }

  const slugs = [];
  return path.map(({ rank, name }) => {
    const slug = slugifyTaxon(name);
    slugs.push(slug);
    return {
      rank,
      name,
      slug,
      hashPath: slugs.join("/"),
      code: lookupKstCode(kstCodesByName, name),
    };
  });
}
