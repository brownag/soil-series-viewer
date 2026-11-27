/**
 * Build-time letter-sharded Munsell color strip generator.
 * Reuses SoilProfiles.js Munsell conversion and SKB-9/SKB-10 horizon helpers.
 */

import { munsellToHex } from "/home/andrew/workspace/SoilProfiles.js/dist/index.js";
import {
  FALLBACK_HORIZON_COLOR,
  isPlottableHorizon,
  selectHorizonMunsell,
} from "../render/profile-sketch.js";
import { resolveShardLetter } from "./search-index.js";

/**
 * Resolve the display hex color for a plottable horizon using SKB-9 fallback
 * (moist -> dry -> #cccccc) and SoilProfiles.js's munsellToHex.
 *
 * @param {Record<string, unknown>} horizon
 * @returns {string}
 */
function resolveHorizonHex(horizon) {
  const { munsellHue, munsellValue, munsellChroma } = selectHorizonMunsell(horizon);
  if (munsellHue === undefined) {
    return FALLBACK_HORIZON_COLOR;
  }
  return munsellToHex(munsellHue, munsellValue, munsellChroma) || FALLBACK_HORIZON_COLOR;
}

/**
 * Build compact horizon color strips grouped into shards by uppercase first letter
 * (`A`–`Z`, or `_` fallback): `{ [letter]: { [key]: [{ t, b, hex, n }] } }`.
 *
 * @param {Array<Record<string, any>>} records
 * @returns {Record<string, Record<string, Array<{ t: number, b: number, hex: string, n: string }>>>}
 */
export function buildColorStripShards(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("records must be an array");
  }

  const shards = {};

  for (const record of records) {
    if (!record || typeof record !== "object") {
      throw new TypeError("Each record must be an object");
    }

    const key =
      typeof record.key === "string" && record.key.length > 0
        ? record.key
        : typeof record.name === "string"
          ? record.name
          : "";
    if (!key) {
      continue;
    }

    const rawHorizons = Array.isArray(record.horizons)
      ? record.horizons
      : Array.isArray(record.skb?.HORIZONS)
        ? record.skb.HORIZONS
        : [];

    const strip = [];
    for (const horizon of rawHorizons) {
      if (!isPlottableHorizon(horizon)) {
        continue;
      }
      strip.push({
        t: horizon.top,
        b: horizon.bottom,
        hex: resolveHorizonHex(horizon),
        n: typeof horizon.name === "string" ? horizon.name : "",
      });
    }

    if (strip.length === 0) {
      continue;
    }

    const letter = resolveShardLetter(record);
    if (!shards[letter]) {
      shards[letter] = {};
    }
    shards[letter][key] = strip;
  }

  return shards;
}
