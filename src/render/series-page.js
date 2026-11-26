/**
 * HTML renderer for Official Soil Series Description (OSD) v1 pages.
 * Reproduces legacy NRCS OSD page anatomy with usdastyle.css classes
 * and an optional build-time profile sketch SVG slot.
 */

export const NSSH_SECTIONS = [
  "TAXONOMIC CLASS",
  "TYPICAL PEDON",
  "TYPE LOCATION",
  "RANGE IN CHARACTERISTICS",
  "COMPETING SERIES",
  "GEOGRAPHIC SETTING",
  "GEOGRAPHICALLY ASSOCIATED SOILS",
  "DRAINAGE AND PERMEABILITY",
  "USE AND VEGETATION",
  "DISTRIBUTION AND EXTENT",
  "REGIONAL OFFICE",
  "ORIGIN",
  "REMARKS",
  "ADDITIONAL DATA",
];

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape special HTML characters in untrusted text/attribute values.
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
 * Encode a local filename for safe use in a relative href attribute.
 * Preserves `@`, `.`, `_`, and `'` while escaping characters like `#` and `?`.
 *
 * @param {string} filename
 * @returns {string}
 */
function encodeHrefFilename(filename) {
  return encodeURI(filename).replaceAll("#", "%23").replaceAll("?", "%3F");
}

/**
 * Format the legacy `LOCATION <NAME> <STATES>` header line with state codes
 * aligned near column 33 (1-based) per NSSH guidelines.
 *
 * @param {string} name
 * @param {string} states
 * @returns {string}
 */
export function formatLocationLine(name, states) {
  const seriesUpper = String(name ?? "").trim().toUpperCase();
  const prefix = `LOCATION ${seriesUpper}`;
  const cleanStates = String(states ?? "").trim();
  if (!cleanStates) {
    return prefix;
  }
  const padWidth = Math.max(1, 32 - prefix.length);
  return `${prefix}${" ".repeat(padWidth)}${cleanStates}`;
}

/**
 * Convert plain multiline text into HTML-escaped lines joined by `<br>`.
 *
 * @param {string} text
 * @returns {string}
 */
function formatMultilineHtml(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join("<br>\n");
}

/**
 * Convert a section key into a lowercase kebab-case HTML id slug.
 *
 * @param {string} sectionKey
 * @returns {string}
 */
function toSectionId(sectionKey) {
  return sectionKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Extract the introductory text of TYPICAL PEDON preceding the horizon list.
 *
 * @param {string|null} content
 * @param {Array<Record<string, unknown>>} horizons
 * @returns {string}
 */
function extractPedonIntro(content, horizons) {
  if (typeof content !== "string" || content.trim().length === 0) {
    return "";
  }
  const lines = content.split(/\r?\n/);
  if (!Array.isArray(horizons) || horizons.length === 0) {
    return content;
  }
  const firstHorizonName =
    typeof horizons[0]?.name === "string" ? horizons[0].name.trim() : "";
  if (firstHorizonName) {
    const idx = lines.findIndex((line) => {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith(firstHorizonName)) {
        return false;
      }
      const after = trimmed.slice(firstHorizonName.length);
      return /^\s*--/.test(after);
    });
    if (idx !== -1) {
      return lines.slice(0, idx).join("\n").trim();
    }
  }
  return lines[0].trim();
}

/**
 * Render one horizon entry with a bold, indented `.osd-horizon-name` span.
 *
 * @param {Record<string, unknown>} horizon
 * @returns {string}
 */
function renderHorizonHtml(horizon) {
  const name = typeof horizon?.name === "string" ? horizon.name : "";
  const narrative = typeof horizon?.narrative === "string" ? horizon.narrative : "";

  if (name && narrative.startsWith(name)) {
    const rest = narrative.slice(name.length);
    return `<div class="osd-horizon"><span class="osd-horizon-name">    ${escapeHtml(name)}</span>${escapeHtml(rest)}</div>`;
  }
  if (name) {
    const suffix = narrative ? ` ${escapeHtml(narrative)}` : "";
    return `<div class="osd-horizon"><span class="osd-horizon-name">    ${escapeHtml(name)}</span>${suffix}</div>`;
  }
  return `<div class="osd-horizon">${escapeHtml(narrative)}</div>`;
}

