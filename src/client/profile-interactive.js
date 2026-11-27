/**
 * Pure ESM browser module for interactive OSD horizon tooltips and
 * side-by-side pinned profile comparison.
 * Zero Node-only imports: runs natively in browsers and `node:test`.
 */

import { renderStripSvg } from "./strip-svg.js";

export const COMPARE_STORAGE_KEY = "osd-compare-series";
export const MAX_PINNED_PROFILES = 4;

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape untrusted text for safe HTML interpolation.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Encode a single URL path segment safely while preserving `@`, `.`, `_`, and `'`.
 *
 * @param {unknown} value
 * @returns {string}
 */
function encodeHrefPart(value) {
  return encodeURI(String(value ?? ""))
    .replaceAll("#", "%23")
    .replaceAll("?", "%3F");
}

/**
 * Resolve the uppercase shard letter (`A`-`Z`, or `_` fallback) for a profile.
 *
 * @param {Record<string, unknown>} profile
 * @returns {string}
 */
function resolveSeriesLetter(profile) {
  const raw =
    typeof profile?.key === "string" && profile.key.trim().length > 0
      ? profile.key.trim()
      : typeof profile?.name === "string"
        ? profile.name.trim()
        : "";
  const first = raw.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "_";
}

/**
 * Format a numeric depth cleanly without noisy trailing zeros.
 *
 * @param {number} value
 * @returns {string}
 */
function formatDepthValue(value) {
  return String(Number(value.toFixed(2)));
}

/**
 * Normalize a pinned profile object for safe storage and strip rendering.
 *
 * @param {unknown} profile
 * @returns {{ key: string, name: string, taxclname: string|null, horizons: Array<{ name: string, top: number, bottom: number, color: string }> }|null}
 */
function normalizePinnedProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const key = typeof profile.key === "string" ? profile.key.trim() : "";
  if (!key) {
    return null;
  }

  const name =
    typeof profile.name === "string" && profile.name.trim().length > 0
      ? profile.name.trim()
      : key;

  const taxclname =
    typeof profile.taxclname === "string" && profile.taxclname.trim().length > 0
      ? profile.taxclname.trim()
      : null;

  const rawHorizons = Array.isArray(profile.horizons) ? profile.horizons : [];
  const horizons = [];
  for (const h of rawHorizons) {
    if (!h || typeof h !== "object") {
      continue;
    }
    const top = typeof h.top === "number" ? h.top : Number(h.t);
    const bottom = typeof h.bottom === "number" ? h.bottom : Number(h.b);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) {
      continue;
    }
    const rawColor = typeof h.color === "string" ? h.color : typeof h.hex === "string" ? h.hex : "";
    const color = HEX_COLOR_RE.test(rawColor.trim()) ? rawColor.trim() : "#cccccc";
    const hzName =
      typeof h.name === "string"
        ? h.name.trim()
        : typeof h.n === "string"
          ? h.n.trim()
          : "";
    horizons.push({ name: hzName, top, bottom, color });
  }

  return { key, name, taxclname, horizons };
}

/**
 * Format interactive tooltip HTML for a single horizon record.
 * Displays horizon name, depth range (`top–bottom cm`), Munsell color,
 * texture, pH, and effervescence.
 *
 * @param {Record<string, unknown>} hz
 * @returns {string}
 */
export function formatHorizonTooltip(hz) {
  if (!hz || typeof hz !== "object") {
    return "";
  }

  const name =
    typeof hz.name === "string" && hz.name.trim().length > 0
      ? hz.name.trim()
      : "Horizon";

  const hasDepth =
    typeof hz.top === "number" &&
    Number.isFinite(hz.top) &&
    typeof hz.bottom === "number" &&
    Number.isFinite(hz.bottom);
  const depthText = hasDepth
    ? `${formatDepthValue(hz.top)}–${formatDepthValue(hz.bottom)} cm`
    : "";

  const munsell =
    typeof hz.munsell === "string" && hz.munsell.trim().length > 0
      ? hz.munsell.trim()
      : "";
  const safeColor =
    typeof hz.color === "string" && HEX_COLOR_RE.test(hz.color.trim())
      ? hz.color.trim()
      : "";
  const texture =
    typeof hz.texture === "string" && hz.texture.trim().length > 0
      ? hz.texture.trim()
      : "";

  let phText = "";
  if (typeof hz.pH === "number" && Number.isFinite(hz.pH)) {
    phText = String(hz.pH);
  } else if (typeof hz.pH === "string" && hz.pH.trim().length > 0) {
    phText = hz.pH.trim();
  }

  const effervescence =
    typeof hz.effervescence === "string" && hz.effervescence.trim().length > 0
      ? hz.effervescence.trim()
      : "";

  const parts = [
    `<div class="osd-tooltip-header"><strong>${escapeHtml(name)}</strong>${
      depthText ? ` <span class="osd-tooltip-depth">${escapeHtml(depthText)}</span>` : ""
    }</div>`,
  ];

  if (munsell) {
    const swatch = safeColor
      ? `<span class="osd-tooltip-swatch" style="background:${escapeHtml(safeColor)}" aria-hidden="true"></span> `
      : "";
    parts.push(`<div class="osd-tooltip-row">${swatch}Munsell: ${escapeHtml(munsell)}</div>`);
  }
  if (texture) {
    parts.push(`<div class="osd-tooltip-row">Texture: ${escapeHtml(texture)}</div>`);
  }
  if (phText) {
    parts.push(`<div class="osd-tooltip-row">pH: ${escapeHtml(phText)}</div>`);
  }
  if (effervescence) {
    parts.push(
      `<div class="osd-tooltip-row">Effervescence: ${escapeHtml(effervescence)}</div>`
    );
  }

  return parts.join("");
}

