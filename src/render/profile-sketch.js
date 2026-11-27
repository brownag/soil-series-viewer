/**
 * Build-time SVG profile sketch renderer powered by SoilProfiles.js.
 * Handles SKB-9 (moist -> dry -> #cccccc color fallback) and SKB-10
 * (missing/invalid depth omission).
 */

import {
  DATA_MAPS,
  SoilProfile,
  SoilProfileCollection,
  mapToHorizon,
  renderStaticSVG,
} from "../lib/soil-profiles.js";

export const DEFAULT_SKETCH_OPTIONS = Object.freeze({
  width: 140,
  height: 320,
  mode: "depth",
});

export const FALLBACK_HORIZON_COLOR = "#cccccc";

/**
 * Check whether a value is a finite number.
 *
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Check whether a Munsell hue string is non-empty.
 *
 * @param {unknown} hue
 * @returns {boolean}
 */
function isPresentHue(hue) {
  return typeof hue === "string" && hue.trim().length > 0;
}

/**
 * Check whether a Munsell value or chroma component is present and finite.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isPresentNumericComponent(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string") {
    return value.trim().length > 0 && Number.isFinite(Number(value));
  }
  return false;
}

/**
 * Check whether all three components of a Munsell color triplet are present.
 *
 * @param {unknown} hue
 * @param {unknown} value
 * @param {unknown} chroma
 * @returns {boolean}
 */
function hasMunsellTriplet(hue, value, chroma) {
  return (
    isPresentHue(hue) &&
    isPresentNumericComponent(value) &&
    isPresentNumericComponent(chroma)
  );
}

/**
 * Resolve SKB-9 Munsell color fields: moist -> dry -> none (falls back to #cccccc).
 * Passes undefined (not null) when incomplete so SoilProfiles.js does not coerce null to 0.
 *
 * @param {Record<string, unknown>} horizon
 * @returns {{ munsellHue: string|undefined, munsellValue: number|string|undefined, munsellChroma: number|string|undefined }}
 */
export function selectHorizonMunsell(horizon) {
  if (hasMunsellTriplet(horizon.moist_hue, horizon.moist_value, horizon.moist_chroma)) {
    return {
      munsellHue: horizon.moist_hue,
      munsellValue: horizon.moist_value,
      munsellChroma: horizon.moist_chroma,
    };
  }
  if (hasMunsellTriplet(horizon.dry_hue, horizon.dry_value, horizon.dry_chroma)) {
    return {
      munsellHue: horizon.dry_hue,
      munsellValue: horizon.dry_value,
      munsellChroma: horizon.dry_chroma,
    };
  }
  return {
    munsellHue: undefined,
    munsellValue: undefined,
    munsellChroma: undefined,
  };
}

/**
 * Determine whether a normalized horizon has valid numeric depths with bottom > top (SKB-10).
 *
 * @param {unknown} horizon
 * @returns {boolean}
 */
export function isPlottableHorizon(horizon) {
  if (!horizon || typeof horizon !== "object") {
    return false;
  }
  return (
    isFiniteNumber(horizon.top) &&
    isFiniteNumber(horizon.bottom) &&
    horizon.bottom > horizon.top
  );
}

/**
 * Render a SoilProfiles.js SVG profile sketch for a joined series record.
 *
 * @param {object} record Joined corpus record from `loadCorpus()`
 * @param {object} [options]
 * @param {number} [options.width=140]
 * @param {number} [options.height=320]
 * @param {string} [options.mode="depth"]
 * @returns {{ svg: string|null, omittedHorizons: Array<Record<string, unknown>> }}
 */
export function renderProfileSketch(record, options = {}) {
  if (!record || typeof record !== "object") {
    throw new TypeError("Series record must be an object");
  }

  const rawHorizons = Array.isArray(record.horizons)
    ? record.horizons
    : Array.isArray(record.skb?.HORIZONS)
      ? record.skb.HORIZONS
      : [];

  const mappedHorizons = [];
  const omittedHorizons = [];

  for (const horizon of rawHorizons) {
    if (!isPlottableHorizon(horizon)) {
      omittedHorizons.push(horizon);
      continue;
    }

    const { munsellHue, munsellValue, munsellChroma } = selectHorizonMunsell(horizon);
    const mapped = mapToHorizon(
      {
        hzname: horizon.name ?? "",
        top: horizon.top,
        bottom: horizon.bottom,
        color: FALLBACK_HORIZON_COLOR,
        texture: horizon.texture_class ?? undefined,
        ph: horizon.pH ?? undefined,
        moist_hue: munsellHue,
        moist_value: munsellValue,
        moist_chroma: munsellChroma,
      },
      DATA_MAPS.SSURGO
    );
    mappedHorizons.push(mapped);
  }

  if (mappedHorizons.length === 0) {
    return { svg: null, omittedHorizons };
  }

  const profileId =
    String(record.skb?.SERIES ?? record.name ?? record.key ?? "Profile").trim() ||
    "Profile";
  const profile = new SoilProfile(profileId, mappedHorizons);
  const collection = new SoilProfileCollection([profile]);

  const {
    width = DEFAULT_SKETCH_OPTIONS.width,
    height = DEFAULT_SKETCH_OPTIONS.height,
    mode = DEFAULT_SKETCH_OPTIONS.mode,
    ...restOptions
  } = options ?? {};

  const svg = renderStaticSVG(collection, {
    ...restOptions,
    width,
    height,
    format: "svg",
    mode,
  });

  return { svg, omittedHorizons };
}
