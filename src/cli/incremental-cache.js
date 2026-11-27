/**
 * Per-series incremental build cache for `src/cli/build.js` (G14).
 * Hashes each series's joined input record + templateVersion and skips
 * re-rendering unchanged series pages whose HTML already exists on disk.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export const CACHE_SCHEMA_VERSION = 1;
export const DEFAULT_TEMPLATE_VERSION = "v1";

/**
 * Compute a deterministic SHA-256 hash for a joined series record and template version.
 *
 * @param {Record<string, unknown>} record
 * @param {string} [templateVersion=DEFAULT_TEMPLATE_VERSION]
 * @returns {string}
 */
export function computeSeriesHash(record, templateVersion = DEFAULT_TEMPLATE_VERSION) {
  const hash = crypto.createHash("sha256");
  hash.update(String(CACHE_SCHEMA_VERSION));
  hash.update("\0");
  hash.update(String(templateVersion ?? DEFAULT_TEMPLATE_VERSION));
  hash.update("\0");
  hash.update(
    JSON.stringify({
      key: record?.key ?? null,
      name: record?.name ?? null,
      sc: record?.sc ?? null,
      skb: record?.skb ?? null,
      horizons: record?.horizons ?? null,
    })
  );
  return hash.digest("hex");
}

/**
 * Load an existing build cache manifest from disk, returning an empty cache if
 * missing, corrupt, or from a different schema version.
 *
 * @param {string} cachePath
 * @returns {{ schemaVersion: number, templateVersion: string, hashes: Record<string, string> }}
 */
export function loadBuildCache(cachePath) {
  const empty = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    templateVersion: DEFAULT_TEMPLATE_VERSION,
    hashes: {},
  };
  if (typeof cachePath !== "string" || !fs.existsSync(cachePath)) {
    return empty;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (
      !raw ||
      typeof raw !== "object" ||
      raw.schemaVersion !== CACHE_SCHEMA_VERSION ||
      !raw.hashes ||
      typeof raw.hashes !== "object"
    ) {
      return empty;
    }
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      templateVersion:
        typeof raw.templateVersion === "string"
          ? raw.templateVersion
          : DEFAULT_TEMPLATE_VERSION,
      hashes: { ...raw.hashes },
    };
  } catch {
    return empty;
  }
}

/**
 * Persist a build cache manifest to disk (creating parent directories as needed).
 *
 * @param {string} cachePath
 * @param {{ schemaVersion?: number, templateVersion?: string, hashes: Record<string, string> }} cache
 * @returns {Promise<void>}
 */
export async function saveBuildCache(cachePath, cache) {
  await fsp.mkdir(path.dirname(cachePath), { recursive: true });
  const payload = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    templateVersion: cache?.templateVersion ?? DEFAULT_TEMPLATE_VERSION,
    hashes: cache?.hashes ?? {},
  };
  await fsp.writeFile(cachePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

/**
 * Decide whether a series page must be rebuilt.
 * Returns `false` (skip) only when the cached hash matches AND `outHtmlPath` exists on disk.
 *
 * @param {string} key
 * @param {string} hash
 * @param {{ hashes?: Record<string, string> } | null | undefined} cache
 * @param {string} outHtmlPath
 * @returns {boolean}
 */
export function shouldRebuildSeries(key, hash, cache, outHtmlPath) {
  if (!cache || !cache.hashes || typeof key !== "string") {
    return true;
  }
  if (cache.hashes[key] !== hash) {
    return true;
  }
  return !fs.existsSync(outHtmlPath);
}
