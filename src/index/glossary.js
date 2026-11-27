/**
 * Build-time glossary and diagnostic features index generator.
 * Merges SKB KST 2014 featurelist entries with DST glossary definitions.
 */

import fs from "node:fs";

export const DEFAULT_FEATURELIST_PATH =
  process.env.OSD_FEATURELIST_PATH ||
  "/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/KST/2014_KST_EN_featurelist.json";

export const DEFAULT_DST_DATA_PATH =
  process.env.OSD_DST_DATA_PATH ||
  "/home/andrew/workspace/DST/data/dst-data.json";

/**
 * Convert a glossary term into a stable lowercase kebab-case HTML anchor ID.
 *
 * @param {string} term
 * @returns {string}
 */
export function slugifyTerm(term) {
  if (typeof term !== "string") {
    return "";
  }
  return term
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Read and parse a JSON file if it exists; return null when missing.
 *
 * @param {unknown} filePath
 * @returns {unknown}
 */
function readJsonOptional(filePath) {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Case-insensitive alphabetical comparator with deterministic tie-breaker.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareAlphabetical(a, b) {
  return (
    a.localeCompare(b, "en", { sensitivity: "base" }) ||
    a.localeCompare(b, "en")
  );
}

/**
 * Insert or merge a normalized glossary term record into the accumulator map.
 *
 * @param {Map<string, {
 *   id: string,
 *   term: string,
 *   group: string,
 *   chapter: number|null,
 *   page: number|null,
 *   definition: string,
 *   sources: string[],
 * }>} byKey
 * @param {{
 *   term: string,
 *   group: string,
 *   chapter: number|null,
 *   page: number|null,
 *   definition: string,
 *   source: string,
 * }} entry
 */
function mergeTermEntry(byKey, entry) {
  const key = entry.term.trim().toLowerCase();
  const existing = byKey.get(key);
  if (!existing) {
    byKey.set(key, {
      id: slugifyTerm(entry.term),
      term: entry.term,
      group: entry.group,
      chapter: entry.chapter,
      page: entry.page,
      definition: entry.definition,
      sources: [entry.source],
    });
    return;
  }

  if (!existing.sources.includes(entry.source)) {
    existing.sources.push(entry.source);
  }
  if (entry.definition.length > existing.definition.length) {
    existing.definition = entry.definition;
  }
}

/**
 * Build the merged glossary and diagnostic-features index from SKB KST 2014
 * featurelist and DST glossary data.
 *
 * @param {{ featurelistPath?: string|null, dstDataPath?: string|null }} [options]
 * @returns {{
 *   totalTerms: number,
 *   groups: string[],
 *   terms: Array<{
 *     id: string,
 *     term: string,
 *     group: string,
 *     chapter: number|null,
 *     page: number|null,
 *     definition: string,
 *     sources: string[],
 *   }>,
 * }}
 */
export function buildGlossaryIndex(options = {}) {
  const {
    featurelistPath = DEFAULT_FEATURELIST_PATH,
    dstDataPath = DEFAULT_DST_DATA_PATH,
  } = options ?? {};

  const byKey = new Map();

  const featurelist = readJsonOptional(featurelistPath);
  if (Array.isArray(featurelist)) {
    for (const item of featurelist) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const term = typeof item.name === "string" ? item.name.trim() : "";
      if (!term) {
        continue;
      }
      const group =
        typeof item.group === "string" && item.group.trim().length > 0
          ? item.group.trim()
          : "Glossary";
      const chapter = Number.isFinite(item.chapter) ? item.chapter : null;
      const page = Number.isFinite(item.page) ? item.page : null;
      const definition =
        typeof item.description === "string" ? item.description.trim() : "";

      mergeTermEntry(byKey, {
        term,
        group,
        chapter,
        page,
        definition,
        source: "SKB-KST-2014",
      });
    }
  }

  const dstData = readJsonOptional(dstDataPath);
  const rawGlossary =
    dstData && typeof dstData === "object" && dstData.glossary && typeof dstData.glossary === "object"
      ? Array.isArray(dstData.glossary)
        ? dstData.glossary
        : Object.values(dstData.glossary)
      : null;

  if (Array.isArray(rawGlossary)) {
    for (const item of rawGlossary) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const term = typeof item.term === "string" ? item.term.trim() : "";
      if (!term) {
        continue;
      }
      const definition =
        typeof item.definition === "string" ? item.definition.trim() : "";

      mergeTermEntry(byKey, {
        term,
        group: "Glossary",
        chapter: null,
        page: null,
        definition,
        source: "DST",
      });
    }
  }

  const terms = Array.from(byKey.values()).sort((a, b) =>
    compareAlphabetical(a.term, b.term)
  );
  const usedIds = new Set();
  for (const entry of terms) {
    const baseId = entry.id || "term";
    let candidate = baseId;
    let suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = `${baseId}-${suffix++}`;
    }
    entry.id = candidate;
    usedIds.add(candidate);
  }
  const groups = Array.from(new Set(terms.map((t) => t.group))).sort(
    compareAlphabetical
  );

  return {
    totalTerms: terms.length,
    groups,
    terms,
  };
}
