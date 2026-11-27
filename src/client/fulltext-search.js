/**
 * Pure ESM browser full-text OSD search client powered by Pagefind.
 * Zero Node-only imports: runs natively in browsers and `node:test`.
 */

export const DEFAULT_PAGEFIND_PATH = "./pagefind/pagefind.js";
export const DEFAULT_UNAVAILABLE_MESSAGE =
  "Full-text OSD search index is unavailable. Rebuild the site with --pagefind to enable it.";

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
 * Sanitize an excerpt string by escaping all HTML while preserving exact
 * Pagefind `<mark>` and `</mark>` highlight tags.
 *
 * @param {unknown} excerpt
 * @returns {string}
 */
function sanitizeExcerptHtml(excerpt) {
  if (typeof excerpt !== "string" || excerpt.length === 0) {
    return "";
  }
  return escapeHtml(excerpt)
    .replace(/&lt;mark&gt;/gi, "<mark>")
    .replace(/&lt;\/mark&gt;/gi, "</mark>");
}

/**
 * Sanitize a URL for safe `href` interpolation.
 *
 * @param {unknown} rawUrl
 * @returns {string}
 */
function sanitizeHref(rawUrl) {
  if (typeof rawUrl !== "string") {
    return "#";
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "#";
  }
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return "#";
  }
  return trimmed;
}

/**
 * Return the first non-empty trimmed string from candidate values.
 *
 * @param {...unknown} candidates
 * @returns {string}
 */
function firstNonEmpty(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return "";
}

/**
 * Dynamically import a generated Pagefind module and call `init()` if present.
 * Returns `null` if the index is unavailable or fails to initialize.
 *
 * @param {string} [basePath="./pagefind/pagefind.js"]
 * @returns {Promise<object|null>}
 */
export async function loadPagefind(basePath = DEFAULT_PAGEFIND_PATH) {
  if (typeof basePath !== "string" || basePath.trim().length === 0) {
    return null;
  }

  try {
    const mod = await import(basePath);
    const pf = mod?.default && typeof mod.default.search === "function" ? mod.default : mod;
    if (!pf || typeof pf.search !== "function") {
      return null;
    }
    if (typeof pf.init === "function") {
      await pf.init();
    }
    return pf;
  } catch {
    return null;
  }
}

/**
 * Run a Pagefind full-text query and resolve the top `limit` result records.
 *
 * @param {object|null|undefined} pagefind
 * @param {string} query
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<{ url: string, title: string, excerpt: string, meta: Record<string, string> }>>}
 */
export async function searchFullText(pagefind, query, options = {}) {
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed || !pagefind || typeof pagefind.search !== "function") {
    return [];
  }

  const opts = options && typeof options === "object" ? options : {};
  const rawLimit = opts.limit ?? 25;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 0;
  if (limit === 0) {
    return [];
  }

  const searchResponse = await pagefind.search(trimmed);
  const rawResults = Array.isArray(searchResponse?.results)
    ? searchResponse.results.slice(0, limit)
    : [];

  const resolved = await Promise.all(
    rawResults.map((entry) => (typeof entry?.data === "function" ? entry.data() : entry))
  );

  const normalized = [];
  for (const data of resolved) {
    if (!data || typeof data !== "object") {
      continue;
    }
    const url = typeof data.url === "string" ? data.url : "";
    const meta = data.meta && typeof data.meta === "object" ? { ...data.meta } : {};
    const title = firstNonEmpty(meta.title, meta.series, data.title, url) || "Untitled";
    const excerpt = typeof data.excerpt === "string" ? data.excerpt : "";
    normalized.push({ url, title, excerpt, meta });
  }

  return normalized;
}

/**
 * Render HTML markup for full-text search results.
 * Escapes all untrusted HTML while preserving `<mark>` and `</mark>` highlights
 * inside Pagefind excerpts.
 *
 * @param {Array<{ url?: string, title?: string, excerpt?: string, meta?: Record<string, unknown> }>} results
 * @param {string} [query=""]
 * @returns {string}
 */
