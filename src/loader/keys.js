/**
 * Key normalization and relative path helpers for soil series names.
 */

/**
 * Normalize a soil series name into a canonical file/join key.
 * Rules: trim whitespace, uppercase, space -> '_', backtick -> '@', preserve periods.
 *
 * @param {string} name
 * @returns {string}
 */
export function seriesNameToKey(name) {
  if (typeof name !== "string") {
    return "";
  }
  return name
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("`", "@");
}

/**
 * Convert a series key (or name) and extension into `<FIRST_LETTER>/<KEY>.<ext>`.
 *
 * @param {string} key
 * @param {string} ext
 * @returns {string}
 */
export function keyToRelativePath(key, ext) {
  const normalized = seriesNameToKey(key);
  if (!normalized) {
    throw new Error("Series key must be a non-empty string");
  }
  const cleanExt = typeof ext === "string" ? ext.replace(/^\.+/, "").trim() : "";
  if (!cleanExt) {
    throw new Error("File extension must be a non-empty string");
  }
  return `${normalized[0]}/${normalized}.${cleanExt}`;
}
