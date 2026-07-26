import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, relative } from "node:path";
import db, { ROOT } from "./db.js";

// Reads the repository and records what is in it. Concludes nothing.
//
// The unit recorded here is a numeric literal on the right of a comparison — a
// threshold, as written, with the expression it is compared against. That is a
// narrow thing to observe on purpose: the first detector above this asks whether
// the same threshold is defined in more than one file, and a scan that recorded
// every token would make that question slower to ask without making it better.
//
// Text, not syntax. There is no JavaScript parser in this project's dependency
// tree, and adding one to answer a single question would be the wrong trade this
// early. So comments and string literals are stripped first — they are where the
// false positives live — and the remainder is matched. This is honest about being
// a lexical approximation, and the limit is real: a threshold built by arithmetic
// (`>= BASE + 20`) or held in a variable is invisible here. Findings say so.
//
// A parser is the upgrade path, and the reason to take it will be a false
// positive this cannot avoid rather than a preference for parsers.

export const SCANNER_VERSION = "scan-1";

// Values that carry no design decision. 0 and 1 are structural, 100 is almost
// always a percentage ceiling, and -1 is a sentinel. A threshold repeated across
// files is only interesting when someone chose the number.
const UNINTERESTING = new Set(["0", "1", "-1", "100"]);

const COMPARISON = /([A-Za-z_$][\w$.[\]'"]*)\s*(>=|<=|===|!==|==|!=|>|<)\s*(\d+(?:\.\d+)?)\b/g;

/**
 * Removes comments and string literals, preserving line structure.
 *
 * Line count must survive exactly, because a finding that cites the wrong line
 * costs more than one that cites no line: the reader looks, sees something else,
 * and stops trusting the rest of the report.
 */
export function stripCommentsAndStrings(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  let state = "code";
  let quote = "";

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line-comment";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "block-comment";
        i += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        state = "string";
        quote = c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }

    if (state === "line-comment") {
      if (c === "\n") {
        state = "code";
        out += "\n";
      }
      i += 1;
      continue;
    }

    if (state === "block-comment") {
      if (c === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      if (c === "\n") out += "\n";
      i += 1;
      continue;
    }

    // string
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) {
      state = "code";
      i += 1;
      continue;
    }
    if (c === "\n") out += "\n";
    i += 1;
  }

  return out;
}

/** Files git tracks, filtered to the source this scanner understands. */
function trackedSourceFiles() {
  const listed = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);

  return listed.filter((p) => {
    if (!/\.(js|mjs|cjs)$/.test(p)) return false;
    // Generated, vendored, or deliberately dead: a duplicate in a .backup file is
    // not a duplicate in the program, and reporting it would be a false positive
    // dressed up as thoroughness.
    if (/node_modules\//.test(p)) return false;
    // `.backup` anywhere in the name, not only at the end: the first version of
    // this filter tested for a trailing `.backup` and let `server.v0.2.backup.js`
    // through, which produced a duplicate-threshold finding whose two sites were
    // the live server and a snapshot of the same file from an earlier version.
    // True as text, false as a claim about the program.
    if (/\.(backup|bak|orig|old)(\.|$)/.test(p)) return false;
    if (/(^|\/)(dist|build|vendor)\//.test(p)) return false;
    return true;
  });
}

function head() {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const at = execFileSync("git", ["log", "-1", "--format=%aI", sha], {
    cwd: ROOT,
    encoding: "utf8"
  }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  return { sha, at, dirty: status.trim().length > 0 ? 1 : 0 };
}

const insertScan = db.prepare(`
  INSERT INTO RepoScan (
    id, commitSha, commitAt, dirty, scannedAt, scannedAtMs, fileCount, scannerVersion
  ) VALUES (@id, @commitSha, @commitAt, @dirty, @scannedAt, @scannedAtMs, @fileCount, @scannerVersion)
`);

const insertRow = db.prepare(`
  INSERT INTO RepoReality (id, scanId, kind, filePath, line, subject, operator, value, sourceLine)
  VALUES (@id, @scanId, @kind, @filePath, @line, @subject, @operator, @value, @sourceLine)
`);

/**
 * Records one scan of the working tree and returns its id.
 *
 * Rows are never updated. A second scan is a second set of rows against a new
 * scan id, so what the repository looked like at each point stays readable — the
 * whole reason a detector above this can say when something started.
 */
export function scanRepository({ verbose = false } = {}) {
  const { sha, at, dirty } = head();
  const files = trackedSourceFiles();
  const scanId = randomUUID();
  const now = new Date();

  const rows = [];

  for (const relPath of files) {
    const abs = join(ROOT, relPath);
    let source;
    try {
      if (statSync(abs).size > 2_000_000) continue;
      source = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    const cleaned = stripCommentsAndStrings(source);
    const originalLines = source.split("\n");
    const lines = cleaned.split("\n");

    for (let n = 0; n < lines.length; n += 1) {
      COMPARISON.lastIndex = 0;
      let match;
      while ((match = COMPARISON.exec(lines[n])) !== null) {
        const [, subject, operator, value] = match;
        if (UNINTERESTING.has(value)) continue;
        rows.push({
          id: randomUUID(),
          scanId,
          kind: "threshold_comparison",
          filePath: relPath,
          line: n + 1,
          subject,
          operator,
          value,
          sourceLine: (originalLines[n] ?? "").trim().slice(0, 300)
        });
      }
    }
  }

  const write = db.transaction(() => {
    insertScan.run({
      id: scanId,
      commitSha: sha,
      commitAt: at,
      dirty,
      scannedAt: now.toISOString(),
      scannedAtMs: now.getTime(),
      fileCount: files.length,
      scannerVersion: SCANNER_VERSION
    });
    for (const row of rows) insertRow.run(row);
  });
  write();

  if (verbose) {
    console.log(
      `[scan] ${sha.slice(0, 8)}${dirty ? " (dirty)" : ""} · ${files.length} file(s) · ${rows.length} threshold(s)`
    );
  }

  return { scanId, commitSha: sha, dirty, fileCount: files.length, thresholdCount: rows.length };
}

export function latestScan() {
  return db
    .prepare("SELECT * FROM RepoScan ORDER BY scannedAtMs DESC LIMIT 1")
    .get();
}
