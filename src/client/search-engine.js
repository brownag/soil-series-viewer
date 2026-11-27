/**
 * Pure ESM client-side search and facet filter engine for soil-series-viewer.
 * Zero Node-only imports: runs natively in browsers and `node:test`.
 */

/**
 * Maps public facet names to compact `search-index.json` item keys.
 */
export const FACET_KEY_MAP = Object.freeze({
  status: "s",
  order: "o",
  suborder: "so",
  grtgroup: "gg",
  subgrp: "sg",
  partsize: "ps",
  minalogy: "mn",
  ceactcl: "ce",
  reaction: "rx",
  tempcl: "tc",
  state: "st",
  mlraoffice: "mo",
  benchmark: "bm",
});

const FACET_ENTRIES = Object.entries(FACET_KEY_MAP);
const WILDCARD_REGEX_CACHE = new Map();

function escapeRegexChar(ch) {
  return ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function getWildcardMatcher(upperQuery) {
  let cached = WILDCARD_REGEX_CACHE.get(upperQuery);
  if (cached) {
    return cached;
  }

  let pattern = "^";
  for (let i = 0; i < upperQuery.length; i++) {
    const ch = upperQuery[i];
    if (ch === "*") {
      pattern += ".*";
    } else if (ch === "?") {
      pattern += ".";
    } else {
      pattern += escapeRegexChar(ch);
    }
  }
  pattern += "$";

  cached = {
    regex: new RegExp(pattern),
    startsWithLiteral: upperQuery[0] !== "*" && upperQuery[0] !== "?",
  };

  if (WILDCARD_REGEX_CACHE.size >= 64) {
    WILDCARD_REGEX_CACHE.clear();
  }
  WILDCARD_REGEX_CACHE.set(upperQuery, cached);
  return cached;
}

/**
 * Score a series name against a search query.
 * Ranking tiers (higher is better; 0 means no match):
 * - Exact match: 1000
 * - Prefix match: 710..850
 * - Wildcard (`*`, `?`) anchored match: 510..750
 * - Substring match: 350..546
 * - Subsequence fuzzy match: 1..299
 * - Empty query on non-empty name: 1
 *
 * @param {string} name
 * @param {string} query
 * @returns {number}
 */
export function matchName(name, query) {
  if (typeof name !== "string" || name.length === 0) {
    return 0;
  }

  const trimmed = typeof query === "string" ? query.trim() : "";
  if (trimmed.length === 0) {
    return 1;
  }

  const upperName = name.toUpperCase();
  const upperQuery = trimmed.toUpperCase();

  if (upperQuery.includes("*") || upperQuery.includes("?")) {
    const { regex, startsWithLiteral } = getWildcardMatcher(upperQuery);
    if (!regex.test(upperName)) {
      return 0;
    }
    return startsWithLiteral ? 700 : 600;
  }

  if (upperName === upperQuery) {
    return 1000;
  }

  if (upperName.startsWith(upperQuery)) {
    return 850 - Math.min(140, upperName.length - upperQuery.length);
  }

  const subIdx = upperName.indexOf(upperQuery);
  if (subIdx !== -1) {
    return (
      550 -
      Math.min(100, subIdx * 4) -
      Math.min(100, upperName.length - upperQuery.length)
    );
  }

  // Subsequence fuzzy match: every query character appears in order in upperName.
  let qi = 0;
  let firstIdx = -1;
  let lastIdx = -1;
  let prevIdx = -1;
  let consecutive = 0;

  for (let ni = 0; ni < upperName.length && qi < upperQuery.length; ni++) {
    if (upperName[ni] === upperQuery[qi]) {
      if (firstIdx === -1) {
        firstIdx = ni;
      }
      if (prevIdx !== -1 && ni === prevIdx + 1) {
        consecutive++;
      }
      prevIdx = ni;
      lastIdx = ni;
      qi++;
    }
  }

  if (qi < upperQuery.length) {
    return 0;
  }

  const span = lastIdx - firstIdx + 1;
  const gaps = span - upperQuery.length;
  const startBonus = firstIdx === 0 ? 40 : 0;
  const rawScore =
    200 +
    startBonus +
    consecutive * 15 -
    gaps * 5 -
    Math.max(0, upperName.length - upperQuery.length);

  return Math.max(1, Math.min(299, rawScore));
}

function buildActiveFacetPredicates(facets) {
  const predicates = [];
  if (!facets || typeof facets !== "object") {
    return predicates;
  }

  for (const [facetName, itemKey] of FACET_ENTRIES) {
    const rawVal = facets[facetName];
    if (rawVal === undefined || rawVal === null || rawVal === "") {
      continue;
    }

    if (facetName === "benchmark") {
      if (rawVal === true || rawVal === "true") {
        predicates.push((item) => item?.[itemKey] === true);
      }
      continue;
    }

    if (Array.isArray(rawVal) || rawVal instanceof Set) {
      const allowed = new Set(
        Array.from(rawVal).filter((v) => v !== undefined && v !== null && v !== "")
      );
      if (allowed.size > 0) {
        predicates.push((item) => allowed.has(item?.[itemKey]));
      }
      continue;
    }

    predicates.push((item) => item?.[itemKey] === rawVal);
  }

  return predicates;
}

/**
 * Filter compact series items by active facets and name query,
 * ranked by `matchName` score descending with alphabetical tie-break on `item.n`.
 *
 * @param {Array<Record<string, unknown>>} items
 * @param {{ query?: string, facets?: Record<string, unknown> }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function filterSeries(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const { query = "", facets = {} } = options ?? {};
  const trimmedQuery = typeof query === "string" ? query.trim() : "";
  const hasQuery = trimmedQuery.length > 0;
  const predicates = buildActiveFacetPredicates(facets);

  const scored = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      continue;
    }

    let facetOk = true;
    for (let p = 0; p < predicates.length; p++) {
      if (!predicates[p](item)) {
        facetOk = false;
        break;
      }
    }
    if (!facetOk) {
      continue;
    }

    const name = typeof item.n === "string" ? item.n : "";
    const score = hasQuery ? matchName(name, trimmedQuery) : 1;
    if (score <= 0) {
      continue;
    }

    scored.push({
      item,
      score,
      name,
      upperName: name.toUpperCase(),
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.upperName < b.upperName) {
      return -1;
    }
    if (a.upperName > b.upperName) {
      return 1;
    }
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });

  return scored.map((entry) => entry.item);
}

/**
 * Compute per-facet value counts for the currently filtered items.
 *
 * @param {Array<Record<string, unknown>>} items
 * @returns {Record<string, Record<string, number>>}
 */
export function computeFacetCounts(items) {
  const counts = {};
  for (const [facetName] of FACET_ENTRIES) {
    counts[facetName] = {};
  }

  if (!Array.isArray(items) || items.length === 0) {
    return counts;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      continue;
    }

    for (let f = 0; f < FACET_ENTRIES.length; f++) {
      const [facetName, itemKey] = FACET_ENTRIES[f];
      const val = item[itemKey];
      if (val === null || val === undefined || val === "") {
        continue;
      }
      const key = String(val);
      const bucket = counts[facetName];
      bucket[key] = (bucket[key] || 0) + 1;
    }
  }

  return counts;
}
