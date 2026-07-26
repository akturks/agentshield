import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import db, { ROOT } from "./db.js";
import { firstAppearance, reachedPattern } from "./dating.js";
import { stripCommentsAndStrings, stripComments, isProgramFile, SOURCE_PATHSPEC } from "./scan.js";
import { isGeneratedDoc } from "./generated.js";

// Recomputes every figure by a different route than the one that produced it.
//
// The observatory's verifier re-runs the claim's SQL against the same table the
// detector read, which catches a stale figure but not a wrong query. Here the search
// is done twice by different machinery: the detector counts rows the lexer in scan.js
// wrote into the database, and this counts what git's own regex engine finds in the
// working tree. A defect in the lexer surfaces as a disagreement rather than as a
// number agreeing with itself, and on the first run it did exactly that.
//
// One thing is shared on purpose, and it is worth being precise about which. What
// counts as *code* — everything outside a comment or a string literal — comes from
// one function, `stripCommentsAndStrings`, used by both paths. That is a definition,
// and the observatory learned at the cost of a wrong published figure that a
// definition stated in two places becomes two definitions. Independence is worth
// having in the search and not in the vocabulary.
//
// This is also where the observatory's engine could not be reused. Its verifier takes
// SQL and calls db.prepare; these claims are shell and filesystem operations over a
// git repository. The claim/verify *contract* carried over unchanged — a label, an
// expected value, and an independent way to recompute it — and the implementation did
// not. That split is the useful finding from building this here rather than guessing
// at it in a design document.

export const VERIFIER_VERSION = "arch-ver-12";

const EXCLUDED = /\.(backup|bak|orig|old)(\.|$)/;

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024
    });
  } catch (err) {
    // git grep exits 1 when nothing matched, which is an answer of zero rather
    // than a failure. Anything else is a real error and must not read as zero.
    if (err.status === 1 && typeof err.stdout === "string") return err.stdout;
    throw err;
  }
}

/**
 * Turns a POSIX pattern from dating.js into its JavaScript equivalent.
 *
 * JavaScript has no POSIX character classes, and getting this wrong fails silently
 * in both directions. `[[:space:]]` left untranslated matches a literal 's' and
 * everything stops matching. Worse, `[^_$.[:alnum:]]` is not merely unsupported: JS
 * closes the class at the first `]` it sees, so it parses as "not one of `_$.[:alnum`"
 * followed by a literal `]` — a pattern demanding a bracket before the subject, which
 * nothing has. That is how the anchored version of fastify's `statusCode >= 400`
 * came back as `observed 0` when git had correctly found 2.
 *
 * Order matters: `[[:space:]]` contains `[:space:]`, so the wider form goes first.
 * Anything left containing `[:` afterwards is a class this function does not know,
 * and it throws rather than building a regex whose meaning it cannot vouch for.
 */
function toJsRegex(pattern) {
  const translated = pattern
    .replaceAll("[[:space:]]", "\\s")
    .replaceAll("[:space:]", "\\s")
    .replaceAll("[:alnum:]", "a-zA-Z0-9")
    .replaceAll("[:digit:]", "0-9")
    .replaceAll("[:alpha:]", "a-zA-Z");

  if (translated.includes("[:")) {
    throw new Error(
      `toJsRegex: unhandled POSIX character class in "${pattern}" — a verifier that ` +
        `guesses at a pattern it cannot read is worse than one that stops`
    );
  }

  return new RegExp(translated);
}

/**
 * Lines where the pattern appears in code, found by git and confirmed by re-reading.
 *
 * git grep matches text, including text inside comments. The scan does not: it
 * strips comments and string literals before looking, because a threshold written in
 * a doc comment is documentation and not a branch. So the two disagreed the first
 * time a comment in `arch/detectors.js` quoted `risk.riskScore >= 90` as an example
 * — the scan saw 6 sites, git saw 7, and the finding was refused. Which is the
 * verifier doing its job; the question was only which side to correct.
 *
 * git finds the candidates and the file is then re-read to drop the ones inside
 * comments, using the same `stripCommentsAndStrings` the scanner uses. Sharing that
 * function is deliberate and is not a loss of independence: what counts as code is a
 * *definition*, and the observatory learned at some cost that a definition stated
 * twice becomes two definitions. What stays independent is the part that matters —
 * git's regex engine searching git's own view of the tree, against a line-by-line
 * lexer scan. A defect in either still surfaces as a disagreement.
 */
