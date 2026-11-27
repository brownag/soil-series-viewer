/**
 * Build-time compact search index and facet list generator.
 */

const FACET_FIELDS = [
  ["status", "s"],
  ["order", "o"],
  ["suborder", "so"],
  ["grtgroup", "gg"],
  ["subgrp", "sg"],
  ["partsize", "ps"],
  ["minalogy", "mn"],
  ["ceactcl", "ce"],
  ["reaction", "rx"],
  ["tempcl", "tc"],
  ["state", "st"],
  ["mlraoffice", "mo"],
];

/**
 * Normalize a series record's leading shard letter to A-Z or "_" fallback.
 *
 * @param {Record<string, unknown>} record
 * @returns {string}
 */
export function resolveShardLetter(record) {
  const candidate =
    typeof record?.letter === "string" && record.letter.trim().length > 0
      ? record.letter
      : typeof record?.key === "string" && record.key.trim().length > 0
        ? record.key
        : typeof record?.name === "string"
          ? record.name
          : "";
  const first = candidate.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "_";
}

/**
 * Convert an optional string field to null when missing or empty.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function cleanFacetValue(value) {
  if (typeof value !== "string") {
    return null;
  }
  return value.length > 0 ? value : null;
}

/**
 * Parse SCDB benchmarksoilflag ("TRUE"/"FALSE" or boolean) to a strict boolean.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function parseBenchmarkFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toUpperCase() === "TRUE";
  }
  return false;
}

/**
 * Build the client-side search index payload from joined corpus records.
 *
 * @param {Array<Record<string, any>>} records
 * @returns {{ version: number, total: number, facets: Record<string, string[]>, items: Array<Record<string, unknown>> }}
 */
export function buildSearchIndex(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("records must be an array");
  }

  const facetSets = Object.fromEntries(FACET_FIELDS.map(([name]) => [name, new Set()]));
  const items = [];

  for (const record of records) {
    if (!record || typeof record !== "object") {
      throw new TypeError("Each record must be an object");
    }

    const sc = record.sc ?? null;
    const key = typeof record.key === "string" ? record.key : "";
    const name = typeof record.name === "string" && record.name.length > 0 ? record.name : key;

    const item = {
      k: key,
      n: name,
      l: resolveShardLetter(record),
      s: cleanFacetValue(record.status ?? sc?.soilseriesstatus),
      o: cleanFacetValue(sc?.taxorder),
      so: cleanFacetValue(sc?.taxsuborder),
      gg: cleanFacetValue(sc?.taxgrtgroup),
      sg: cleanFacetValue(sc?.taxsubgrp),
      ps: cleanFacetValue(sc?.taxpartsize),
      mn: cleanFacetValue(sc?.taxminalogy),
      ce: cleanFacetValue(sc?.taxceactcl),
      rx: cleanFacetValue(sc?.taxreaction),
      tc: cleanFacetValue(sc?.taxtempcl),
      st: cleanFacetValue(sc?.areasymbol),
      mo: cleanFacetValue(sc?.mlraoffice),
      bm: parseBenchmarkFlag(sc?.benchmarksoilflag),
      hasSkb: Boolean(record.hasSkb ?? record.skb),
    };

    for (const [facetName, itemKey] of FACET_FIELDS) {
      const value = item[itemKey];
      if (value !== null) {
        facetSets[facetName].add(value);
      }
    }

    items.push(item);
  }

  const facets = Object.fromEntries(
    FACET_FIELDS.map(([facetName]) => [facetName, Array.from(facetSets[facetName]).sort()])
  );

  return {
    version: 1,
    total: items.length,
    facets,
    items,
  };
}