export function renderFullTextResultsHtml(results, query = "") {
  const trimmedQuery = typeof query === "string" ? query.trim() : "";
  if (!Array.isArray(results) || results.length === 0) {
    if (!trimmedQuery) {
      return "";
    }
    return `<p class="fulltext-empty">No matching OSD pages found for &quot;${escapeHtml(trimmedQuery)}&quot;.</p>`;
  }

  const itemsHtml = results.map((result) => {
    const href = sanitizeHref(result?.url);
    const meta = result?.meta && typeof result.meta === "object" ? result.meta : {};
    const title = firstNonEmpty(result?.title, meta.title, meta.series, href) || "Untitled";
    const excerptHtml = sanitizeExcerptHtml(result?.excerpt);

    const badges = [];
    for (const key of ["series", "order", "state", "status"]) {
      const val = typeof meta[key] === "string" ? meta[key].trim() : "";
      if (val && !(key === "series" && val.toUpperCase() === title.toUpperCase())) {
        badges.push(`<span class="fulltext-result-badge">${escapeHtml(val)}</span>`);
      }
    }

    const metaHtml =
      badges.length > 0 ? `\n    <div class="fulltext-result-meta">${badges.join(" ")}</div>` : "";
    const excerptBlock = excerptHtml
      ? `\n    <p class="fulltext-result-excerpt">${excerptHtml}</p>`
      : "";

    return [
      `  <li class="fulltext-result-item">`,
      `    <a class="fulltext-result-link" href="${escapeHtml(href)}">${escapeHtml(title)}</a>${metaHtml}${excerptBlock}`,
      `  </li>`,
    ].join("\n");
  });

  return [`<ul class="fulltext-results-list">`, ...itemsHtml, `</ul>`].join("\n");
}

function queryChild(rootEl, selectors) {
  if (!rootEl || typeof rootEl.querySelector !== "function") {
    return null;
  }
  for (const selector of selectors) {
    const el = rootEl.querySelector(selector);
    if (el) {
      return el;
    }
  }
  return null;
}

/**
 * Initialize a full-text OSD search panel inside `rootEl`.
 * Wires input events with debouncing, unavailable-index messaging, and result rendering.
 *
 * @param {Element|null|undefined} rootEl
 * @param {{
 *   basePath?: string,
 *   pagefind?: object|null,
 *   loader?: () => Promise<object|null>,
 *   debounceMs?: number,
 *   limit?: number,
 *   unavailableMessage?: string,
 *   inputEl?: Element|null,
 *   statusEl?: Element|null,
 *   resultsEl?: Element|null,
 *   clearBtn?: Element|null,
 * }} [options]
 * @returns {Promise<object|null>}
 */
