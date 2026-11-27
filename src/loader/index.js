import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { seriesNameToKey, keyToRelativePath } from "./keys.js";
import { normalizeSkbDoc, naToNull } from "./normalize.js";

export const DEFAULT_SC_PATH =
  process.env.OSD_SC_PATH || "/home/andrew/workspace/OSDRegistry/SC/SCDB.csv";
export const DEFAULT_SKB_DIR =
  process.env.OSD_SKB_DIR ||
  "/home/andrew/workspace/SoilKnowledgeBase/inst/extdata/OSD";

const SC_STATUSES = ["Established", "Tentative", "Inactive"];

/**
 * Parse RFC 4180 CSV text into an array of row arrays.
 * Supports quoted fields, escaped double-quotes (""), and embedded commas/newlines.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (inQuotes) {
    throw new Error("Malformed CSV: unterminated quoted field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse an RFC 4180 CSV string with a header row into record objects.
 * Converts `"NA"` cells to `null` (SKB-17 convention).
 *
 * @param {string} text
 * @returns {Array<Record<string, string|null>>}
 */
export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0];
  const records = [];

  for (let r = 1; r < rows.length; r++) {
    const values = rows[r];
    if (values.length === 1 && values[0] === "") {
      continue;
    }
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const val = c < values.length ? values[c] : "";
      obj[headers[c]] = naToNull(val);
    }
    records.push(obj);
  }

  return records;
}

/**
 * Load and parse `SCDB.csv` into a Map keyed by `seriesNameToKey(soilseriesname)`.
 *
 * @param {string} [scPath]
 * @returns {Promise<Map<string, Record<string, string|null>>>}
 */
export async function loadScTable(scPath = DEFAULT_SC_PATH) {
  const text = await fsp.readFile(scPath, "utf8");
  const rows = parseCsv(text);
  const byKey = new Map();

  for (const row of rows) {
    const key = seriesNameToKey(row.soilseriesname);
    if (key) {
      byKey.set(key, row);
    }
  }

  return byKey;
}

/**
 * Discover available SKB JSON file paths under `<skbDir>/{A..Z}/*.json`.
 * Returns a Map from normalized key to absolute file path.
 *
 * @param {string} skbDir
 * @param {Set<string>|null} filterKeys
 * @returns {Promise<Map<string, string>>}
 */
async function indexSkbFiles(skbDir, filterKeys = null) {
  const fileMap = new Map();

  if (filterKeys !== null) {
    for (const key of filterKeys) {
      const rel = keyToRelativePath(key, "json");
      const fullPath = path.join(skbDir, rel);
      if (fs.existsSync(fullPath)) {
        fileMap.set(key, fullPath);
      }
    }
    return fileMap;
  }

  const entries = await fsp.readdir(skbDir, { withFileTypes: true });
  const subdirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  await Promise.all(
    subdirs.map(async (dirName) => {
      const dirPath = path.join(skbDir, dirName);
      const files = await fsp.readdir(dirPath);
      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }
        const key = file.slice(0, -5);
        fileMap.set(key, path.join(dirPath, file));
      }
    })
  );

  return fileMap;
}

/**
 * Read and normalize a single SKB JSON file.
 *
 * @param {string} filePath
 * @returns {Promise<Record<string, unknown>>}
 */
export async function loadSkbFile(filePath) {
  const raw = JSON.parse(await fsp.readFile(filePath, "utf8"));
  return normalizeSkbDoc(raw);
}

/**
 * Load and join SC CSV rows with normalized SKB JSON documents.
 *
 * @param {object} [options]
 * @param {string} [options.scPath] Path to SCDB.csv
 * @param {string} [options.skbDir] Path to SKB OSD root directory (`{A..Z}/<KEY>.json`)
 * @param {string[]} [options.seriesFilter] Optional list of series names or keys to load
 * @param {number} [options.limit] Optional maximum number of joined records to return
 * @returns {Promise<{ records: Array<object>, report: object }>}
 */
export async function loadCorpus(options = {}) {
  const {
    scPath = DEFAULT_SC_PATH,
    skbDir = DEFAULT_SKB_DIR,
    seriesFilter = null,
    limit = null,
  } = options;

  const filterKeys =
    Array.isArray(seriesFilter) && seriesFilter.length > 0
      ? new Set(seriesFilter.map(seriesNameToKey).filter(Boolean))
      : null;

  const [scMap, skbFileMap] = await Promise.all([
    loadScTable(scPath),
    indexSkbFiles(skbDir, filterKeys),
  ]);

  const allKeysSet = new Set();
  if (filterKeys !== null) {
    for (const key of filterKeys) {
      if (scMap.has(key) || skbFileMap.has(key)) {
        allKeysSet.add(key);
      }
    }
  } else {
    for (const key of scMap.keys()) {
      allKeysSet.add(key);
    }
    for (const key of skbFileMap.keys()) {
      allKeysSet.add(key);
    }
  }

  let keys = Array.from(allKeysSet).sort();
  if (typeof limit === "number" && limit >= 0) {
    keys = keys.slice(0, limit);
  }

  // Read SKB JSON files in bounded batches to avoid EMFILE on 24k+ files.
  const BATCH_SIZE = 256;
  const skbByKey = new Map();
  const keysWithSkb = keys.filter((k) => skbFileMap.has(k));

  for (let i = 0; i < keysWithSkb.length; i += BATCH_SIZE) {
    const batch = keysWithSkb.slice(i, i + BATCH_SIZE);
    const loaded = await Promise.all(
      batch.map(async (key) => {
        const doc = await loadSkbFile(skbFileMap.get(key));
        return [key, doc];
      })
    );
    for (const [key, doc] of loaded) {
      skbByKey.set(key, doc);
    }
  }

  const matchedByStatus = Object.fromEntries(SC_STATUSES.map((s) => [s, 0]));
  const scOnlyByStatus = Object.fromEntries(SC_STATUSES.map((s) => [s, 0]));
  let totalSc = 0;
  let totalSkb = 0;
  let matchedTotal = 0;
  let scOnly = 0;
  let skbOnly = 0;

  const records = keys.map((key) => {
    const sc = scMap.get(key) ?? null;
    const skb = skbByKey.get(key) ?? null;
    const skbPath = skbFileMap.get(key) ?? null;
    const hasSc = sc !== null;
    const hasSkb = skb !== null;
    const status = hasSc ? (sc.soilseriesstatus ?? "Unknown") : "Unclassified";

    if (hasSc) totalSc++;
    if (hasSkb) totalSkb++;

    if (hasSc && hasSkb) {
      matchedTotal++;
      matchedByStatus[status] = (matchedByStatus[status] ?? 0) + 1;
    } else if (hasSc) {
      scOnly++;
      scOnlyByStatus[status] = (scOnlyByStatus[status] ?? 0) + 1;
    } else if (hasSkb) {
      skbOnly++;
    }

    return {
      key,
      name: sc?.soilseriesname ?? skb?.SERIES ?? key,
      letter: key[0],
      status,
      sc,
      skb,
      skbPath,
      horizons: skb?.HORIZONS ?? [],
      site: skb?.SITE ?? [],
      hasSc,
      hasSkb,
    };
  });

  return {
    records,
    report: {
      totalRecords: records.length,
      totalSc,
      totalSkb,
      matchedTotal,
      matchedByStatus,
      scOnly,
      scOnlyByStatus,
      skbOnly,
    },
  };
}
