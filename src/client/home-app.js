/**
 * Pure ESM browser gallery application for soil-series-viewer.
 * Zero Node-only imports: runs natively in browsers and `node:test`.
 */

import { initFullTextSearch } from "./fulltext-search.js";
import { computeFacetCounts, FACET_KEY_MAP, filterSeries } from "./search-engine.js";
import { renderStripSvg } from "./strip-svg.js";

export const DEFAULT_BATCH_SIZE = 60;
export const DEFAULT_INDEX_URL = "./data/search-index.json";
export const DEFAULT_STRIPS_BASE_URL = "./data/strips";

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
export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

function encodeHrefPart(value) {
  return encodeURI(String(value ?? "")).replaceAll("#", "%23").replaceAll("?", "%3F");
}

/**
 * Resolve the uppercase shard letter (`A`-`Z` or `_`) for a compact index item.
 *
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function resolveItemLetter(item) {
  const raw =
    typeof item?.l === "string" && item.l.trim().length > 0
      ? item.l.trim()
      : typeof item?.k === "string" && item.k.trim().length > 0
        ? item.k.trim()
        : typeof item?.n === "string"
          ? item.n.trim()
          : "";
  const first = raw.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "_";
}

/**
 * Build the relative OSD page URL `./OSD_Docs/<L>/<KEY>.html` for a series item.
 *
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function buildSeriesHref(item) {
  const letter = resolveItemLetter(item);
  const key =
    typeof item?.k === "string" && item.k.length > 0
      ? item.k
      : typeof item?.n === "string"
        ? item.n
        : "";
  return `./OSD_Docs/${encodeHrefPart(letter)}/${encodeHrefPart(key)}.html`;
}

/**
 * Build a concise taxonomy subtitle string from compact index fields.
 *
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function formatTaxonomySummary(item) {
  if (!item || typeof item !== "object") {
    return "Taxonomic class unavailable";
  }
  const primaryTax = item.sg || item.gg || item.so || item.o || "";
  const parts = [primaryTax, item.ps].filter((v) => typeof v === "string" && v.length > 0);
  return parts.length > 0 ? parts.join(", ") : "Taxonomic class unavailable";
}

/**
 * Render the HTML markup for a single gallery card.
 *
 * @param {Record<string, unknown>} item
 * @param {Array<Record<string, unknown>>|null} [stripHorizons=null]
 * @returns {string}
 */