function codeMatches(pattern) {
  // Every extension the scanner reads, not just *.js. Running against axios, the
  // scan found `NODE_VERSION < 18` in two `.cjs` files and this grep found none —
  // `-- '*.js'` does not match `.cjs`, so the verifier reported zero and refused a
  // candidate for the wrong reason. A pathspec narrower than the scan's turns every
  // finding outside it into a false refusal.
  const raw = git([
    "grep",
    "-n",
    "--extended-regexp",
    pattern,
    "--",
    ...SOURCE_PATHSPEC
  ]);
  const re = toJsRegex(pattern);
  const byFile = new Map();

  for (const entry of raw.split("\n")) {
    if (!entry.trim()) continue;
    const first = entry.indexOf(":");
    const second = entry.indexOf(":", first + 1);
    if (first === -1 || second === -1) continue;

    const path = entry.slice(0, first);
    const lineNo = Number(entry.slice(first + 1, second));
    if (EXCLUDED.test(path) || path.includes("node_modules/")) continue;
    if (!Number.isFinite(lineNo)) continue;

    if (!byFile.has(path)) byFile.set(path, []);
    byFile.get(path).push(lineNo);
  }

  const confirmed = new Map();

  for (const [path, lineNumbers] of byFile) {
    let stripped;
    try {
      stripped = stripCommentsAndStrings(readFileSync(join(ROOT, path), "utf8")).split("\n");
    } catch {
      continue;
    }
    const kept = lineNumbers.filter((n) => re.test(stripped[n - 1] ?? ""));
    if (kept.length > 0) confirmed.set(path, kept);
  }

  return confirmed;
}

function matchingFiles(pattern) {
  return [...codeMatches(pattern).keys()];
}

/**
 * Program files whose code writes this module's name down, by any means.
 *
 * Confirmed by re-reading with comments removed and strings kept, which is the only part
 * of this that needs care: `git grep` finds the name in prose as readily as in a `fork`
 * call, and a module whose *documentation* mentions it would then count as reached — the
 * quietest possible false negative, since it makes the tool report nothing.
 */
function namingFiles(path) {
  const pattern = reachedPattern(path.split("/").pop());
  const re = toJsRegex(pattern);
  const raw = git([
    "grep",
    "-l",
    "--extended-regexp",
    pattern,
    "--",
    ...SOURCE_PATHSPEC
  ]);

  return raw
    .split("\n")
    .map((l) => l.trim())
    // Same scope the scan uses, via the same predicate. Test scripts import some of
    // these modules and the scan does not read test scripts, so counting their imports
    // here would refuse a finding that is correct about the program.
    .filter((l) => l && l !== path && isProgramFile(l))
    .filter((candidate) => {
      try {
        return re.test(stripComments(readFileSync(join(ROOT, candidate), "utf8")));
      } catch {
        return false;
      }
    });
}

function matchingSites(pattern) {
  let total = 0;
  for (const lines of codeMatches(pattern).values()) total += lines.length;
  return total;
}

