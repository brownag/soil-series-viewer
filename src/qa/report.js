/**
 * Deterministic QA summary report builder for corpus-wide issue aggregation.
 */

/**
 * Look up the issue list for a series key from a Map or plain object.
 *
 * @param {Map<string, Array<object>> | Record<string, Array<object>> | null | undefined} issuesByKey
 * @param {string} key
 * @returns {Array<object> | undefined}
 */
function lookupIssues(issuesByKey, key) {
  if (!issuesByKey) {
    return undefined;
  }
  if (issuesByKey instanceof Map) {
    return issuesByKey.get(key);
  }
  if (typeof issuesByKey === "object" && Object.hasOwn(issuesByKey, key)) {
    return issuesByKey[key];
  }
  return undefined;
}

/**
 * Aggregate per-series QA issues into a deterministic report object.
 *
 * @param {Array<{ key: string }>} records
 * @param {Map<string, Array<{ code: string }>> | Record<string, Array<{ code: string }>>} issuesByKey
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {{
 *   generatedAt: string,
 *   totalRecords: number,
 *   recordsWithIssues: number,
 *   countsByCode: Record<string, number>,
 *   seriesByCode: Record<string, string[]>,
 * }}
 */
export function buildQaReport(records, issuesByKey, options = {}) {
  if (!Array.isArray(records)) {
    throw new TypeError("records must be an array");
  }

  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const seriesSetsByCode = new Map();
  let recordsWithIssues = 0;

  for (const record of records) {
    const key = record?.key;
    if (typeof key !== "string" || key.length === 0) {
      continue;
    }

    const issues = lookupIssues(issuesByKey, key);
    if (!Array.isArray(issues) || issues.length === 0) {
      continue;
    }

    recordsWithIssues++;

    for (const issue of issues) {
      const code = issue?.code;
      if (typeof code !== "string" || code.length === 0) {
        continue;
      }
      let set = seriesSetsByCode.get(code);
      if (!set) {
        set = new Set();
        seriesSetsByCode.set(code, set);
      }
      set.add(key);
    }
  }

  const sortedCodes = Array.from(seriesSetsByCode.keys()).sort();
  const countsByCode = {};
  const seriesByCode = {};

  for (const code of sortedCodes) {
    const sortedSeries = Array.from(seriesSetsByCode.get(code)).sort();
    countsByCode[code] = sortedSeries.length;
    seriesByCode[code] = sortedSeries;
  }

  return {
    generatedAt,
    totalRecords: records.length,
    recordsWithIssues,
    countsByCode,
    seriesByCode,
  };
}
