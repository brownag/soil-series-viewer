/**
 * Normalization helpers for SoilKnowledgeBase (SKB) OSD JSON documents.
 * Handles SKB-1 (nested SITE/HORIZONS lists), SKB-12 (leading section header
 * prefixes), and SKB-17 ("NA" string placeholders).
 */

/**
 * Recursively convert string "NA" values to null (SKB-17).
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function naToNull(value) {
  if (value === "NA") {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(naToNull);
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = naToNull(v);
    }
    return out;
  }
  return value;
}

/**
 * Unwrap SKB-1 nested list shapes (`[[...]]` -> `[...]`) and discard empty
 * placeholder objects (`[{}]` -> `[]`).
 *
 * @param {unknown} value
 * @returns {Array<Record<string, unknown>>}
 */
export function unwrapNestedList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = value.length === 1 && Array.isArray(value[0]) ? value[0] : value;
  return items.filter(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      Object.keys(item).length > 0
  );
}

/**
 * Strip leading `<SECTION_HEADER>:` prefix from a section's content (SKB-12).
 * Handles SKB-11 joined headers (`"A & B"`) by checking the leading header part
 * as well as the full section name and outer key.
 *
 * @param {string|null} content
 * @param {string|null} sectionName
 * @param {string|null} sectionKey
 * @returns {string|null}
 */
export function stripSectionHeaderPrefix(content, sectionName, sectionKey = null) {
  if (typeof content !== "string") {
    return content;
  }
  const candidates = [];
  if (typeof sectionName === "string" && sectionName.length > 0) {
    candidates.push(sectionName);
    if (sectionName.includes(" & ")) {
      candidates.push(sectionName.split(" & ")[0]);
    }
  }
  if (typeof sectionKey === "string" && sectionKey.length > 0 && !candidates.includes(sectionKey)) {
    candidates.push(sectionKey);
  }

  for (const header of candidates) {
    const prefix = `${header}:`;
    if (content.startsWith(prefix)) {
      return content.slice(prefix.length).replace(/^[ \t]*\r?\n?/, "");
    }
  }
  return content;
}

/**
 * Check whether a value is a section object `{ section, content }`.
 *
 * @param {unknown} value
 * @returns {value is { section: string|null, content: string|null }}
 */
function isSectionObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "section" in value &&
    "content" in value
  );
}

/**
 * Normalize a parsed SKB JSON document without mutating the input.
 * Applies SKB-17 ("NA" -> null), SKB-1 (unwrap SITE & HORIZONS), and
 * SKB-12 (strip leading section header prefixes).
 *
 * @param {Record<string, unknown>} rawDoc
 * @returns {Record<string, unknown>}
 */
export function normalizeSkbDoc(rawDoc) {
  if (rawDoc === null || typeof rawDoc !== "object" || Array.isArray(rawDoc)) {
    throw new TypeError("SKB document must be a plain object");
  }

  const normalized = naToNull(rawDoc);

  for (const [key, value] of Object.entries(normalized)) {
    if (key === "HORIZONS" || key === "SITE") {
      normalized[key] = unwrapNestedList(value);
    } else if (isSectionObject(value)) {
      normalized[key] = {
        ...value,
        content: stripSectionHeaderPrefix(value.content, value.section, key),
      };
    }
  }

  if (!("HORIZONS" in normalized)) {
    normalized.HORIZONS = [];
  }
  if (!("SITE" in normalized)) {
    normalized.SITE = [];
  }

  return normalized;
}
