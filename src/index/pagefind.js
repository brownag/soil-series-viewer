/**
 * Build-time Pagefind metadata markup helper and CLI index runner.
 */

import { execFile } from "node:child_process";

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
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
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
 * Build hidden Pagefind metadata and filter spans for a soil series record.
 * Emits `data-pagefind-meta="series"` and `data-pagefind-filter` spans for
 * `order`, `state`, and `status`, skipping empty or missing values.
 *
 * @param {Record<string, any>|null|undefined} record
 * @returns {string}
 */
export function buildPagefindMetaHtml(record) {
  if (!record || typeof record !== "object") {
    return "";
  }

  const sc = record.sc && typeof record.sc === "object" ? record.sc : null;
  const skb = record.skb && typeof record.skb === "object" ? record.skb : null;

  const series = firstNonEmpty(record.name, sc?.soilseriesname, skb?.SERIES, record.key);
  const order = firstNonEmpty(sc?.taxorder, record.order);
  const state = firstNonEmpty(sc?.areasymbol, record.state);
  const status = firstNonEmpty(record.status, sc?.soilseriesstatus);

  const spans = [];
  if (series) {
    spans.push(`  <span data-pagefind-meta="series">${escapeHtml(series)}</span>`);
  }
  if (order) {
    spans.push(`  <span data-pagefind-filter="order">${escapeHtml(order)}</span>`);
  }
  if (state) {
    spans.push(`  <span data-pagefind-filter="state">${escapeHtml(state)}</span>`);
  }
  if (status) {
    spans.push(`  <span data-pagefind-filter="status">${escapeHtml(status)}</span>`);
  }

  if (spans.length === 0) {
    return "";
  }

  return [
    `<div class="osd-pagefind-meta" hidden aria-hidden="true">`,
    ...spans,
    `</div>`,
  ].join("\n");
}

/**
 * Determine whether an error or stderr output indicates a missing Pagefind binary.
 *
 * @param {unknown} err
 * @param {string} [stderrText=""]
 * @returns {boolean}
 */
function isMissingBinaryError(err, stderrText = "") {
  if (err && typeof err === "object" && err.code === "ENOENT") {
    return true;
  }
  const message = [
    err && typeof err === "object" && typeof err.message === "string" ? err.message : "",
    typeof stderrText === "string" ? stderrText : "",
  ]
    .filter(Boolean)
    .join("\n");

  return /canceled due to missing packages|could not determine executable|command not found|not found|missing packages|cannot find module|enoent/i.test(
    message
  );
}

/**
 * Execute `npx --no-install pagefind --site <outDir>` via `node:child_process`.
 *
 * @param {string} outDir
 * @returns {Promise<{ ok: boolean, skipped: boolean, outDir: string, stdout?: string, stderr?: string, reason?: string }>}
 */
function execDefaultPagefind(outDir) {
  return new Promise((resolve) => {
    execFile(
      "npx",
      ["--no-install", "pagefind", "--site", outDir],
      { encoding: "utf8" },
      (error, stdout = "", stderr = "") => {
        const cleanStdout = String(stdout ?? "").trim();
        const cleanStderr = String(stderr ?? "").trim();

        if (!error) {
          resolve({
            ok: true,
            skipped: false,
            outDir,
            stdout: cleanStdout,
            stderr: cleanStderr,
          });
          return;
        }

        const reason = cleanStderr || error.message || "Pagefind execution failed";
        resolve({
          ok: false,
          skipped: isMissingBinaryError(error, cleanStderr),
          reason,
        });
      }
    );
  });
}

/**
 * Run Pagefind indexing over a built static site directory.
 * Uses `runner(outDir)` when provided (e.g., in tests), otherwise invokes
 * `npx --no-install pagefind --site <outDir>`. Never throws if Pagefind is unavailable.
 *
 * @param {{ outDir: string, runner?: (outDir: string) => unknown }} [options]
 * @returns {Promise<{ ok: boolean, skipped: boolean, reason?: string, outDir?: string }>}
 */
export async function runPagefind(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const { outDir, runner } = opts;

  if (typeof outDir !== "string" || outDir.trim().length === 0) {
    throw new TypeError("outDir must be a non-empty string");
  }

  if (typeof runner === "function") {
    try {
      const result = await runner(outDir);
      if (result && typeof result === "object") {
        if ("ok" in result) {
          return {
            ...result,
            ok: Boolean(result.ok),
            skipped: Boolean(result.skipped),
          };
        }
        const exitCode =
          typeof result.code === "number"
            ? result.code
            : typeof result.exitCode === "number"
              ? result.exitCode
              : 0;
        if (exitCode !== 0) {
          const reason =
            firstNonEmpty(result.reason, result.stderr, result.message) ||
            `Pagefind exited with code ${exitCode}`;
          return {
            ok: false,
            skipped: isMissingBinaryError(null, reason),
            reason,
          };
        }
        return {
          ok: true,
          skipped: false,
          outDir,
          ...result,
        };
      }
      return { ok: true, skipped: false, outDir };
    } catch (err) {
      const stderr = err && typeof err === "object" && typeof err.stderr === "string" ? err.stderr : "";
      const reason = firstNonEmpty(stderr, err?.message) || String(err);
      return {
        ok: false,
        skipped: isMissingBinaryError(err, stderr),
        reason,
      };
    }
  }

  return execDefaultPagefind(outDir);
}
