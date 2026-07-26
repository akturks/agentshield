import { execFileSync } from "node:child_process";
import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
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

export const SCANNER_VERSION = "scan-7";

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

/**
 * Whether a match sits inside the header of a `for` loop.
 *
 * Walks back to the nearest `for` on the line and forward to the paren that closes
 * it, so `for (let i = 0; i < 20; i++) if (x > 5)` skips the first comparison and
 * keeps the second. A line-local test, which is enough: a for-header split across
 * lines is rare, and treating a whole line as loop context because it mentions
 * `for` anywhere would hide real thresholds.
 */
function inLoopHeader(line, index) {
  const before = line.slice(0, index);
  const forAt = before.search(/\bfor\s*\($/) >= 0 ? before.search(/\bfor\s*\($/) : before.lastIndexOf("for");
  if (forAt === -1 || !/\bfor\s*\(/.test(before.slice(forAt))) return false;

  let depth = 0;
  for (let i = before.indexOf("(", forAt); i > -1 && i < line.length; i += 1) {
    if (line[i] === "(") depth += 1;
    else if (line[i] === ")") {
      depth -= 1;
      if (depth === 0) return index < i;
    }
  }
  // Unclosed on this line: the match is still inside the header.
  return true;
}

/**
 * Whether a path is part of the program this tool reasons about.
 *
 * Exported because the verifier needs the same answer, and this is the third time the
 * two paths have disagreed over a *definition* rather than over a fact. First it was
 * what counts as code — a threshold quoted in a doc comment. Then which file extensions
 * exist. Now which files are part of the program: git grep found imports of
 * `Evidence.js` in `test-evidence.js`, which the scan excludes, so the scan said four
 * modules were unimported and git said two. Both were right about what they were asked.
 *
 * Independence belongs in the search, never in the vocabulary. One definition, two
 * mechanisms.
 */
export function isProgramFile(p) {
  return (
    /\.(js|mjs|cjs)$/.test(p) &&
    !/node_modules\//.test(p) &&
    !/\.(backup|bak|orig|old)(\.|$)/.test(p) &&
    !/(^|\/)(dist|build|vendor)\//.test(p) &&
    !/(^|\/)(test|tests|__tests__|spec|e2e|benchmark|benchmarks)\//.test(p) &&
    !/\.(test|spec|smoke)\./.test(p) &&
    !/(^|\/)(test|prisma|seed)-[^/]*\.(js|mjs|cjs)$/.test(p) &&
    // Illustrative rather than part of the program. fastify ships 8 files in
    // `examples/` and winston 25, and every one is standalone by design — an example
    // nothing imports is an example working as intended. Reporting them as dead code
    // is the same error as reporting a test's fixture size as a threshold.
    !/(^|\/)(examples?|demos?|samples?|fixtures?)\//.test(p)
  );
}

/**
 * Files git tracks that are part of the program, via the one definition of that.
 *
 * This function used to hold its own copy of the rules while `isProgramFile` held
 * another, which is the fifth time this tool has grown two definitions of one word —
 * and the first time it happened inside a change made to stop it happening. Adding
 * `examples/` to `isProgramFile` therefore had no effect on the scan, and fastify's
 * eight example files kept coming back as dead code.
 *
 * There is nothing subtle about the failure. It is what a duplicated rule always does,
 * which is why this tool exists.
 */
function trackedSourceFiles() {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter(isProgramFile);
}

/**
 * Files that are meant to be run rather than imported.
 *
 * The unimported-module detector is worthless without this. Its first measurement on
 * agentshield named 50 files, and a third of them were command-line tools, config
 * files and one-off scripts: nothing imports a CLI, and saying so is true and useless.
 *
 * Three signals, all of them declarations rather than guesses. A shebang is a file
 * saying "run me". An appearance in package.json scripts is the project saying it.
 * A `*.config.js` name is the ecosystem's convention, read by tools that require the
 * file themselves. Anything relying on a hunch about the filename stays out.
 */
function entryPoints(files) {
  const entries = new Set();

  for (const rel of files) {
    if (/(^|\/)bin\//.test(rel)) entries.add(rel);
    if (/\.config\.(js|mjs|cjs)$/.test(rel)) entries.add(rel);
    try {
      const fd = openSync(join(ROOT, rel), "r");
      const head = Buffer.alloc(2);
      readSync(fd, head, 0, 2, 0);
      closeSync(fd);
      if (head.toString("utf8") === "#!") entries.add(rel);
    } catch {
      // Unreadable is not an entry point; the scan skips it later anyway.
    }
  }

  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const scripts = Object.values(pkg.scripts ?? {}).join(" ");
    const main = [pkg.main, pkg.module, pkg.bin]
      .flatMap((v) => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v) : []))
      .filter(Boolean);
    for (const rel of files) {
      if (scripts.includes(rel)) entries.add(rel);
      if (main.some((m) => m.replace(/^\.\//, "") === rel)) entries.add(rel);
    }
  } catch {
    // No package.json, or unreadable: the other two signals still apply.
  }

  return entries;
}

/**
 * Every module specifier imported or required by a file, with where it points.
 *
 * Recorded as observation, not as a conclusion. A row says "this file, at this line,
 * names this specifier, which resolves to this path" — whether anything is wrong with
 * that is a question for the layer above, and one that has to stay answerable by
 * re-reading these rows.
 *
 * Only relative specifiers are resolved. A bare `fastify` is a package and not a file
 * in this repository, so it is recorded with no resolution rather than guessed at.
 */
// A quoted specifier reached from an import keyword, with anything in between.
//
// The first version required the quote to follow `require(` immediately, and went blind
// on the pattern project-anchor uses everywhere:
// `require(path.join(rootDir, 'src/extraction/extract-generic.js'))`. Five modules came
// back as imported by nothing when `bin/ingest.js` loads all five, and the verifier
// refused the finding. Plugin loaders and CLI dispatchers compute paths like this
// routinely, so it is the normal case rather than an oddity.
//
// Nothing between the keyword and the quote may itself be a quote, which keeps the match
// on one specifier instead of running across two.
const IMPORT = /\b(?:from|import|require)\b[^"'\n]*["']([^"']+)["']/g;

function resolveSpecifier(fromRel, specifier, fileSet) {
  // A specifier that starts with a dot is relative to the importing file. One that looks
  // like a repository path — `src/extraction/extract-generic.js` — is what a computed
  // require leaves behind once `path.join(rootDir, ...)` is stripped away, and resolving
  // it from the root is the only way to see those edges. A bare `fastify` is a package
  // and matches neither, so it resolves to nothing rather than being guessed at.
  const looksRootRelative = /^[a-zA-Z0-9_@][\w@./-]*\/[^/]/.test(specifier);
  if (!specifier.startsWith(".") && !looksRootRelative) return null;

  const base = specifier.startsWith(".") ? join(dirname(fromRel), specifier) : specifier;
  const normalised = base.split("/").filter((seg) => seg !== ".").join("/");

  const candidates = [
    normalised,
    `${normalised}.js`,
    `${normalised}.mjs`,
    `${normalised}.cjs`,
    `${normalised}/index.js`,
    `${normalised}/index.mjs`,
    `${normalised}/index.cjs`
  ];

  for (const candidate of candidates) {
    const cleaned = candidate.replace(/^\.\//, "");
    if (fileSet.has(cleaned)) return cleaned;
  }
  return null;
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
  INSERT INTO RepoReality (
    id, scanId, kind, filePath, line, subject, operator, value, sourceLine, resolvesTo
  ) VALUES (
    @id, @scanId, @kind, @filePath, @line, @subject, @operator, @value, @sourceLine, @resolvesTo
  )
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
  const fileSet = new Set(files);
  const entries = entryPoints(files);
  const scanId = randomUUID();
  const now = new Date();

  const rows = [];

  for (const relPath of files) {
    // One row per module, so the layer above can ask about a file that contains
    // nothing else of interest. `subject` carries how the file declares itself
    // runnable, which is a fact about the file and not a judgement about it.
    rows.push({
      id: randomUUID(),
      scanId,
      kind: "module",
      filePath: relPath,
      line: 0,
      subject: entries.has(relPath) ? "entry_point" : "module",
      operator: null,
      value: relPath,
      sourceLine: relPath,
      resolvesTo: null
    });
  }

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
        // A loop bound is not a threshold. `for (var i = 0; i < 6000; i++)` says how
        // many times to go round, not what the program decides at 6000, and express
        // repeats that exact line in four files. Skipped by position rather than by
        // subject name, because the problem is the construct and not the variable —
        // a real threshold can be called `i` and a loop counter can be called
        // `retryAttempt`.
        if (inLoopHeader(lines[n], match.index)) continue;
        rows.push({
          id: randomUUID(),
          scanId,
          kind: "threshold_comparison",
          filePath: relPath,
          line: n + 1,
          subject,
          operator,
          value,
          sourceLine: (originalLines[n] ?? "").trim().slice(0, 300),
          resolvesTo: null
        });
      }

      // Read from the original line, not the stripped one. An import specifier *is*
      // a string literal, so `stripCommentsAndStrings` deletes exactly the thing this
      // is looking for — the first version of this recorded zero imports in a repo
      // with hundreds. The stripped line is still consulted, for whether the keyword
      // survived it: a line whose `import` sits inside a comment has no keyword left,
      // so this reads the original only where the stripped version proves it is code.
      if (!/\b(import|require|from)\b/.test(lines[n])) continue;

      IMPORT.lastIndex = 0;
      let imp;
      while ((imp = IMPORT.exec(originalLines[n] ?? "")) !== null) {
        const specifier = imp[1];
        rows.push({
          id: randomUUID(),
          scanId,
          kind: "import",
          filePath: relPath,
          line: n + 1,
          subject: specifier,
          operator: null,
          value: specifier,
          sourceLine: (originalLines[n] ?? "").trim().slice(0, 300),
          resolvesTo: resolveSpecifier(relPath, specifier, fileSet)
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
      `[scan] ${sha.slice(0, 8)}${dirty ? " (dirty)" : ""} · ${files.length} file(s) · ` +
        `${rows.filter((r) => r.kind === "threshold_comparison").length} threshold(s) · ` +
        `${rows.filter((r) => r.kind === "import").length} import(s) · ${entries.size} entry point(s)`
    );
  }

  return {
    scanId,
    commitSha: sha,
    dirty,
    fileCount: files.length,
    thresholdCount: rows.filter((r) => r.kind === "threshold_comparison").length,
    importCount: rows.filter((r) => r.kind === "import").length,
    entryPointCount: entries.size
  };
}

export function latestScan() {
  return db
    .prepare("SELECT * FROM RepoScan ORDER BY scannedAtMs DESC LIMIT 1")
    .get();
}