/**
 * Load pinned comparison profiles from a Web Storage-compatible object.
 *
 * @param {Pick<Storage, "getItem">|null|undefined} storage
 * @returns {Array<{ key: string, name: string, taxclname: string|null, horizons: Array<{ name: string, top: number, bottom: number, color: string }> }>}
 */
export function loadPinnedProfiles(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return [];
  }

  try {
    const raw = storage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set();
    const profiles = [];
    for (const entry of parsed) {
      const normalized = normalizePinnedProfile(entry);
      if (normalized && !seen.has(normalized.key)) {
        seen.add(normalized.key);
        profiles.push(normalized);
      }
    }
    return profiles;
  } catch {
    return [];
  }
}

/**
 * Save pinned comparison profiles to a Web Storage-compatible object.
 *
 * @param {Pick<Storage, "setItem">|null|undefined} storage
 * @param {Array<Record<string, unknown>>} profiles
 * @returns {Array<{ key: string, name: string, taxclname: string|null, horizons: Array<{ name: string, top: number, bottom: number, color: string }> }>}
 */
export function savePinnedProfiles(storage, profiles) {
  const normalized = Array.isArray(profiles)
    ? profiles.map(normalizePinnedProfile).filter(Boolean)
    : [];

  if (storage && typeof storage.setItem === "function") {
    try {
      storage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota or security errors
    }
  }

  return normalized;
}

/**
 * Toggle a soil profile in the pinned comparison list, enforcing `max` capacity
 * by dropping the oldest pinned entry when exceeding `max`.
 *
 * @param {Pick<Storage, "getItem"|"setItem">|null|undefined} storage
 * @param {Record<string, unknown>} profile
 * @param {number} [max=MAX_PINNED_PROFILES]
 * @returns {Array<{ key: string, name: string, taxclname: string|null, horizons: Array<{ name: string, top: number, bottom: number, color: string }> }>}
 */
export function togglePinnedProfile(storage, profile, max = MAX_PINNED_PROFILES) {
  const current = loadPinnedProfiles(storage);
  const normalized = normalizePinnedProfile(profile);
  if (!normalized) {
    return current;
  }

  const limit =
    typeof max === "number" && Number.isFinite(max) && max >= 0
      ? Math.floor(max)
      : MAX_PINNED_PROFILES;

  const exists = current.some((item) => item.key === normalized.key);
  let next;
  if (exists) {
    next = current.filter((item) => item.key !== normalized.key);
  } else if (limit === 0) {
    next = [];
  } else {
    next = [...current, normalized];
    if (next.length > limit) {
      next = next.slice(next.length - limit);
    }
  }

  return savePinnedProfiles(storage, next);
}

/**
 * Render HTML for the side-by-side comparison tray cards.
 *
 * @param {Array<Record<string, unknown>>} profiles
 * @param {string} [currentKey=""]
 * @returns {string}
 */
export function renderComparisonTrayHtml(profiles, currentKey = "") {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return "";
  }

  const normalized = profiles.map(normalizePinnedProfile).filter(Boolean);
  if (normalized.length === 0) {
    return "";
  }

  const cards = normalized.map((profile) => {
    const letter = resolveSeriesLetter(profile);
    const href = `../../OSD_Docs/${encodeHrefPart(letter)}/${encodeHrefPart(profile.key)}.html`;
    const stripSvg = renderStripSvg(profile.horizons, {
      width: 36,
      height: 100,
      label: `${profile.name} profile color strip`,
    });
    const isCurrent = Boolean(currentKey && profile.key === currentKey);
    const cardClass = isCurrent
      ? "osd-compare-card osd-compare-card--current"
      : "osd-compare-card";
    const taxHtml = profile.taxclname
      ? `<div class="osd-compare-tax">${escapeHtml(profile.taxclname)}</div>`
      : "";

    return [
      `<article class="${cardClass}" data-series-key="${escapeHtml(profile.key)}">`,
      `  <div class="osd-compare-card-header">`,
      `    <a class="osd-compare-link" href="${escapeHtml(href)}">${escapeHtml(profile.name)}</a>`,
      `    <button type="button" class="osd-compare-remove" data-remove-key="${escapeHtml(profile.key)}" aria-label="Remove ${escapeHtml(profile.name)} from comparison">&times;</button>`,
      `  </div>`,
      `  <a class="osd-compare-strip-link" href="${escapeHtml(href)}" tabindex="-1" aria-hidden="true">${stripSvg}</a>`,
      `  ${taxHtml}`,
      `</article>`,
    ]
      .filter((line) => line.trim().length > 0)
      .join("\n");
  });

  return `<div class="osd-compare-cards">\n${cards.join("\n")}\n</div>`;
}

