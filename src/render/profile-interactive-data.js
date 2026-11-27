/**
 * Build-time interactive horizon payload builder for series pages.
 * Reuses SoilProfiles.js Munsell conversion and SKB-9 / SKB-10 horizon rules.
 */

import { munsellToHex } from "/home/andrew/workspace/SoilProfiles.js/dist/index.js";
import {
  FALLBACK_HORIZON_COLOR,
  isPlottableHorizon,
  selectHorizonMunsell,
} from "./profile-sketch.js";

/**
 * Normalize an optional non-empty trimmed string, or return null.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize an optional finite numeric pH value, or return null.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeOptionalPh(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Build the compact JSON-serializable payload embedded in series pages for
 * interactive horizon tooltips and profile comparison.
 *
 * @param {Record<string, any>} record Joined corpus record from `loadCorpus()`
 * @returns {{ key: string, name: string, taxclname: string|null, horizons: Array<{ name: string, top: number, bottom: number, color: string, munsell: string|null, texture: string|null, pH: number|null, effervescence: string|null }> }}
 */
export function buildInteractiveProfileData(record) {
  if (!record || typeof record !== "object") {
    throw new TypeError("Series record must be an object");
  }

  const key =
    normalizeOptionalString(record.key) ??
    normalizeOptionalString(record.name) ??
    normalizeOptionalString(record.skb?.SERIES) ??
    "";

  const name =
    normalizeOptionalString(record.name) ??
    normalizeOptionalString(record.skb?.SERIES) ??
    key;

  const taxclname =
    normalizeOptionalString(record.sc?.taxclname) ??
    normalizeOptionalString(record.taxclname) ??
    null;

  const rawHorizons = Array.isArray(record.horizons)
    ? record.horizons
    : Array.isArray(record.skb?.HORIZONS)
      ? record.skb.HORIZONS
      : [];

  const horizons = [];
  for (const horizon of rawHorizons) {
    if (!isPlottableHorizon(horizon)) {
      continue;
    }

    const { munsellHue, munsellValue, munsellChroma } = selectHorizonMunsell(horizon);
    let munsell = null;
    let color = FALLBACK_HORIZON_COLOR;

    if (munsellHue !== undefined) {
      munsell = `${String(munsellHue).trim()} ${munsellValue}/${munsellChroma}`;
      color = munsellToHex(munsellHue, munsellValue, munsellChroma) || FALLBACK_HORIZON_COLOR;
    }

    horizons.push({
      name:
        normalizeOptionalString(horizon.name) ??
        normalizeOptionalString(horizon.hzname) ??
        "",
      top: horizon.top,
      bottom: horizon.bottom,
      color,
      munsell,
      texture:
        normalizeOptionalString(horizon.texture_class) ??
        normalizeOptionalString(horizon.texture),
      pH: normalizeOptionalPh(horizon.pH ?? horizon.ph),
      effervescence:
        normalizeOptionalString(horizon.eff_class) ??
        normalizeOptionalString(horizon.effervescence),
    });
  }

  return {
    key,
    name,
    taxclname,
    horizons,
  };
}
