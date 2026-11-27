/**
 * Build-time series cross-linker for Official Soil Series Description (OSD) narratives.
 * Matches known series names in plain text and emits relative HTML links to sibling series pages.
 */

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const REGEX_META_RE = /[.*+?^${}()|[\]\\]/g;
const STARTS_WITH_UPPER_RE = /^\p{Lu}/u;

/**
 * Escape special HTML characters in text and attribute values.
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
 * Encode a local filename for safe use in a relative href attribute.
 * Preserves `@`, `.`, `_`, and `'` while escaping `#` and `?`.
 *
 * @param {string} filename
 * @returns {string}
 */
function encodeHrefFilename(filename) {
  return encodeURI(filename).replaceAll("#", "%23").replaceAll("?", "%3F");
}

/**
 * Escape special regular expression characters in a literal string.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(REGEX_META_RE, "\\$&");
}

/**
 * Build a precompiled cross-link index from corpus records.
 *
 * @param {Array<{ key: string, name?: string, letter?: string }>} records
 * @returns {{ byUpperName: Map<string, { key: string, letter: string, name: string, href: string }>, matcher: RegExp | null }}
 */
export function buildSeriesLinkIndex(records) {
  const byUpperName = new Map();

  if (!Array.isArray(records) || records.length === 0) {
    return { byUpperName, matcher: null };
  }

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const key = typeof record.key === "string" ? record.key.trim() : "";
    if (!key) {
      continue;
    }

    const letter =
      typeof record.letter === "string" && record.letter.trim()
        ? record.letter.trim()
        : key[0];
    if (!letter) {
      continue;
    }

    const rawName =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : key;
    const upperName = rawName.toUpperCase();
    const href = `../${letter}/${encodeHrefFilename(`${key}.html`)}`;
    const entry = { key, letter, name: rawName, href };

    if (upperName && !byUpperName.has(upperName)) {
      byUpperName.set(upperName, entry);
    }

    const keyDisplayName = key.replaceAll("_", " ").trim().toUpperCase();
    if (keyDisplayName && keyDisplayName !== upperName && !byUpperName.has(keyDisplayName)) {
      byUpperName.set(keyDisplayName, entry);
    }
  }

  if (byUpperName.size === 0) {
    return { byUpperName, matcher: null };
  }

  const sortedNames = Array.from(byUpperName.keys()).sort(
    (a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0)
  );
  const pattern = sortedNames.map(escapeRegExp).join("|");
  const matcher = new RegExp(`(?<!\\w)(?:${pattern})(?!\\w)`, "gi");

  return { byUpperName, matcher };
}

/**
 * Link recognized soil series names in plain multiline text and return HTML.
 *
 * @param {string | null | undefined} plainText
 * @param {{ byUpperName?: Map<string, { key: string, letter: string, name: string, href: string }>, matcher?: RegExp | null } | null | undefined} linkIndex
 * @param {string | null} [selfKey=null]
 * @returns {string}
 */
export function linkSeriesNames(plainText, linkIndex, selfKey = null) {
  if (plainText === null || plainText === undefined || plainText === "") {
    return "";
  }

  const text = String(plainText);
  if (text.length === 0) {
    return "";
  }

  const lines = text.split(/\r?\n/);
  const matcher = linkIndex?.matcher ?? null;
  const byUpperName = linkIndex?.byUpperName ?? null;

  if (!matcher || !byUpperName || byUpperName.size === 0) {
    return lines.map((line) => escapeHtml(line)).join("<br>\n");
  }

  return lines
    .map((line) => {
      matcher.lastIndex = 0;
      let out = "";
      let lastIndex = 0;
      let match;

      while ((match = matcher.exec(line)) !== null) {
        const matchedText = match[0];
        if (matchedText.length === 0) {
          matcher.lastIndex += 1;
          continue;
        }

        if (match.index > lastIndex) {
          out += escapeHtml(line.slice(lastIndex, match.index));
        }

        const entry = byUpperName.get(matchedText.toUpperCase());
        const startsUpper = STARTS_WITH_UPPER_RE.test(matchedText);

        if (entry && startsUpper && entry.key !== selfKey) {
          out += `<a class="osd-series-link" href="${escapeHtml(entry.href)}">${escapeHtml(matchedText)}</a>`;
        } else {
          out += escapeHtml(matchedText);
        }

        lastIndex = match.index + matchedText.length;
      }

      if (lastIndex < line.length) {
        out += escapeHtml(line.slice(lastIndex));
      }

      return out;
    })
    .join("<br>\n");
}
