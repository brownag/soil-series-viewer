/**
 * Build-time KST 2022 (Keys to Soil Taxonomy, 13th ed.) criteria index generator.
 */

import fs from "node:fs";
import path from "node:path";

export const DEFAULT_KST_DIR = "/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/KST";

/**
 * Create an empty KST criteria index structure.
 *
 * @returns {{ byCode: Map<string, object>, byName: Map<string, object>, codesByName: Map<string, string> }}
 */
function createEmptyIndex() {
  return {
    byCode: new Map(),
    byName: new Map(),
    codesByName: new Map(),
  };
}

/**
 * Find the first non-nullish property value across criteria rows.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} field
 * @returns {unknown}
 */
function firstNonNull(rows, field) {
  for (const row of rows) {
    if (row && row[field] !== null && row[field] !== undefined) {
      return row[field];
    }
  }
  return null;
}

/**
 * Load the KST 2022 codes and English criteria index from disk.
 *
 * Returns an empty index without throwing if either source file is missing.
 *
 * @param {{ kstDir?: string }} [options]
 * @returns {{ byCode: Map<string, object>, byName: Map<string, object>, codesByName: Map<string, string> }}
 */
export function loadKstCriteriaIndex(options = {}) {
  const kstDir = options?.kstDir ?? DEFAULT_KST_DIR;
  const codesPath = path.join(kstDir, "2022_KST_codes.json");
  const criteriaPath = path.join(kstDir, "2022_KST_criteria_EN.json");

  if (!fs.existsSync(codesPath) || !fs.existsSync(criteriaPath)) {
    return createEmptyIndex();
  }

  const codes = JSON.parse(fs.readFileSync(codesPath, "utf8"));
  const criteriaByCode = JSON.parse(fs.readFileSync(criteriaPath, "utf8"));
  const index = createEmptyIndex();

  if (!Array.isArray(codes) || !criteriaByCode || typeof criteriaByCode !== "object") {
    return index;
  }

  for (const item of codes) {
    if (!item || typeof item.code !== "string" || typeof item.name !== "string") {
      continue;
    }

    const { code, name } = item;
    const rows = Array.isArray(criteriaByCode[code]) ? criteriaByCode[code] : [];
    const clauses = [];
    for (const row of rows) {
      if (typeof row?.content === "string") {
        const trimmed = row.content.trim();
        if (trimmed.length > 0) {
          clauses.push(trimmed);
        }
      }
    }

    const entry = {
      code,
      name,
      chapter: firstNonNull(rows, "chapter"),
      page: firstNonNull(rows, "page"),
      key: firstNonNull(rows, "key"),
      clauses,
    };

    const normalizedName = name.trim().toLowerCase();
    index.byCode.set(code, entry);
    index.byName.set(normalizedName, entry);
    index.codesByName.set(normalizedName, code);
  }

  return index;
}

/**
 * Build a JSON-serializable criteria payload sorted by code, optionally filtered to usedCodes.
 *
 * @param {{ byCode: Map<string, object> }} criteriaIndex
 * @param {Set<string>|Array<string>|null} [usedCodes]
 * @returns {Record<string, object>}
 */
export function buildKstCriteriaPayload(criteriaIndex, usedCodes = null) {
  const byCode = criteriaIndex?.byCode;
  if (!(byCode instanceof Map)) {
    return {};
  }

  let candidateCodes;
  if (usedCodes === null || usedCodes === undefined) {
    candidateCodes = [...byCode.keys()];
  } else {
    const allowed = usedCodes instanceof Set ? usedCodes : new Set(usedCodes);
    candidateCodes = [];
    for (const code of allowed) {
      if (byCode.has(code)) {
        candidateCodes.push(code);
      }
    }
  }

  candidateCodes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const payload = {};
  for (const code of candidateCodes) {
    const entry = byCode.get(code);
    payload[code] = {
      code: entry.code,
      name: entry.name,
      chapter: entry.chapter,
      page: entry.page,
      key: entry.key,
      clauses: [...entry.clauses],
    };
  }

  return payload;
}
