/**
 * Pure ESM browser application for the Soil Taxonomy Glossary & Diagnostic Features page.
 * Zero Node-only imports: runs natively in browsers and `node:test`.
 */

export const DEFAULT_GLOSSARY_URL = "../data/glossary.json";

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

/**
 * Filter glossary entries by case-insensitive substring match against
 * `term` and `definition`, and optional exact `group` match.
 *
 * @param {Array<Record<string, unknown>>} terms
 * @param {{ query?: string, group?: string }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function filterGlossaryTerms(terms, options = {}) {
  if (!Array.isArray(terms)) {
    return [];
  }

  const opts = options && typeof options === "object" ? options : {};
  const query = typeof opts.query === "string" ? opts.query.trim().toLowerCase() : "";
  const group = typeof opts.group === "string" ? opts.group : "";

  return terms.filter((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    if (group !== "" && entry.group !== group) {
      return false;
    }

    if (query !== "") {
      const termText = typeof entry.term === "string" ? entry.term.toLowerCase() : "";
      const defText =
        typeof entry.definition === "string" ? entry.definition.toLowerCase() : "";
      if (!termText.includes(query) && !defText.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Format optional chapter and page citation (`Ch. X, p. Y`) for a glossary card.
 *
 * @param {Record<string, unknown>} entry
 * @returns {string}
 */
function formatReferenceLabel(entry) {
  const hasChapter = typeof entry?.chapter === "number" && Number.isFinite(entry.chapter);
  const hasPage = typeof entry?.page === "number" && Number.isFinite(entry.page);

  if (hasChapter && hasPage) {
    return `Ch. ${entry.chapter}, p. ${entry.page}`;
  }
  if (hasChapter) {
    return `Ch. ${entry.chapter}`;
  }
  if (hasPage) {
    return `p. ${entry.page}`;
  }
  return "";
}

/**
 * Render HTML markup for a single glossary entry card.
 *
 * @param {Record<string, unknown>} entry
 * @returns {string}
 */
