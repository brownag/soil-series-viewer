/**
 * Lightweight pure-ESM SVG color-strip renderer for gallery profile cards.
 * Zero Node-only imports so it runs identically in browsers and node:test.
 */

export const PLACEHOLDER_FILL = "#f2f2f2";

export const DEFAULT_STRIP_OPTIONS = Object.freeze({
  width: 48,
  height: 140,
  borderColor: "#4a4a4a",
  outerBorderColor: "#333333",
  fallbackColor: "#cccccc",
  placeholderFill: PLACEHOLDER_FILL,
  placeholderStroke: "#b8b8b8",
  label: "Soil profile color strip",
});

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Escape text for safe inclusion in XML/HTML attributes and elements.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format a numeric SVG coordinate cleanly without noisy trailing zeros.
 *
 * @param {number} value
 * @returns {string}
 */
function fmt(value) {
  return String(Number(value.toFixed(2)));
}

/**
 * Validate positive finite dimension option with fallback.
 *
 * @param {unknown} candidate
 * @param {number} fallback
 * @returns {number}
 */
function resolveDimension(candidate, fallback) {
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0
    ? candidate
    : fallback;
}

/**
 * Resolve a safe SVG hex color string, falling back when missing or malformed.
 *
 * @param {unknown} candidate
 * @param {string} fallback
 * @returns {string}
 */
function resolveHexColor(candidate, fallback) {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (HEX_COLOR_RE.test(trimmed)) {
      return trimmed;
    }
  }
  return fallback;
}

/**
 * Normalize horizon records into plottable { top, bottom, hex, name } entries.
 *
 * @param {unknown} horizons
 * @param {string} fallbackColor
 * @returns {Array<{ top: number, bottom: number, hex: string, name: string }>}
 */
function normalizeHorizons(horizons, fallbackColor) {
  if (!Array.isArray(horizons)) {
    return [];
  }

  const normalized = [];
  for (const h of horizons) {
    if (!h || typeof h !== "object") {
      continue;
    }
    const rawTop = h.t ?? h.top;
    const rawBottom = h.b ?? h.bottom;
    const top = typeof rawTop === "number" ? rawTop : Number(rawTop);
    const bottom = typeof rawBottom === "number" ? rawBottom : Number(rawBottom);

    if (
      rawTop === null ||
      rawTop === undefined ||
      rawTop === "" ||
      rawBottom === null ||
      rawBottom === undefined ||
      rawBottom === "" ||
      !Number.isFinite(top) ||
      !Number.isFinite(bottom) ||
      bottom <= top
    ) {
      continue;
    }

    const hex = resolveHexColor(h.hex ?? h.color, fallbackColor);
    const name = typeof (h.n ?? h.name) === "string" ? (h.n ?? h.name).trim() : "";
    normalized.push({ top, bottom, hex, name });
  }
  return normalized;
}

/**
 * Render a compact `<svg>` color strip for an array of soil horizons.
 *
 * @param {Array<{ t?: number, b?: number, top?: number, bottom?: number, hex?: string, color?: string, n?: string, name?: string }>|null|undefined} horizons
 * @param {object} [options]
 * @param {number} [options.width=48]
 * @param {number} [options.height=140]
 * @param {string} [options.borderColor="#4a4a4a"]
 * @param {string} [options.outerBorderColor="#333333"]
 * @param {string} [options.fallbackColor="#cccccc"]
 * @param {string} [options.placeholderFill="#f2f2f2"]
 * @param {string} [options.placeholderStroke="#b8b8b8"]
 * @param {string} [options.label="Soil profile color strip"]
 * @returns {string}
 */
export function renderStripSvg(horizons, options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const width = resolveDimension(opts.width, DEFAULT_STRIP_OPTIONS.width);
  const height = resolveDimension(opts.height, DEFAULT_STRIP_OPTIONS.height);
  const borderColor = opts.borderColor ?? DEFAULT_STRIP_OPTIONS.borderColor;
  const outerBorderColor = opts.outerBorderColor ?? DEFAULT_STRIP_OPTIONS.outerBorderColor;
  const fallbackColor = opts.fallbackColor ?? DEFAULT_STRIP_OPTIONS.fallbackColor;
  const placeholderFill = opts.placeholderFill ?? DEFAULT_STRIP_OPTIONS.placeholderFill;
  const placeholderStroke = opts.placeholderStroke ?? DEFAULT_STRIP_OPTIONS.placeholderStroke;
  const label = opts.label ?? DEFAULT_STRIP_OPTIONS.label;

  const valid = normalizeHorizons(horizons, fallbackColor);

  if (valid.length === 0) {
    const midY = fmt(height / 2);
    const x2 = fmt(Math.max(6, width - 6));
    const innerW = fmt(Math.max(1, width - 1));
    const innerH = fmt(Math.max(1, height - 1));
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" ` +
      `width="${fmt(width)}" height="${fmt(height)}" class="strip-svg strip-svg-placeholder" ` +
      `role="img" aria-label="${escapeXml(label)} (no horizon data)">` +
      `<rect x="0.5" y="0.5" width="${innerW}" height="${innerH}" ` +
      `fill="${escapeXml(placeholderFill)}" stroke="${escapeXml(placeholderStroke)}" stroke-width="1"/>` +
      `<line x1="6" y1="${midY}" x2="${x2}" y2="${midY}" ` +
      `stroke="${escapeXml(placeholderStroke)}" stroke-width="1" stroke-dasharray="3 2"/>` +
      `</svg>`
    );
  }

  let minTop = valid[0].top;
  let maxBottom = valid[0].bottom;
  for (let i = 1; i < valid.length; i += 1) {
    if (valid[i].top < minTop) minTop = valid[i].top;
    if (valid[i].bottom > maxBottom) maxBottom = valid[i].bottom;
  }
  const totalSpan = maxBottom - minTop;

  const rects = valid.map((h) => {
    const y = ((h.top - minTop) / totalSpan) * height;
    const rectH = ((h.bottom - h.top) / totalSpan) * height;
    const attrs =
      `x="0" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(rectH)}" ` +
      `fill="${escapeXml(h.hex)}" stroke="${escapeXml(borderColor)}" stroke-width="1"`;
    if (h.name) {
      const title = `${h.name} (${fmt(h.top)}-${fmt(h.bottom)} cm)`;
      return `<rect ${attrs} data-horizon="${escapeXml(h.name)}"><title>${escapeXml(title)}</title></rect>`;
    }
    return `<rect ${attrs}/>`;
  });

  const frame =
    `<rect x="0.5" y="0.5" width="${fmt(Math.max(1, width - 1))}" height="${fmt(Math.max(1, height - 1))}" ` +
    `fill="none" stroke="${escapeXml(outerBorderColor)}" stroke-width="1"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" ` +
    `width="${fmt(width)}" height="${fmt(height)}" class="strip-svg" ` +
    `role="img" aria-label="${escapeXml(label)}">` +
    rects.join("") +
    frame +
    `</svg>`
  );
}
