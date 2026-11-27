/**
 * Display-side QA issue detector and HTML note renderer for joined series records.
 * Strictly read-only per §0 policy: never mutates SKB JSON or corpus records.
 */

import { isPlottableHorizon } from "../render/profile-sketch.js";
import { escapeHtml } from "../render/series-page.js";

/**
 * Check whether a parsed depth bound value is present and finite.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function hasFiniteBound(value) {
  if (value == null || typeof value === "boolean") {
    return false;
  }
  if (typeof value === "string" && value.trim() === "") {
    return false;
  }
  return Number.isFinite(Number(value));
}

/**
 * Check whether a horizon is missing any component of its parsed moist Munsell color.
 *
 * @param {Record<string, unknown>} hz
 * @returns {boolean}
 */
function isMissingMoistColor(hz) {
  const missingHue = typeof hz.moist_hue !== "string" || hz.moist_hue.trim().length === 0;
  const missingValue = !hasFiniteBound(hz.moist_value);
  const missingChroma = !hasFiniteBound(hz.moist_chroma);
  return missingHue || missingValue || missingChroma;
}

/**
 * Normalize an optional string field to trimmed lowercase.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Detect known SC/SKB data-quality issues on a joined series record without mutating it.
 *
 * @param {object} record Joined corpus record from `loadCorpus()`
 * @returns {Array<{ code: string, severity: "info" | "warn", summary: string, count?: number }>}
 */
export function detectRecordIssues(record) {
  if (!record || typeof record !== "object") {
    throw new TypeError("Series record must be an object");
  }

  const issues = [];

  if (!record.hasSc) {
    issues.push({
      code: "SC-MISSING",
      severity: "warn",
      summary: "No Series Classification (SCDB) record; taxonomy metadata unavailable.",
    });
  }

  if (!record.hasSkb) {
    issues.push({
      code: "SKB-MISSING",
      severity: "warn",
      summary: "No SoilKnowledgeBase OSD narrative JSON available.",
    });
  }

  const horizons = Array.isArray(record.horizons)
    ? record.horizons
    : Array.isArray(record.skb?.HORIZONS)
      ? record.skb.HORIZONS
      : [];

  let skb9Count = 0;
  let skb10Count = 0;
  let skb2Count = 0;
  let skb3Count = 0;
  let skb4Count = 0;
  let skb5Count = 0;

  for (const hz of horizons) {
    if (!hz || typeof hz !== "object") {
      continue;
    }

    if (!hasFiniteBound(hz.top) || !hasFiniteBound(hz.bottom)) {
      skb10Count++;
    } else if (isPlottableHorizon(hz) && isMissingMoistColor(hz)) {
      skb9Count++;
    }

    const narrative = typeof hz.narrative === "string" ? hz.narrative : "";
    if (narrative) {
      const dryRupture = normalizeText(hz.dry_rupture);
      if (dryRupture === "hard" && /\bslightly\s+hard\b/i.test(narrative)) {
        const stripped = narrative.replace(/\bslightly\s+hard\b/gi, " ");
        if (!/\bhard\b/i.test(stripped)) {
          skb2Count++;
        }
      }

      const moistRupture = normalizeText(hz.moist_rupture);
      if (
        (moistRupture === "friable" && /\bvery\s+friable\b/i.test(narrative)) ||
        (moistRupture === "firm" && /\b(very|extremely)\s+firm\b/i.test(narrative))
      ) {
        skb3Count++;
      }

      const cementation = normalizeText(hz.cementation ?? hz.coherence);
      if (
        (cementation === "weakly" || cementation === "weakly cemented") &&
        /\b(very|extremely)\s+weakly\b/i.test(narrative)
      ) {
        skb4Count++;
      }

      const structureMatches = narrative.match(/\bstructure\b/gi);
      if (/\bparting\s+to\b/i.test(narrative) || (structureMatches !== null && structureMatches.length >= 2)) {
        skb5Count++;
      }
    }
  }

  let skb11Count = 0;
  if (record.skb && typeof record.skb === "object") {
    for (const value of Object.values(record.skb)) {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof value.content === "string" &&
        value.content.includes(" & ")
      ) {
        skb11Count++;
      }
    }
  }

  if (skb9Count > 0) {
    issues.push({
      code: "SKB-9",
      severity: "info",
      count: skb9Count,
      summary: `${skb9Count} horizon(s) missing parsed moist Munsell color; sketch uses dry-color or neutral fallback.`,
    });
  }

  if (skb10Count > 0) {
    issues.push({
      code: "SKB-10",
      severity: "warn",
      count: skb10Count,
      summary: `${skb10Count} horizon(s) missing parsed depth bounds; omitted from profile sketch.`,
    });
  }

  if (skb2Count > 0) {
    issues.push({
      code: "SKB-2",
      severity: "info",
      count: skb2Count,
      summary: `${skb2Count} horizon(s) have dry_rupture "hard" where narrative says "slightly hard"; narrative text is authoritative.`,
    });
  }

  if (skb3Count > 0) {
    issues.push({
      code: "SKB-3",
      severity: "info",
      count: skb3Count,
      summary: `${skb3Count} horizon(s) have moist_rupture truncated from "very friable" or "very/extremely firm" in narrative; narrative text is authoritative.`,
    });
  }

  if (skb4Count > 0) {
    issues.push({
      code: "SKB-4",
      severity: "info",
      count: skb4Count,
      summary: `${skb4Count} horizon(s) have cementation "weakly" where narrative says "very/extremely weakly"; narrative text is authoritative.`,
    });
  }

  if (skb5Count > 0) {
    issues.push({
      code: "SKB-5",
      severity: "info",
      count: skb5Count,
      summary: `${skb5Count} horizon(s) describe compound structure ("parting to" or multiple structure phrases) where only the last phrase is parsed.`,
    });
  }

  if (skb11Count > 0) {
    issues.push({
      code: "SKB-11",
      severity: "info",
      count: skb11Count,
      summary: `${skb11Count} section(s) contain " & ", which may reflect repeated section headers joined by SKB.`,
    });
  }

  return issues;
}

/**
 * Render a collapsible `<details>` block summarizing detected QA issues.
 * Returns an empty string when there are no issues.
 *
 * @param {Array<{ code: string, severity: "info" | "warn", summary: string }>} issues
 * @returns {string}
 */
export function renderQaNotes(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return "";
  }

  const items = issues.map((issue) => {
    const severity = escapeHtml(issue?.severity ?? "info");
    const code = escapeHtml(issue?.code ?? "");
    const summary = escapeHtml(issue?.summary ?? "");
    return `    <li class="osd-qa-item osd-qa-${severity}"><strong>${code}:</strong> ${summary}</li>`;
  });

  return [
    `<details class="osd-qa-notes no-print">`,
    `  <summary>Data quality notes (${issues.length})</summary>`,
    `  <ul>`,
    ...items,
    `  </ul>`,
    `</details>`,
  ].join("\n");
}