export async function initFullTextSearch(rootEl, options = {}) {
  if (!rootEl || typeof rootEl !== "object") {
    return null;
  }

  const opts = options && typeof options === "object" ? options : {};
  const basePath =
    typeof opts.basePath === "string" && opts.basePath.length > 0
      ? opts.basePath
      : DEFAULT_PAGEFIND_PATH;
  const debounceMs =
    Number.isFinite(opts.debounceMs) && opts.debounceMs >= 0 ? opts.debounceMs : 200;
  const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? Math.floor(opts.limit) : 25;
  const unavailableMessage =
    typeof opts.unavailableMessage === "string" && opts.unavailableMessage.length > 0
      ? opts.unavailableMessage
      : DEFAULT_UNAVAILABLE_MESSAGE;

  let inputEl =
    opts.inputEl ??
    queryChild(rootEl, [
      "[data-fulltext-input]",
      "#fulltext-search-input",
      "input[type='search']",
      "input[type='text']",
      "input",
    ]);
  let statusEl =
    opts.statusEl ??
    queryChild(rootEl, [
      "[data-fulltext-status]",
      "#fulltext-search-status",
      ".fulltext-status",
      "[role='status']",
    ]);
  let resultsEl =
    opts.resultsEl ??
    queryChild(rootEl, [
      "[data-fulltext-results]",
      "#fulltext-search-results",
      ".fulltext-results",
    ]);
  let clearBtn =
    opts.clearBtn ??
    queryChild(rootEl, [
      "[data-fulltext-clear]",
      "#fulltext-search-clear",
      "button[type='reset']",
    ]);

  // If mounted on an empty container with innerHTML + querySelector support, scaffold default UI.
  if (!inputEl && !resultsEl && typeof rootEl.querySelector === "function") {
    rootEl.innerHTML = [
      `<div class="fulltext-controls">`,
      `  <input type="search" data-fulltext-input placeholder="Search full OSD text (horizons, remarks, setting)..." autocomplete="off">`,
      `  <button type="button" data-fulltext-clear>Clear</button>`,
      `</div>`,
      `<div class="fulltext-status" data-fulltext-status role="status" aria-live="polite"></div>`,
      `<div class="fulltext-results" data-fulltext-results></div>`,
    ].join("\n");
    inputEl = rootEl.querySelector("[data-fulltext-input]");
    statusEl = rootEl.querySelector("[data-fulltext-status]");
    resultsEl = rootEl.querySelector("[data-fulltext-results]");
    clearBtn = rootEl.querySelector("[data-fulltext-clear]");
  }

  let pfInstance = opts.pagefind !== undefined ? opts.pagefind : undefined;
  let loadPromise = null;
  let debounceTimer = null;
  let searchEpoch = 0;

  async function ensurePagefind() {
    if (pfInstance !== undefined) {
      return pfInstance;
    }
    if (!loadPromise) {
      const loader =
        typeof opts.loader === "function" ? opts.loader : () => loadPagefind(basePath);
      loadPromise = Promise.resolve()
        .then(() => loader())
        .then((pf) => {
          pfInstance = pf || null;
          return pfInstance;
        })
        .catch(() => {
          pfInstance = null;
          return null;
        });
    }
    return loadPromise;
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function setResultsHtml(html) {
    if (resultsEl) {
      resultsEl.innerHTML = html;
    }
  }

  async function runSearch(rawQuery) {
    const epoch = ++searchEpoch;
    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

    const pf = await ensurePagefind();
    if (epoch !== searchEpoch) {
      return [];
    }

    if (!pf) {
      setStatus(unavailableMessage);
      setResultsHtml("");
      return [];
    }

    if (!query) {
      setStatus("Enter keywords to search full OSD descriptions.");
      setResultsHtml("");
      return [];
    }

    setStatus(`Searching for "${query}"...`);
    try {
      const results = await searchFullText(pf, query, { limit });
      if (epoch !== searchEpoch) {
        return [];
      }
      const noun = results.length === 1 ? "page" : "pages";
      setStatus(`Found ${results.length} matching OSD ${noun} for "${query}".`);
      setResultsHtml(renderFullTextResultsHtml(results, query));
      return results;
    } catch {
      if (epoch !== searchEpoch) {
        return [];
      }
      setStatus("Full-text search failed.");
      setResultsHtml("");
      return [];
    }
  }

  function clear() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    searchEpoch += 1;
    if (inputEl) {
      inputEl.value = "";
    }
    setResultsHtml("");
    if (pfInstance === null) {
      setStatus(unavailableMessage);
    } else {
      setStatus("Enter keywords to search full OSD descriptions.");
    }
  }

  const onInput = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    const query = inputEl ? inputEl.value : "";
    if (!query || !query.trim()) {
      void runSearch("");
      return;
    }
    if (debounceMs === 0) {
      void runSearch(query);
      return;
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runSearch(query);
    }, debounceMs);
  };

  const onClear = () => {
    clear();
  };

  if (inputEl && typeof inputEl.addEventListener === "function") {
    inputEl.addEventListener("input", onInput);
  }
  if (clearBtn && typeof clearBtn.addEventListener === "function") {
    clearBtn.addEventListener("click", onClear);
  }

  const pf = await ensurePagefind();
  if (!pf) {
    setStatus(unavailableMessage);
  } else if (inputEl && typeof inputEl.value === "string" && inputEl.value.trim()) {
    await runSearch(inputEl.value);
  } else {
    setStatus("Full-text OSD search ready.");
  }

  return {
    runSearch,
    clear,
    getPagefind: () => pfInstance ?? null,
    destroy() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (inputEl && typeof inputEl.removeEventListener === "function") {
        inputEl.removeEventListener("input", onInput);
      }
      if (clearBtn && typeof clearBtn.removeEventListener === "function") {
        clearBtn.removeEventListener("click", onClear);
      }
    },
  };
}