/** Recomputes one claim independently and returns what it observed. */
export function observe(claim) {
  const spec = claim.verify;
  if (!spec) return null;

  if (spec.kind === "git-grep-files") return String(matchingFiles(spec.pattern).length);
  if (spec.kind === "git-grep-sites") return String(matchingSites(spec.pattern));

  // Files carrying *every* pattern in the set, which is the claim being made — two
  // files that agree on one of three thresholds are not the finding. Intersection,
  // not union, and the difference is the whole point of grouping per expression.
  if (spec.kind === "git-grep-files-all") {
    const sets = spec.patterns.map((p) => new Set(matchingFiles(p)));
    if (sets.length === 0) return "0";
    const [first, ...rest] = sets;
    const all = [...first].filter((file) => rest.every((s) => s.has(file)));
    return String(all.length);
  }

  if (spec.kind === "git-grep-sites-any") {
    return String(spec.patterns.reduce((total, p) => total + matchingSites(p), 0));
  }
  // Recomputed from git's view of the tree, not from the scan's rows. The scan resolves
  // path literals through its own tail-matching index; this asks git's regex engine
  // whether the module's name appears in any string literal in the tree. The two
  // disagree when the scan's resolution is wrong — which is why the claim is checked
  // this way rather than by re-running the query that produced it.
  if (spec.kind === "unimported-count") {
    let unreached = 0;
    for (const path of spec.paths) {
      if (namingFiles(path).length === 0) unreached += 1;
    }
    return String(unreached);
  }

  if (spec.kind === "documented-count") {
    let documented = 0;
    for (const path of spec.paths) {
      const base = path.split("/").pop();
      // This tool's own reports do not count as the project documenting anything, via
      // the same predicate the detector uses. Two definitions of "documentation" here
      // would be the seventh time, and this one would make both paths agree on a figure
      // the report had manufactured about itself.
      const hits = git(["grep", "-l", "-F", base, "--", "*.md"])
        .split("\n")
        .filter(Boolean)
        .filter((hit) => !isGeneratedDoc(hit));
      if (hits.length > 0) documented += 1;
    }
    return String(documented);
  }

  if (spec.kind === "never-referenced-count") {
    let never = 0;
    for (const path of spec.paths) {
      const out = git([
        "log",
        "--pickaxe-regex",
        `-S${reachedPattern(path.split("/").pop())}`,
        "--format=%H",
        "--",
        ...SOURCE_PATHSPEC
      ]);
      if (out.split("\n").filter(Boolean).length === 0) never += 1;
    }
    return String(never);
  }

  if (spec.kind === "first-appearance") {
    const found = firstAppearance(spec);
    return found ? found.sha.slice(0, 8) : null;
  }
  return null;
}

const insertClaim = db.prepare(`
  INSERT INTO ArchFindingClaim (
    id, findingId, label, expected, observed, ok, reproduceWith, checkedAt
  ) VALUES (@id, @findingId, @label, @expected, @observed, @ok, @reproduceWith, @checkedAt)
`);

/**
 * Checks every claim and records the result.
 *
 * A finding whose figures cannot be reproduced is not published. The claims are
 * written either way, including the ones that failed, because a rejected finding
 * with its mismatch on record is how the tool's own error rate stays visible.
 */
export function verifyFinding(findingId, claims) {
  const checkedAt = new Date().toISOString();
  const results = [];

  for (const claim of claims) {
    let observed = null;
    let error = null;
    try {
      observed = observe(claim);
    } catch (err) {
      error = err.message;
    }

    const ok = error === null && observed !== null && observed === claim.expected;
    results.push({ label: claim.label, expected: claim.expected, observed, ok, error });

    insertClaim.run({
      id: randomUUID(),
      findingId,
      label: claim.label,
      expected: claim.expected,
      observed,
      ok: ok ? 1 : 0,
      reproduceWith: claim.reproduceWith,
      checkedAt
    });
  }

  const failed = results.filter((r) => !r.ok);
  return {
    ok: results.length > 0 && failed.length === 0,
    checkedAt,
    results,
    reason: failed.length
      ? failed
          .map((f) => `${f.label}: expected ${f.expected}, observed ${f.error ?? f.observed}`)
          .join("; ")
      : null
  };
}

export function claimsFor(findingId) {
  return db
    .prepare(
      `SELECT label, expected, observed, ok, reproduceWith, checkedAt
       FROM ArchFindingClaim WHERE findingId = ? ORDER BY rowid`
    )
    .all(findingId);
}