/**
 * Render the TYPICAL PEDON section with optional side-by-side profile sketch.
 *
 * @param {string} label
 * @param {string|null} content
 * @param {Array<Record<string, unknown>>} horizons
 * @param {string|null|undefined} sketchSvg
 * @returns {string}
 */
function renderTypicalPedonSection(label, content, horizons, sketchSvg) {
  const hasContent = typeof content === "string" && content.trim().length > 0;
  const hasHorizons = Array.isArray(horizons) && horizons.length > 0;
  const hasSketch = typeof sketchSvg === "string" && sketchSvg.trim().length > 0;

  if (!hasContent && !hasHorizons && !hasSketch) {
    return "";
  }

  const intro = extractPedonIntro(content, horizons);
  const introHtml = intro ? ` ${formatMultilineHtml(intro)}` : "";
  const horizonsHtml = hasHorizons
    ? `\n      ${horizons.map(renderHorizonHtml).join("\n      ")}`
    : "";

  const sketchHtml = hasSketch
    ? `\n    <div class="osd-pedon-sketch">${sketchSvg}</div>`
    : "";

  return [
    `  <section class="osd-section osd-pedon-layout" id="typical-pedon">`,
    `    <div class="osd-pedon-text">`,
    `      <strong class="osd-section-label">${escapeHtml(label)}:</strong>${introHtml}${horizonsHtml}`,
    `    </div>${sketchHtml}`,
    `  </section>`,
  ].join("\n");
}

/**
 * Render a standard NSSH narrative section.
 *
 * @param {string} sectionKey
 * @param {string} label
 * @param {string} content
 * @returns {string}
 */
function renderStandardSection(sectionKey, label, content) {
  const id = toSectionId(sectionKey);
  const body = formatMultilineHtml(content);
  const separator = content.includes("\n") ? "<br>\n    " : " ";
  return `  <section class="osd-section" id="${escapeHtml(id)}">\n    <strong class="osd-section-label">${escapeHtml(label)}:</strong>${separator}${body}\n  </section>`;
}

/**
 * Render a complete v1 HTML page for a joined soil series record.
 *
 * @param {object} record Joined corpus record from `loadCorpus()`
 * @param {object} [options]
 * @param {string} [options.cssHref="../../usdastyle.css"] Stylesheet href
 * @param {string|null} [options.sketchSvg=null] Optional pre-rendered SVG markup
 * @param {boolean} [options.hasTxt=false] Whether `<KEY>.txt` download exists
 * @param {boolean} [options.hasJson] Whether `<KEY>.json` download exists (defaults to `record.hasSkb`)
 * @returns {string} Complete HTML document
 */