export function renderSeriesCardHtml(item, stripHorizons = null) {
  const key = typeof item?.k === "string" && item.k.length > 0 ? item.k : String(item?.n ?? "");
  const name = typeof item?.n === "string" && item.n.length > 0 ? item.n : key;
  const letter = resolveItemLetter(item);
  const href = buildSeriesHref(item);
  const taxonomy = formatTaxonomySummary(item);
  const svg = renderStripSvg(stripHorizons, { label: `${name} soil profile color strip` });

  const badges = [];
  if (typeof item?.s === "string" && item.s.length > 0) {
    badges.push(`<span class="series-card-badge">${escapeHtml(item.s)}</span>`);
  }
  if (typeof item?.st === "string" && item.st.length > 0) {
    badges.push(`<span class="series-card-badge">${escapeHtml(item.st)}</span>`);
  }
  if (item?.bm === true) {
    badges.push(
      `<span class="series-card-badge series-card-badge--benchmark">Benchmark</span>`
    );
  }

  const badgesHtml =
    badges.length > 0 ? `<div class="series-card-badges">${badges.join("")}</div>` : "";

  return [
    `<article class="series-card" data-series-key="${escapeHtml(key)}" data-shard-letter="${escapeHtml(letter)}">`,
    `  <a class="series-card-sketch" href="${escapeHtml(href)}" tabindex="-1" aria-hidden="true">${svg}</a>`,
    `  <div class="series-card-meta">`,
    `    <div class="series-card-name"><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></div>`,
    `    <div class="series-card-tax">${escapeHtml(taxonomy)}</div>`,
    badgesHtml ? `    ${badgesHtml}` : "",
    `  </div>`,
    `</article>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Compute the next slice window `[start, end)` for incremental batch rendering.
 *
 * @param {number} total
 * @param {number} renderedCount
 * @param {number} [batchSize=DEFAULT_BATCH_SIZE]
 * @returns {{ start: number, end: number, hasMore: boolean }}
 */
export function computeNextWindow(total, renderedCount, batchSize = DEFAULT_BATCH_SIZE) {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const safeRendered =
    Number.isFinite(renderedCount) && renderedCount > 0
      ? Math.min(safeTotal, Math.floor(renderedCount))
      : 0;
  const safeBatch =
    Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : DEFAULT_BATCH_SIZE;
  const end = Math.min(safeTotal, safeRendered + safeBatch);
  return {
    start: safeRendered,
    end,
    hasMore: end < safeTotal,
  };
}

/**
 * Build option descriptors for a facet `<select>` using current facet counts.
 * Preserves any active selection even when its filtered count is 0.
 *
 * @param {string[]} values
 * @param {Record<string, number>} [counts={}]
 * @param {string} [selectedValue=""]
 * @returns {Array<{ value: string, label: string, count: number, selected: boolean }>}
 */
export function buildFacetOptions(values, counts = {}, selectedValue = "") {
  const ordered = Array.isArray(values) ? [...values] : [];
  if (selectedValue && !ordered.includes(selectedValue)) {
    ordered.push(selectedValue);
  }
  return ordered.map((value) => {
    const count = Number(counts?.[value] ?? 0);
    return {
      value,
      label: `${value} (${count})`,
      count,
      selected: value === selectedValue,
    };
  });
}

/**
 * Create a cached loader for `./data/strips/<L>.json` shards.
 * Guarantees each letter shard is fetched at most once and cached in memory.
 *
 * @param {typeof fetch} fetchFn
 * @param {string} [stripsBaseUrl=DEFAULT_STRIPS_BASE_URL]
 * @returns {{ loadShard: (letter: string) => Promise<Record<string, Array>>, getStrip: (letter: string, key: string) => Promise<Array|null>, hasCachedShard: (letter: string) => boolean }}
 */
export function createStripShardLoader(fetchFn, stripsBaseUrl = DEFAULT_STRIPS_BASE_URL) {
  const shardPromises = new Map();
  const baseUrl = String(stripsBaseUrl || DEFAULT_STRIPS_BASE_URL).replace(/\/+$/, "");

  function normalizeLetter(letter) {
    const first = typeof letter === "string" ? letter.trim().charAt(0).toUpperCase() : "";
    return /^[A-Z]$/.test(first) ? first : "_";
  }

  function loadShard(letter) {
    const normalized = normalizeLetter(letter);
    if (shardPromises.has(normalized)) {
      return shardPromises.get(normalized);
    }

    const promise = (async () => {
      if (typeof fetchFn !== "function") {
        return {};
      }
      try {
        const url = `${baseUrl}/${encodeURIComponent(normalized)}.json`;
        const response = await fetchFn(url);
        if (!response || !response.ok) {
          return {};
        }
        const data = await response.json();
        return data && typeof data === "object" ? data : {};
      } catch {
        return {};
      }
    })();

    shardPromises.set(normalized, promise);
    return promise;
  }

  async function getStrip(letter, key) {
    if (typeof key !== "string" || key.length === 0) {
      return null;
    }
    const shard = await loadShard(letter);
    const horizons = shard[key];
    return Array.isArray(horizons) ? horizons : null;
  }

  return {
    loadShard,
    getStrip,
    hasCachedShard(letter) {
      return shardPromises.has(normalizeLetter(letter));
    },
  };
}

function formatStatusText(filteredCount, totalCount) {
  if (totalCount === 0) {
    return "0 series indexed";
  }
  if (filteredCount === totalCount) {
    return `Showing ${totalCount.toLocaleString("en-US")} series`;
  }
  return `Showing ${filteredCount.toLocaleString("en-US")} of ${totalCount.toLocaleString("en-US")} series`;
}

function populateSelectOptions(doc, selectEl, values, counts, selectedValue) {
  if (!selectEl || !doc) {
    return;
  }
  const options = buildFacetOptions(values, counts, selectedValue);
  selectEl.innerHTML = "";

  const allOpt = doc.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All";
  selectEl.appendChild(allOpt);

  for (const optData of options) {
    const opt = doc.createElement("option");
    opt.value = optData.value;
    opt.textContent = optData.label;
    if (optData.selected) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  }
  selectEl.value = selectedValue || "";
}

/**
 * Initialize the home page gallery application against a DOM `document`.
 *
 * @param {Document} [doc=globalThis.document]
 * @param {object} [env=globalThis]
 * @returns {Promise<object|null>} Controller handle (useful for tests) or `null`
 */
export async function initHomeApp(doc = globalThis.document, env = globalThis) {
  if (!doc || typeof doc.getElementById !== "function") {
    return null;
  }

  const searchInput = doc.getElementById("series-search");
  const statusEl = doc.getElementById("home-status");
  const clearBtn = doc.getElementById("home-clear-btn");
  const galleryGrid = doc.getElementById("gallery-grid");
  const emptyState = doc.getElementById("home-empty-state");
  const moreWrap = doc.getElementById("gallery-more-wrap");
  const loadMoreBtn = doc.getElementById("gallery-load-more");
  const sentinelEl = doc.getElementById("gallery-sentinel");
  const fulltextPanel = doc.getElementById("fulltext-search-panel");

  if (!galleryGrid) {
    return null;
  }

  let fulltextPromise = null;
  if (fulltextPanel) {
    const fulltextOptions = {};
    if (typeof env?.HOME_APP_PAGEFIND_PATH === "string" && env.HOME_APP_PAGEFIND_PATH.length > 0) {
      fulltextOptions.basePath = env.HOME_APP_PAGEFIND_PATH;
    }
    if (env?.HOME_APP_PAGEFIND !== undefined) {
      fulltextOptions.pagefind = env.HOME_APP_PAGEFIND;
    }
    if (typeof env?.HOME_APP_PAGEFIND_LOADER === "function") {
      fulltextOptions.loader = env.HOME_APP_PAGEFIND_LOADER;
    }
    fulltextPromise = initFullTextSearch(fulltextPanel, fulltextOptions).catch(() => null);
  }

  const fetchFn = typeof env?.fetch === "function" ? env.fetch.bind(env) : null;
  const indexUrl = env?.HOME_APP_INDEX_URL || DEFAULT_INDEX_URL;
  const stripsBaseUrl = env?.HOME_APP_STRIPS_BASE_URL || DEFAULT_STRIPS_BASE_URL;
  const batchSize =
    Number.isFinite(env?.HOME_APP_BATCH_SIZE) && env.HOME_APP_BATCH_SIZE > 0
      ? env.HOME_APP_BATCH_SIZE
      : DEFAULT_BATCH_SIZE;

  const stripLoader = createStripShardLoader(fetchFn, stripsBaseUrl);
  const facetControls = new Map();
  for (const facetName of Object.keys(FACET_KEY_MAP)) {
    const el = doc.getElementById(`facet-${facetName}`);
    if (el) {
      facetControls.set(facetName, el);
    }
  }

  const state = {
    allItems: [],
    facetValues: {},
    filtered: [],
    renderedCount: 0,
    renderEpoch: 0,
  };

  function readActiveFacets() {
    const facets = {};
    for (const [facetName, el] of facetControls.entries()) {
      if (el.type === "checkbox") {
        if (el.checked) {
          facets[facetName] = true;
        }
      } else if (typeof el.value === "string" && el.value.length > 0) {
        facets[facetName] = el.value;
      }
    }
    return facets;
  }

  function hydrateBatchSketches(cards, epoch) {
    if (cards.length === 0) {
      return;
    }
    const letters = new Set(cards.map((c) => c.letter));
    for (const letter of letters) {
      void stripLoader.loadShard(letter).then((shard) => {
        if (state.renderEpoch !== epoch) {
          return;
        }
        for (const card of cards) {
          if (card.letter !== letter) {
            continue;
          }
          const horizons = Array.isArray(shard[card.key]) ? shard[card.key] : null;
          if (horizons && card.sketchEl) {
            card.sketchEl.innerHTML = renderStripSvg(horizons, {
              label: `${card.name} soil profile color strip`,
            });
          }
        }
      });
    }
  }

  function renderNextBatch() {
    const { start, end, hasMore } = computeNextWindow(
      state.filtered.length,
      state.renderedCount,
      batchSize
    );
    if (end <= start) {
      if (moreWrap) {
        moreWrap.hidden = true;
      }
      return;
    }

    const fragment = doc.createDocumentFragment();
    const pendingSketches = [];
    const holder = doc.createElement("div");

    for (let i = start; i < end; i++) {
      const item = state.filtered[i];
      holder.innerHTML = renderSeriesCardHtml(item, null);
      const cardEl = holder.firstElementChild;
      if (!cardEl) {
        continue;
      }
      const sketchEl = cardEl.querySelector
        ? cardEl.querySelector(".series-card-sketch")
        : null;
      const letter = resolveItemLetter(item);
      const key =
        typeof item?.k === "string" && item.k.length > 0 ? item.k : String(item?.n ?? "");
      const name = typeof item?.n === "string" && item.n.length > 0 ? item.n : key;
      pendingSketches.push({ letter, key, name, sketchEl });
      fragment.appendChild(cardEl);
    }

    galleryGrid.appendChild(fragment);
    state.renderedCount = end;

    if (moreWrap) {
      moreWrap.hidden = !hasMore;
    }

    hydrateBatchSketches(pendingSketches, state.renderEpoch);
  }

  function applyFilters() {
    state.renderEpoch += 1;
    const query = searchInput ? searchInput.value : "";
    const facets = readActiveFacets();

    state.filtered = filterSeries(state.allItems, { query, facets });
    const counts = computeFacetCounts(state.filtered);

    if (statusEl) {
      statusEl.textContent = formatStatusText(state.filtered.length, state.allItems.length);
    }

    for (const [facetName, el] of facetControls.entries()) {
      if (el.type === "checkbox") {
        continue;
      }
      const baseValues = state.facetValues[facetName] || [];
      populateSelectOptions(doc, el, baseValues, counts[facetName] || {}, el.value || "");
    }

    galleryGrid.innerHTML = "";
    state.renderedCount = 0;

    if (emptyState) {
      emptyState.hidden = state.filtered.length > 0;
    }

    renderNextBatch();
  }

  function clearFilters() {
    if (searchInput) {
      searchInput.value = "";
    }
    for (const el of facetControls.values()) {
      if (el.type === "checkbox") {
        el.checked = false;
      } else {
        el.value = "";
      }
    }
    applyFilters();
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
  for (const el of facetControls.values()) {
    el.addEventListener("change", applyFilters);
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", clearFilters);
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", renderNextBatch);
  }

  let observer = null;
  if (sentinelEl && typeof env?.IntersectionObserver === "function") {
    observer = new env.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          renderNextBatch();
        }
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(sentinelEl);
  }

  if (fetchFn) {
    try {
      const response = await fetchFn(indexUrl);
      if (!response || !response.ok) {
        throw new Error(`HTTP ${response?.status ?? "error"}`);
      }
      const payload = await response.json();
      state.allItems = Array.isArray(payload?.items) ? payload.items : [];
      state.facetValues =
        payload?.facets && typeof payload.facets === "object" ? payload.facets : {};
      if (galleryGrid.setAttribute) {
        galleryGrid.setAttribute("aria-busy", "false");
      }
      applyFilters();
    } catch {
      if (galleryGrid.setAttribute) {
        galleryGrid.setAttribute("aria-busy", "false");
      }
      if (statusEl) {
        statusEl.textContent = "Unable to load series index.";
      }
    }
  }

  const fulltext = fulltextPromise ? await fulltextPromise : null;

  return {
    state,
    applyFilters,
    clearFilters,
    renderNextBatch,
    stripLoader,
    fulltext,
    destroy() {
      if (observer && typeof observer.disconnect === "function") {
        observer.disconnect();
      }
      if (fulltext && typeof fulltext.destroy === "function") {
        fulltext.destroy();
      }
    },
  };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void initHomeApp(document, globalThis);
    });
  } else {
    void initHomeApp(document, globalThis);
  }
}
