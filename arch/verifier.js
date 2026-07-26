import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import db, { ROOT } from "./db.js";
import { firstAppearance } from "./dating.js";

// Recomputes every figure by a different route than the one that produced it.
//
// The observatory's verifier re-runs the claim's SQL against the same table the
// detector read, which catches a stale figure but not a wrong query. Here the two
// paths are genuinely separate: the detector counts rows written by the lexer in
// scan.js, and this counts matches found by git's own regex engine in the working
// tree. A defect in the lexer shows up as a disagreement rather than as a number
// that agrees with itself.
//
// This is also the point where the observatory's engine could not be reused. Its
// verifier takes SQL and calls db.prepare; these claims are shell commands over a
// git repository. The claim/verify *contract* carried over unchanged — a label, an
// expected value, and an independent way to recompute it — and the implementation
// did not. That split is the useful finding from building this here rather than
// guessing at it in a design document.

export const VERIFIER_VERSION = "arch-ver-1";

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

function matchingFiles(pattern) {
  return git(["grep", "-l", "--extended-regexp", pattern, "--", "*.js"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => !EXCLUDED.test(path) && !path.includes("node_modules/"));
}

function matchingSites(pattern) {
  return git(["grep", "-c", "--extended-regexp", pattern, "--", "*.js"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((total, line) => {
      const cut = line.lastIndexOf(":");
      const path = line.slice(0, cut);
      const count = Number(line.slice(cut + 1));
      if (EXCLUDED.test(path) || path.includes("node_modules/")) return total;
      return total + (Number.isFinite(count) ? count : 0);
    }, 0);
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