export function renderSeriesPage(record, options = {}) {
  if (!record || typeof record !== "object") {
    throw new TypeError("Series record must be an object");
  }

  const {
    cssHref = "../../usdastyle.css",
    sketchSvg = null,
    hasTxt = false,
    hasJson = Boolean(record.hasSkb || record.skbPath),
  } = options;

  const skb = record.skb && typeof record.skb === "object" ? record.skb : null;
  const sc = record.sc && typeof record.sc === "object" ? record.sc : null;
  const horizons = Array.isArray(record.horizons)
    ? record.horizons
    : Array.isArray(skb?.HORIZONS)
      ? skb.HORIZONS
      : [];

  const displayName = String(skb?.SERIES ?? record.name ?? record.key ?? "")
    .trim()
    .toUpperCase();
  const key = String(record.key ?? displayName);
  const states = skb?.STATES ?? sc?.areasymbol ?? "";
  const statusText =
    skb?.STATUS ??
    (record.status && record.status !== "Unclassified"
      ? `${record.status} Series`
      : record.status ?? "");
  const byrev = skb?.BYREV ?? null;
  const revdate = skb?.REVDATE ?? null;
  const overview = skb?.OVERVIEW ?? null;

  const locationLine = formatLocationLine(displayName, states);

  const downloadLinks = [];
  if (hasTxt) {
    const txtFile = `${key}.txt`;
    downloadLinks.push(
      `<a href="${escapeHtml(encodeHrefFilename(txtFile))}" download="${escapeHtml(txtFile)}">Raw OSD (.txt)</a>`
    );
  }
  if (hasJson) {
    const jsonFile = `${key}.json`;
    downloadLinks.push(
      `<a href="${escapeHtml(encodeHrefFilename(jsonFile))}" download="${escapeHtml(jsonFile)}">Parsed JSON (.json)</a>`
    );
  }
  const downloadsHtml =
    downloadLinks.length > 0
      ? `\n      <div class="osd-downloads">${downloadLinks.join(" ")}</div>`
      : "";

  const metaLines = [
    `      <div class="osd-location">${escapeHtml(locationLine)}</div>`,
  ];
  if (statusText) {
    metaLines.push(`      <div>${escapeHtml(statusText)}</div>`);
  }
  if (byrev) {
    metaLines.push(`      <div>${escapeHtml(byrev)}</div>`);
  }
  if (revdate) {
    metaLines.push(`      <div>${escapeHtml(revdate)}</div>`);
  }

  const sectionHtmlBlocks = [];
  if (skb) {
    for (const sectionKey of NSSH_SECTIONS) {
      const secObj = skb[sectionKey];
      const label =
        secObj && typeof secObj === "object" && typeof secObj.section === "string" && secObj.section
          ? secObj.section
          : sectionKey;
      const content =
        secObj && typeof secObj === "object" && typeof secObj.content === "string"
          ? secObj.content
          : null;

      if (sectionKey === "TYPICAL PEDON") {
        const block = renderTypicalPedonSection(label, content, horizons, sketchSvg);
        if (block) {
          sectionHtmlBlocks.push(block);
        }
      } else if (content && content.trim().length > 0) {
        sectionHtmlBlocks.push(renderStandardSection(sectionKey, label, content));
      }
    }
  } else {
    if (sc?.taxclname) {
      sectionHtmlBlocks.push(
        renderStandardSection("TAXONOMIC CLASS", "TAXONOMIC CLASS", sc.taxclname)
      );
    }
    if (typeof sketchSvg === "string" && sketchSvg.trim().length > 0) {
      sectionHtmlBlocks.push(
        renderTypicalPedonSection("TYPICAL PEDON", null, [], sketchSvg)
      );
    }
    sectionHtmlBlocks.push(
      `  <p class="osd-section">Official Series Description narrative is not available in SoilKnowledgeBase for this series.</p>`
    );
  }

  const overviewHtml = overview
    ? `\n    <p>${formatMultilineHtml(overview)}</p>`
    : "";

  const sectionsHtml =
    sectionHtmlBlocks.length > 0 ? `\n${sectionHtmlBlocks.join("\n")}` : "";

  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head>`,
    `  <meta charset="utf-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1">`,
    `  <title>Official Series Description - ${escapeHtml(displayName)} Series</title>`,
    `  <link rel="stylesheet" href="${escapeHtml(cssHref)}">`,
    `</head>`,
    `<body class="cUSDABackground">`,
    `  <main class="osd-page cLightBody">`,
    `    <nav class="osd-chrome no-print" aria-label="Series links and downloads">`,
    `      <span>Official Soil Series Description &mdash; ${escapeHtml(displayName)}</span>${downloadsHtml}`,
    `    </nav>`,
    `    <header class="osd-header">`,
    `      <div class="osd-meta">`,
    metaLines.join("\n"),
    `      </div>`,
    `    </header>`,
    `    <article class="osd-narrative">`,
    `      <h1 class="osd-title">${escapeHtml(displayName)} SERIES</h1>${overviewHtml}${sectionsHtml}`,
    `    </article>`,
    `    <footer class="osd-footer footertable">`,
    `      <div>National Cooperative Soil Survey</div>`,
    `      <div>U.S.A.</div>`,
    `    </footer>`,
    `  </main>`,
    `</body>`,
    `</html>`,
    ``,
  ].join("\n");
}