/**
 * Parse `#osd-profile-data` JSON safely.
 *
 * @param {Document} doc
 * @returns {Record<string, any>|null}
 */
function readEmbeddedProfileData(doc) {
  const dataEl = doc.getElementById("osd-profile-data");
  if (!dataEl || typeof dataEl.textContent !== "string") {
    return null;
  }
  const raw = dataEl.textContent.trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Collect plottable horizon `<rect>` elements inside `.osd-pedon-sketch svg`,
 * excluding the SVG background `<rect>` when `data-horizon-id` attributes are present.
 *
 * @param {Document} doc
 * @returns {Array<Element>}
 */
function selectHorizonRects(doc) {
  if (typeof doc.querySelectorAll !== "function") {
    return [];
  }
  const allRects = Array.from(doc.querySelectorAll(".osd-pedon-sketch svg rect"));
  const horizonTagged = allRects.filter(
    (rect) => typeof rect?.getAttribute === "function" && Boolean(rect.getAttribute("data-horizon-id"))
  );
  return horizonTagged.length > 0 ? horizonTagged : allRects;
}

/**
 * Initialize interactive horizon tooltips and pinned profile comparison controls.
 *
 * @param {Document} [doc=globalThis.document]
 * @param {Storage} [storage=globalThis.localStorage]
 * @returns {{ profileData: Record<string, any>|null, showTooltip: (hz: Record<string, unknown>, target?: any, event?: any) => void, hideTooltip: () => void, syncCompareUi: () => void }|null}
 */
export function initProfileInteractive(
  doc = globalThis.document,
  storage = globalThis.localStorage
) {
  if (!doc || typeof doc.getElementById !== "function") {
    return null;
  }

  const profileData = readEmbeddedProfileData(doc);
  const horizons = Array.isArray(profileData?.horizons) ? profileData.horizons : [];
  const horizonRects = selectHorizonRects(doc);

  let tooltipEl = null;
  let activeHorizonIndex = -1;

  const sketchContainer =
    typeof doc.querySelector === "function" ? doc.querySelector(".osd-pedon-sketch") : null;

  if (horizonRects.length > 0 && horizons.length > 0 && typeof doc.createElement === "function") {
    tooltipEl = doc.createElement("div");
    tooltipEl.className = "osd-horizon-tooltip";
    tooltipEl.hidden = true;
    if (tooltipEl.style) {
      tooltipEl.style.display = "none";
    }
    if (typeof tooltipEl.setAttribute === "function") {
      tooltipEl.setAttribute("role", "tooltip");
      tooltipEl.setAttribute("aria-hidden", "true");
    }
    const host = sketchContainer || doc.body;
    if (host && typeof host.appendChild === "function") {
      host.appendChild(tooltipEl);
    }
  }

  function hideTooltip() {
    activeHorizonIndex = -1;
    if (!tooltipEl) {
      return;
    }
    tooltipEl.hidden = true;
    if (tooltipEl.style) {
      tooltipEl.style.display = "none";
    }
    if (typeof tooltipEl.setAttribute === "function") {
      tooltipEl.setAttribute("aria-hidden", "true");
    }
  }

  function positionTooltip(target, event) {
    if (!tooltipEl || !tooltipEl.style) {
      return;
    }
    const hostRect =
      sketchContainer && typeof sketchContainer.getBoundingClientRect === "function"
        ? sketchContainer.getBoundingClientRect()
        : null;
    if (!hostRect) {
      return;
    }

    if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
      tooltipEl.style.left = `${Math.round(event.clientX - hostRect.left + 12)}px`;
      tooltipEl.style.top = `${Math.round(event.clientY - hostRect.top + 12)}px`;
      return;
    }

    if (target && typeof target.getBoundingClientRect === "function") {
      const targetRect = target.getBoundingClientRect();
      tooltipEl.style.left = `${Math.round(targetRect.right - hostRect.left + 8)}px`;
      tooltipEl.style.top = `${Math.round(targetRect.top - hostRect.top)}px`;
    }
  }

  function showTooltip(hz, target = null, event = null) {
    if (!tooltipEl || !hz) {
      return;
    }
    tooltipEl.innerHTML = formatHorizonTooltip(hz);
    tooltipEl.hidden = false;
    if (tooltipEl.style) {
      tooltipEl.style.display = "block";
    }
    if (typeof tooltipEl.setAttribute === "function") {
      tooltipEl.setAttribute("aria-hidden", "false");
    }
    positionTooltip(target, event);
  }

  for (let i = 0; i < horizonRects.length && i < horizons.length; i += 1) {
    const rect = horizonRects[i];
    const hz = horizons[i];
    if (!rect || typeof rect.addEventListener !== "function") {
      continue;
    }

    if (typeof rect.setAttribute === "function") {
      if (typeof rect.getAttribute !== "function" || !rect.getAttribute("tabindex")) {
        rect.setAttribute("tabindex", "0");
      }
      const ariaParts = [hz.name || "Horizon"];
      if (Number.isFinite(hz.top) && Number.isFinite(hz.bottom)) {
        ariaParts.push(`${formatDepthValue(hz.top)}–${formatDepthValue(hz.bottom)} cm`);
      }
      rect.setAttribute("aria-label", ariaParts.join(", "));
    }

    rect.addEventListener("mouseenter", (event) => {
      activeHorizonIndex = i;
      showTooltip(hz, rect, event);
    });
    rect.addEventListener("mousemove", (event) => {
      if (activeHorizonIndex === i) {
        positionTooltip(rect, event);
      }
    });
    rect.addEventListener("mouseleave", () => {
      hideTooltip();
    });
    rect.addEventListener("focus", () => {
      activeHorizonIndex = i;
      showTooltip(hz, rect, null);
    });
    rect.addEventListener("blur", () => {
      hideTooltip();
    });
    rect.addEventListener("click", (event) => {
      if (activeHorizonIndex === i && tooltipEl && !tooltipEl.hidden) {
        hideTooltip();
      } else {
        activeHorizonIndex = i;
        showTooltip(hz, rect, event);
      }
    });
    rect.addEventListener("keydown", (event) => {
      const key = event?.key;
      if (key === "Escape") {
        hideTooltip();
      } else if (key === "Enter" || key === " ") {
        if (typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (activeHorizonIndex === i && tooltipEl && !tooltipEl.hidden) {
          hideTooltip();
        } else {
          activeHorizonIndex = i;
          showTooltip(hz, rect, null);
        }
      }
    });
  }

  const toggleBtn = doc.getElementById("osd-compare-toggle");
  const trayEl = doc.getElementById("osd-compare-tray");

  function syncCompareUi() {
    const pinned = loadPinnedProfiles(storage);
    const currentKey = typeof profileData?.key === "string" ? profileData.key : "";
    const isPinned = Boolean(currentKey && pinned.some((item) => item.key === currentKey));

    if (toggleBtn) {
      if (typeof toggleBtn.setAttribute === "function") {
        toggleBtn.setAttribute("aria-pressed", isPinned ? "true" : "false");
      }
      toggleBtn.textContent = isPinned
        ? `Pinned to Compare (${pinned.length}/${MAX_PINNED_PROFILES})`
        : `Pin to Compare (${pinned.length}/${MAX_PINNED_PROFILES})`;
      toggleBtn.disabled = !profileData;
    }

    if (trayEl) {
      const html = renderComparisonTrayHtml(pinned, currentKey);
      trayEl.innerHTML = html;
      trayEl.hidden = pinned.length === 0;
    }
  }

  syncCompareUi();

  if (toggleBtn && typeof toggleBtn.addEventListener === "function") {
    toggleBtn.addEventListener("click", () => {
      if (!profileData) {
        return;
      }
      togglePinnedProfile(storage, profileData);
      syncCompareUi();
    });
  }

  if (trayEl && typeof trayEl.addEventListener === "function") {
    trayEl.addEventListener("click", (event) => {
      const target = event?.target;
      const removeBtn =
        typeof target?.closest === "function"
          ? target.closest("[data-remove-key]")
          : typeof target?.getAttribute === "function" && target.getAttribute("data-remove-key")
            ? target
            : null;
      const removeKey = removeBtn?.getAttribute?.("data-remove-key");
      if (!removeKey) {
        return;
      }
      const next = loadPinnedProfiles(storage).filter((item) => item.key !== removeKey);
      savePinnedProfiles(storage, next);
      syncCompareUi();
    });
  }

  return {
    profileData,
    showTooltip,
    hideTooltip,
    syncCompareUi,
  };
}

if (typeof document !== "undefined") {
  const autoInit = () => {
    if (
      document.getElementById("osd-profile-data") ||
      document.getElementById("osd-compare-tray")
    ) {
      initProfileInteractive(document, globalThis.localStorage);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
}
