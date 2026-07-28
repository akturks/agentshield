import test from "node:test";
import assert from "node:assert/strict";

import { checkClaim } from "../../public-site/findings/verifier.js";

// F-009 was published on 28 July 2026 with two claims marked not ok. Two
// separate holes let it through, and this file covers both of them at the level
// they can be tested without writing to the live record.
//
// The integrity check itself reads the database, so it is exercised by running
// `epistemicIntegrity()` against the real store — see integrity.js. What is
// pinned here is the predicate it now uses and the verifier behaviour that
// produced the failure in the first place.

test("a claim query naming a forbidden word is refused rather than run", () => {
  // This is the guard working as designed. The query is harmless and correct;
  // it is refused because deciding which occurrences of DELETE are safe is
  // exactly the judgement the rule exists to avoid making.
  const refused = checkClaim({
    label: "requests using a writing method",
    sql: "SELECT COUNT(*) AS n FROM RequestReality WHERE method IN ('POST','DELETE')",
    params: [],
    expected: 24
  });

  assert.equal(refused.ok, false);
  assert.equal(refused.observed, null);
  assert.match(refused.reason, /bare SELECT/);
});

test("the same rows counted without naming the method are evaluated normally", () => {
  const run = checkClaim({
    label: "requests using a method that writes rather than reads",
    sql: "SELECT COUNT(*) AS n FROM RequestReality WHERE method NOT IN ('GET','HEAD')",
    params: [],
    // Deliberately wrong: this test is about whether the query ran, not about
    // what the record currently holds, which grows.
    expected: -1
  });

  assert.equal(run.ok, false, "the expectation was wrong, so the claim must not pass");
  assert.notEqual(run.observed, null, "but it must have produced an observed value");
  assert.equal(run.reason, null, "and it must not have been refused");
});

test("a refused query and a disagreeing figure are not yet distinguishable in the stored row", () => {
  // This is the known defect written into F-009 rather than fixed. If it is
  // ever fixed, this test should fail and be replaced by one asserting the
  // distinction — that is the point of pinning it.
  const refused = checkClaim({
    sql: "SELECT 1 AS n WHERE 1 = 1 AND 'DELETE' = 'DELETE'",
    params: [],
    expected: 1
  });
  const disagreed = checkClaim({
    sql: "SELECT 1 AS n",
    params: [],
    expected: 2
  });

  assert.equal(refused.ok, disagreed.ok);
  assert.equal(
    refused.observed === null,
    true,
    "a refused query records no observation, which is what makes it look like a failure"
  );
});
