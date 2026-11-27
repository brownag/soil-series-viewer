/**
 * Pure ESM browser Taxonomy Explorer application for soil-series-viewer.
 * Zero Node-only imports: runs natively in browsers and `node:test`.
 */

import { renderStripSvg } from "./strip-svg.js";

export const DEFAULT_TREE_URL = "../data/taxonomy-tree.json";
export const DEFAULT_CRITERIA_URL = "../data/kst-criteria.json";
export const DEFAULT_STRIPS_BASE_URL = "../data/strips";

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const RANK_LABELS = {
  order: "Order",
  suborder: "Suborder",
  greatgroup: "Great Group",
  subgroup: "Subgroup",
  family: "Family",
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

function formatRankLabel(rank) {
  if (typeof rank !== "string" || rank.length === 0) {
    return "Taxon";
  }
  return RANK_LABELS[rank] ?? rank;
}

function resolveItemLetter(item) {
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

function normalizeHashPath(hashPath) {
  if (typeof hashPath !== "string") {
    return "";
  }
  return hashPath.replace(/^#/, "").replace(/^\/+|\/+$/g, "").trim();
}

/**
 * Walk `tree.orders` by `/`-separated slugs (stripping leading `#`).
 *
 * @param {{ orders?: Array<object> }|null|undefined} tree
 * @param {string} [hashPath=""]
 * @returns {{ trail: Array<{ name: string, slug: string, rank: string, code: string|null, hashPath: string }>, node: object|null, children: Array<object>, series: Array<object> }}
 */
export function resolveTaxonPath(tree, hashPath = "") {
  const orders = Array.isArray(tree?.orders) ? tree.orders : [];
  const cleaned = normalizeHashPath(hashPath);

  if (!cleaned) {
    return {
      trail: [],
      node: null,
      children: orders,
      series: [],
    };
  }

  const segments = cleaned
    .split("/")
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0);

  if (segments.length === 0) {
    return {
      trail: [],
      node: null,
      children: orders,
      series: [],
    };
  }

  const trail = [];
  const accSlugs = [];
  let currentList = orders;
  let currentNode = null;

  for (const segment of segments) {
    const match = Array.isArray(currentList)
      ? currentList.find((candidate) => candidate && candidate.slug === segment)
      : null;

    if (!match) {
      return {
        trail,
        node: null,
        children: [],
        series: [],
      };
    }

    accSlugs.push(match.slug);
    trail.push({
      name: match.name,
      slug: match.slug,
      rank: match.rank,
      code: match.code ?? null,
      hashPath: accSlugs.join("/"),
    });
    currentNode = match;
    currentList = Array.isArray(match.children) ? match.children : [];
  }

  return {
    trail,
    node: currentNode,
    children: Array.isArray(currentNode?.children) ? currentNode.children : [],
    series: Array.isArray(currentNode?.series) ? currentNode.series : [],
  };
}

/**
 * Render a KST 2022 criteria box (`Chapter X, p. Y — Key Name` + list of escaped clauses),
 * or `""` when `criteriaEntry` is null/empty.
 *
 * @param {object|null|undefined} criteriaEntry
 * @returns {string}
 */
export function renderCriteriaHtml(criteriaEntry) {
  if (!criteriaEntry || typeof criteriaEntry !== "object") {
    return "";
  }

  const clauses = Array.isArray(criteriaEntry.clauses)
    ? criteriaEntry.clauses.filter((c) => typeof c === "string" && c.trim().length > 0)
    : [];

  const metaParts = [];
  if (criteriaEntry.chapter !== null && criteriaEntry.chapter !== undefined && criteriaEntry.chapter !== "") {
    metaParts.push(`Chapter ${criteriaEntry.chapter}`);
  }
  if (criteriaEntry.page !== null && criteriaEntry.page !== undefined && criteriaEntry.page !== "") {
    metaParts.push(`p. ${criteriaEntry.page}`);
  }

  const locationPart = metaParts.join(", ");
  const keyName = typeof criteriaEntry.key === "string" ? criteriaEntry.key.trim() : "";
  let metaLine = "";
  if (locationPart && keyName) {
    metaLine = `${locationPart} — ${keyName}`;
  } else if (locationPart) {
    metaLine = locationPart;
  } else if (keyName) {
    metaLine = keyName;
  }

  if (clauses.length === 0 && !metaLine) {
    return "";
  }

  const titleName = typeof criteriaEntry.name === "string" ? criteriaEntry.name.trim() : "";
  const code = typeof criteriaEntry.code === "string" ? criteriaEntry.code.trim() : "";
  const headingText = titleName
    ? `Keys to Soil Taxonomy (2022): ${titleName}${code ? ` (${code})` : ""}`
    : "Keys to Soil Taxonomy (2022)";

  const clausesHtml =
    clauses.length > 0
      ? [
          `  <ul class="tax-criteria-clauses">`,
          ...clauses.map((clause) => `    <li>${escapeHtml(clause)}</li>`),
          `  </ul>`,
        ].join("\n")
      : "";

  return [
    `<div class="tax-criteria-box">`,
    `  <div class="tax-criteria-header">`,
    `    <h2 class="tax-criteria-title">${escapeHtml(headingText)}</h2>`,
    `  </div>`,
    metaLine ? `  <div class="tax-criteria-meta">${escapeHtml(metaLine)}</div>` : "",
    clausesHtml,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Render a subordinate taxon card `<a class="tax-card" href="#${hashPath}">`.
 *
 * @param {object} child
 * @param {string} [parentHashPath=""]
 * @returns {string}
 */
export function renderTaxonCardHtml(child, parentHashPath = "") {
  const cleanParent = normalizeHashPath(parentHashPath);
  const slug = typeof child?.slug === "string" ? child.slug : "";
  const hashPath = cleanParent ? `${cleanParent}/${slug}` : slug;
  const name = typeof child?.name === "string" && child.name.length > 0 ? child.name : slug;
  const rank = typeof child?.rank === "string" ? child.rank : "";
  const rankLabel = formatRankLabel(rank);
  const code = typeof child?.code === "string" && child.code.trim().length > 0 ? child.code.trim() : "";
  const count = Number.isFinite(Number(child?.count)) ? Number(child.count) : 0;
  const countLabel = `${count.toLocaleString("en-US")} ${count === 1 ? "series" : "series"}`;

  const codeHtml = code ? `<span class="tax-card-code">${escapeHtml(code)}</span>` : "";

  return [
    `<a class="tax-card" href="#${escapeHtml(hashPath)}" data-rank="${escapeHtml(rank)}">`,
    `  <div class="tax-card-header">`,
    `    <span class="tax-card-rank">${escapeHtml(rankLabel)}</span>`,
    codeHtml ? `    ${codeHtml}` : "",
    `  </div>`,
    `  <div class="tax-card-name">${escapeHtml(name)}</div>`,
    `  <div class="tax-card-count">${escapeHtml(countLabel)}</div>`,
    `</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Render a member series card `<a class="tax-series-card" href="../OSD_Docs/${l}/${encodedKey}.html">`
 * with a compact 32x84 SVG color strip, series name, and optional status badge.
 *
 * @param {object} seriesItem
 * @param {Array<object>|null} [stripHorizons=null]
 * @returns {string}
 */
export function renderMemberSeriesCardHtml(seriesItem, stripHorizons = null) {
  const key =
    typeof seriesItem?.k === "string" && seriesItem.k.length > 0
      ? seriesItem.k
      : String(seriesItem?.n ?? "");
  const name =
    typeof seriesItem?.n === "string" && seriesItem.n.length > 0 ? seriesItem.n : key;
  const letter = resolveItemLetter(seriesItem);
  const status =
    typeof seriesItem?.s === "string" && seriesItem.s.trim().length > 0
      ? seriesItem.s.trim()
      : "";
  const href = `../OSD_Docs/${encodeHrefPart(letter)}/${encodeHrefPart(key)}.html`;
  const svg = renderStripSvg(stripHorizons, {
    width: 32,
    height: 84,
    label: `${name} soil profile color strip`,
  });

  const statusHtml = status
    ? `    <span class="tax-series-card-status">${escapeHtml(status)}</span>`
    : "";

  return [
    `<a class="tax-series-card" href="${escapeHtml(href)}" data-series-key="${escapeHtml(key)}" data-shard-letter="${escapeHtml(letter)}">`,
    `  <span class="tax-series-card-strip" aria-hidden="true">${svg}</span>`,
    `  <span class="tax-series-card-meta">`,
    `    <span class="tax-series-card-name">${escapeHtml(name)}</span>`,
    statusHtml,
    `  </span>`,
    `</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function createStripShardLoader(fetchFn, stripsBaseUrl = DEFAULT_STRIPS_BASE_URL) {
  const shardPromises = new Map();
  const resolvedShards = new Map();
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
        resolvedShards.set(normalized, {});
        return {};
      }
      try {
        const url = `${baseUrl}/${encodeURIComponent(normalized)}.json`;
        const response = await fetchFn(url);
        if (!response || !response.ok) {
          resolvedShards.set(normalized, {});
          return {};
        }
        const data = await response.json();
        const shard = data && typeof data === "object" ? data : {};
        resolvedShards.set(normalized, shard);
        return shard;
      } catch {
        resolvedShards.set(normalized, {});
        return {};
      }
    })();

    shardPromises.set(normalized, promise);
    return promise;
  }

  return {
    loadShard,
    getCachedHorizons(letter, key) {
      const shard = resolvedShards.get(normalizeLetter(letter));
      const horizons = shard && key ? shard[key] : null;
      return Array.isArray(horizons) ? horizons : null;
    },
    hasCachedShard(letter) {
      return shardPromises.has(normalizeLetter(letter));
    },
  };
}

function renderBreadcrumbsHtml(trail, hasUnknownPath = false) {
  const parts = [];
  if (trail.length === 0 && !hasUnknownPath) {
    parts.push(`<span class="tax-breadcrumb-current" aria-current="page">All Soil Orders</span>`);
  } else {
    parts.push(`<a href="#">All Soil Orders</a>`);
  }

  for (let i = 0; i < trail.length; i++) {
    const crumb = trail[i];
    const isLast = i === trail.length - 1 && !hasUnknownPath;
    parts.push(`<span class="tax-breadcrumb-sep" aria-hidden="true">/</span>`);
    if (isLast) {
      parts.push(
        `<span class="tax-breadcrumb-current" aria-current="page">${escapeHtml(crumb.name)}</span>`
      );
    } else {
      parts.push(`<a href="#${escapeHtml(crumb.hashPath)}">${escapeHtml(crumb.name)}</a>`);
    }
  }

  return parts.join(" ");
}

async function safeFetchJson(fetchFn, url, fallback = null) {
  if (typeof fetchFn !== "function") {
    return fallback;
  }
  try {
    const response = await fetchFn(url);
    if (!response || !response.ok) {
      return fallback;
    }
    const data = await response.json();
    return data && typeof data === "object" ? data : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Initialize the Taxonomy Explorer client app against DOM and fetch environment.
 *
 * @param {object} [options={}]
 * @param {Document} [options.document]
 * @param {Document} [options.doc]
 * @param {Window|object} [options.window]
 * @param {Window|object} [options.win]
 * @param {typeof fetch} [options.fetch]
 * @param {string} [options.treeUrl="../data/taxonomy-tree.json"]
 * @param {string} [options.criteriaUrl="../data/kst-criteria.json"]
 * @param {string} [options.stripsBaseUrl="../data/strips"]
 * @returns {Promise<object|null>}
 */
export async function initTaxonomyApp(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const doc = opts.document ?? opts.doc ?? globalThis.document;
  if (!doc || typeof doc.getElementById !== "function") {
    return null;
  }

  const appEl = doc.getElementById("taxonomy-app");
  if (!appEl) {
    return null;
  }

  const win = opts.window ?? opts.win ?? globalThis.window ?? globalThis;
  const fetchFn =
    typeof opts.fetch === "function"
      ? opts.fetch
      : typeof win?.fetch === "function"
        ? win.fetch.bind(win)
        : typeof globalThis.fetch === "function"
          ? globalThis.fetch.bind(globalThis)
          : null;

  const treeUrl = opts.treeUrl ?? win?.TAXONOMY_TREE_URL ?? DEFAULT_TREE_URL;
  const criteriaUrl = opts.criteriaUrl ?? win?.KST_CRITERIA_URL ?? DEFAULT_CRITERIA_URL;
  const stripsBaseUrl = opts.stripsBaseUrl ?? win?.TAXONOMY_STRIPS_BASE_URL ?? DEFAULT_STRIPS_BASE_URL;

  const breadcrumbsEl = doc.getElementById("tax-breadcrumbs");
  const criteriaEl = doc.getElementById("tax-criteria");
  const childrenEl = doc.getElementById("tax-children");
  const seriesEl = doc.getElementById("tax-series");
  const statusEl = doc.getElementById("tax-status");

  const stripLoader = createStripShardLoader(fetchFn, stripsBaseUrl);
  const state = {
    tree: { totalSeries: 0, classifiedSeries: 0, orders: [] },
    criteria: {},
    renderEpoch: 0,
  };

  function hydrateSeriesStrips(seriesList, epoch) {
    if (!seriesEl || !Array.isArray(seriesList) || seriesList.length === 0) {
      return;
    }

    const byLetter = new Map();
    for (const item of seriesList) {
      const letter = resolveItemLetter(item);
      if (!byLetter.has(letter)) {
        byLetter.set(letter, []);
      }
      byLetter.get(letter).push(item);
    }

    for (const [letter, items] of byLetter.entries()) {
      void stripLoader.loadShard(letter).then((shard) => {
        if (state.renderEpoch !== epoch) {
          return;
        }
        if (typeof seriesEl.querySelectorAll === "function") {
          const cards = seriesEl.querySelectorAll(`[data-shard-letter="${letter}"]`);
          for (const card of cards) {
            const key = card.getAttribute ? card.getAttribute("data-series-key") : "";
            const horizons = key && Array.isArray(shard[key]) ? shard[key] : null;
            if (!horizons) {
              continue;
            }
            const stripWrap = card.querySelector ? card.querySelector(".tax-series-card-strip") : null;
            if (stripWrap) {
              const nameEl = card.querySelector(".tax-series-card-name");
              const labelName = nameEl?.textContent || key;
              stripWrap.innerHTML = renderStripSvg(horizons, {
                width: 32,
                height: 84,
                label: `${labelName} soil profile color strip`,
              });
            }
          }
          return;
        }

        // Fallback for minimal mock DOM without querySelectorAll
        const heading = `<h2 class="tax-section-heading">Member Soil Series (${seriesList.length.toLocaleString("en-US")})</h2>`;
        const cardsHtml = seriesList
          .map((it) =>
            renderMemberSeriesCardHtml(
              it,
              stripLoader.getCachedHorizons(resolveItemLetter(it), it.k)
            )
          )
          .join("\n");
        seriesEl.innerHTML = `${heading}\n<div class="tax-series-grid">\n${cardsHtml}\n</div>`;
      });
    }
  }

  function renderRoute() {
    state.renderEpoch += 1;
    const epoch = state.renderEpoch;
    const rawHash = win?.location?.hash ?? "";
    const cleanedHash = normalizeHashPath(rawHash);
    const resolved = resolveTaxonPath(state.tree, cleanedHash);
    const isUnknownPath = cleanedHash.length > 0 && resolved.node === null;

    if (breadcrumbsEl) {
      breadcrumbsEl.innerHTML = renderBreadcrumbsHtml(resolved.trail, isUnknownPath);
    }

    if (statusEl) {
      if (isUnknownPath) {
        statusEl.textContent = `Taxon path "#${cleanedHash}" was not found.`;
      } else if (!resolved.node) {
        const orderCount = resolved.children.length;
        const classified = Number(state.tree.classifiedSeries ?? 0).toLocaleString("en-US");
        const total = Number(state.tree.totalSeries ?? 0).toLocaleString("en-US");
        statusEl.textContent = `Showing ${orderCount} soil orders (${classified} classified of ${total} series)`;
      } else {
        const rankLabel = formatRankLabel(resolved.node.rank);
        const codePart = resolved.node.code ? `, KST ${resolved.node.code}` : "";
        const count = Number(resolved.node.count ?? 0).toLocaleString("en-US");
        statusEl.textContent = `${resolved.node.name} (${rankLabel}${codePart}) — ${count} series`;
      }
    }

    if (criteriaEl) {
      const code = resolved.node?.code;
      const entry = code && state.criteria && Object.hasOwn(state.criteria, code)
        ? state.criteria[code]
        : null;
      const criteriaHtml = renderCriteriaHtml(entry);
      criteriaEl.innerHTML = criteriaHtml;
      criteriaEl.hidden = criteriaHtml.length === 0;
    }

    if (childrenEl) {
      if (isUnknownPath) {
        childrenEl.innerHTML = `<div class="tax-empty">No matching taxon found. <a href="#">Return to all soil orders</a>.</div>`;
        childrenEl.hidden = false;
      } else if (resolved.children.length > 0) {
        const parentHashPath = resolved.node
          ? resolved.trail.map((t) => t.slug).join("/")
          : "";
        const headingText = resolved.node
          ? `Subordinate Taxa (${resolved.children.length.toLocaleString("en-US")})`
          : `Soil Orders (${resolved.children.length.toLocaleString("en-US")})`;
        const cardsHtml = resolved.children
          .map((child) => renderTaxonCardHtml(child, parentHashPath))
          .join("\n");
        childrenEl.innerHTML = `<h2 class="tax-section-heading">${escapeHtml(headingText)}</h2>\n<div class="tax-grid">\n${cardsHtml}\n</div>`;
        childrenEl.hidden = false;
      } else {
        childrenEl.innerHTML = "";
        childrenEl.hidden = true;
      }
    }

    if (seriesEl) {
      if (resolved.series.length > 0) {
        const heading = `<h2 class="tax-section-heading">Member Soil Series (${resolved.series.length.toLocaleString("en-US")})</h2>`;
        const cardsHtml = resolved.series
          .map((item) => renderMemberSeriesCardHtml(item, null))
          .join("\n");
        seriesEl.innerHTML = `${heading}\n<div class="tax-series-grid">\n${cardsHtml}\n</div>`;
        seriesEl.hidden = false;
        hydrateSeriesStrips(resolved.series, epoch);
      } else {
        seriesEl.innerHTML = "";
        seriesEl.hidden = true;
      }
    }
  }

  const onHashChange = () => {
    renderRoute();
  };

  if (typeof win?.addEventListener === "function") {
    win.addEventListener("hashchange", onHashChange);
  }

  const [treeData, criteriaData] = await Promise.all([
    safeFetchJson(fetchFn, treeUrl, null),
    safeFetchJson(fetchFn, criteriaUrl, {}),
  ]);

  if (!treeData || !Array.isArray(treeData.orders)) {
    if (statusEl) {
      statusEl.textContent = "Unable to load taxonomy tree.";
    }
  } else {
    state.tree = treeData;
    state.criteria = criteriaData && typeof criteriaData === "object" ? criteriaData : {};
    renderRoute();
  }

  return {
    state,
    renderRoute,
    stripLoader,
    destroy() {
      if (typeof win?.removeEventListener === "function") {
        win.removeEventListener("hashchange", onHashChange);
      }
    },
  };
}

if (typeof document !== "undefined") {
  const autoStart = () => {
    if (document.getElementById("taxonomy-app")) {
      void initTaxonomyApp();
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoStart);
  } else {
    autoStart();
  }
}