export function renderGlossaryCardHtml(entry) {
  const id = typeof entry?.id === "string" ? entry.id : "";
  const term = typeof entry?.term === "string" ? entry.term : "";
  const group = typeof entry?.group === "string" ? entry.group : "";
  const definition = typeof entry?.definition === "string" ? entry.definition : "";
  const sources = Array.isArray(entry?.sources)
    ? entry.sources.filter((src) => typeof src === "string" && src.length > 0)
    : [];

  const badges = [];
  if (group) {
    badges.push(`<span class="glossary-badge glossary-badge--group">${escapeHtml(group)}</span>`);
  }

  const refLabel = formatReferenceLabel(entry);
  if (refLabel) {
    badges.push(`<span class="glossary-badge glossary-badge--ref">${escapeHtml(refLabel)}</span>`);
  }

  for (const source of sources) {
    badges.push(
      `<span class="glossary-badge glossary-badge--source">${escapeHtml(source)}</span>`
    );
  }

  const metaHtml =
    badges.length > 0 ? `  <div class="glossary-card-meta">${badges.join(" ")}</div>` : "";

  return [
    `<article class="glossary-card" id="${escapeHtml(id)}">`,
    `  <h2>${escapeHtml(term)}</h2>`,
    metaHtml,
    `  <p>${escapeHtml(definition)}</p>`,
    `</article>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCountText(filteredCount, totalCount) {
  if (totalCount === 0) {
    return "0 terms";
  }
  if (filteredCount === totalCount) {
    return `Showing ${totalCount.toLocaleString("en-US")} terms`;
  }
  return `Showing ${filteredCount.toLocaleString("en-US")} of ${totalCount.toLocaleString("en-US")} terms`;
}

function populateGroupSelect(doc, selectEl, groups) {
  if (!doc || !selectEl) {
    return;
  }
  const previousValue = typeof selectEl.value === "string" ? selectEl.value : "";
  selectEl.innerHTML = "";

  const allOpt = doc.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All groups";
  selectEl.appendChild(allOpt);

  for (const group of groups) {
    const opt = doc.createElement("option");
    opt.value = group;
    opt.textContent = group;
    selectEl.appendChild(opt);
  }

  selectEl.value = groups.includes(previousValue) ? previousValue : "";
}

function scrollToLocationHash(doc, loc) {
  const rawHash = typeof loc?.hash === "string" ? loc.hash : "";
  if (!rawHash || rawHash.length <= 1) {
    return;
  }
  const rawId = rawHash.slice(1);
  let targetId = rawId;
  try {
    targetId = decodeURIComponent(rawId);
  } catch {
    targetId = rawId;
  }
  const target = doc.getElementById(targetId);
  if (target && typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Initialize the glossary search and filter UI.
 *
 * @param {object} [options]
 * @param {Document} [options.document]
 * @param {Document} [options.doc]
 * @param {typeof fetch} [options.fetch]
 * @param {string} [options.dataUrl="../data/glossary.json"]
 * @param {{ hash?: string }} [options.location]
 * @returns {Promise<object|null>}
 */
export async function initGlossaryApp(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const doc =
    opts.document ??
    opts.doc ??
    (typeof opts.getElementById === "function" ? opts : globalThis.document);

  if (!doc || typeof doc.getElementById !== "function") {
    return null;
  }

  const listEl = doc.getElementById("glossary-list");
  if (!listEl) {
    return null;
  }

  const searchInput = doc.getElementById("glossary-search");
  const groupSelect = doc.getElementById("glossary-group");
  const clearBtn = doc.getElementById("glossary-clear");
  const countEl = doc.getElementById("glossary-count");

  const fetchFn =
    typeof opts.fetch === "function"
      ? opts.fetch
      : typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis)
        : null;
  const dataUrl =
    typeof opts.dataUrl === "string" && opts.dataUrl.length > 0
      ? opts.dataUrl
      : DEFAULT_GLOSSARY_URL;
  const loc = opts.location ?? globalThis.location;

  const state = {
    totalTerms: 0,
    groups: [],
    terms: [],
    filtered: [],
  };

  function render() {
    const query = searchInput ? searchInput.value : "";
    const group = groupSelect ? groupSelect.value : "";

    state.filtered = filterGlossaryTerms(state.terms, { query, group });

    if (countEl) {
      countEl.textContent = formatCountText(state.filtered.length, state.terms.length);
    }

    if (state.filtered.length === 0) {
      listEl.innerHTML = `<p class="glossary-empty">No glossary terms match the current filter.</p>`;
    } else {
      listEl.innerHTML = state.filtered.map(renderGlossaryCardHtml).join("\n");
    }
  }

  function clearFilters() {
    if (searchInput) {
      searchInput.value = "";
    }
    if (groupSelect) {
      groupSelect.value = "";
    }
    render();
  }

  if (searchInput) {
    searchInput.addEventListener("input", render);
  }
  if (groupSelect) {
    groupSelect.addEventListener("change", render);
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", clearFilters);
  }

  if (fetchFn) {
    try {
      const response = await fetchFn(dataUrl);
      if (!response || !response.ok) {
        throw new Error(`HTTP ${response?.status ?? "error"}`);
      }
      const payload = await response.json();
      const terms = Array.isArray(payload?.terms) ? payload.terms : [];
      const groups = Array.isArray(payload?.groups)
        ? payload.groups
        : Array.from(
            new Set(terms.map((t) => t?.group).filter((g) => typeof g === "string" && g))
          ).sort();

      state.totalTerms = Number.isFinite(payload?.totalTerms)
        ? payload.totalTerms
        : terms.length;
      state.groups = groups;
      state.terms = terms;

      populateGroupSelect(doc, groupSelect, groups);
      render();
      scrollToLocationHash(doc, loc);
    } catch {
      if (countEl) {
        countEl.textContent = "Unable to load glossary.";
      }
    }
  }

  return {
    state,
    render,
    clearFilters,
  };
}

if (typeof document !== "undefined") {
  const autoInit = () => {
    if (document.getElementById("glossary-app")) {
      void initGlossaryApp({ document });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
}
