import { randomUUID } from "node:crypto";
import db from "../realityDb.js";

// The gate. Every number a finding asserts is recomputed here against the
// record before the finding may be published, and a single mismatch rejects the
// whole thing.
//
// This is what makes generated findings admissible under the constitution. The
// layer that writes a sentence is not the layer that confirms it, and the
// confirming layer consults the stored observations rather than the draft.
//
// It is also the seam where a language model could later be allowed to write
// prose: whatever it produces still has to survive this check, and it has no
// way to move a figure past it.

export const VERIFIER_VERSION = "ver-1";

const insertClaim = db.prepare(`
  INSERT INTO FindingClaim (id, findingId, label, sql, params, expected, observed, ok, checkedAt)
  VALUES (@id, @findingId, @label, @sql, @params, @expected, @observed, @ok, @checkedAt)
`);

// Deliberately crude: it matches these words anywhere in the string, including
// inside a quoted literal. A claim counting HTTP methods and naming 'DELETE'
// is refused by it, which is how a correct query on 28 July was recorded as a
// failure rather than run.
//
// That is the intended trade. Teaching this to parse string literals means
// teaching it to decide which occurrences are safe, and the whole value of the
// rule is that it decides nothing. Write the claim another way — `method NOT IN
// ('GET','HEAD')` counts the same rows without naming one.
//
// What is worth fixing is elsewhere: a query this refuses and a figure that
// genuinely disagreed are stored identically, as ok = 0 with a null observed,
// and only one of those means the finding was wrong.
const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|attach|pragma|replace)\b/i;

/**
 * Runs one claim's query and compares the result to what the finding asserts.
 * The query must be a bare SELECT — a claim that could modify the record it is
 * checking against would defeat the point.
 */
export function checkClaim(claim) {
  const sql = String(claim.sql).trim();

  if (!/^select\b/i.test(sql) || FORBIDDEN.test(sql)) {
    return { ok: false, observed: null, reason: "claim query is not a bare SELECT" };
  }

  try {
    const params = Array.isArray(claim.params) ? claim.params : JSON.parse(claim.params);
    const row = db.prepare(sql).get(...params);
    const observed = row ? String(Object.values(row)[0]) : null;
    return { ok: observed === String(claim.expected), observed, reason: null };
  } catch (err) {
    return { ok: false, observed: null, reason: err.message };
  }
}

/**
 * Verifies every claim on a finding. Returns whether it may be published, and
 * records each check so a reader can see what was tested rather than trusting
 * that something was.
 */
export function verifyFinding(findingId, claims) {
  const checkedAt = new Date().toISOString();
  const results = [];
  let allOk = true;

  for (const claim of claims) {
    const result = checkClaim(claim);
    if (!result.ok) allOk = false;

    insertClaim.run({
      id: randomUUID(),
      findingId,
      label: claim.label,
      sql: claim.sql,
      params: JSON.stringify(claim.params),
      expected: String(claim.expected),
      observed: result.observed,
      ok: result.ok ? 1 : 0,
      checkedAt
    });

    results.push({ label: claim.label, ...result });
  }

  const failed = results.filter((r) => !r.ok);

  return {
    ok: allOk && claims.length > 0,
    checkedAt,
    results,
    reason:
      claims.length === 0
        ? "finding asserts no verifiable figure"
        : failed.length
          ? `${failed.length} claim(s) did not match: ${failed
              .map((f) => `${f.label} (expected ${f.expected ?? "?"}, observed ${f.observed ?? "error"})`)
              .join("; ")}`
          : null
  };
}

const selectClaims = db.prepare(
  "SELECT label, sql, params, expected, observed, ok, checkedAt FROM FindingClaim WHERE findingId = ?"
);

export function claimsFor(findingId) {
  return selectClaims.all(findingId);
}

/**
 * Re-checks an already published finding against the current record. Figures
 * computed over an open window legitimately move as more is observed, so a
 * drift here is information rather than an error — it says the published
 * sentence has aged.
 */
export function recheck(findingId) {
  const stored = claimsFor(findingId);
  return stored.map((c) => {
    const result = checkClaim(c);
    return {
      label: c.label,
      expected: c.expected,
      observedNow: result.observed,
      stillAccurate: result.ok
    };
  });
}
