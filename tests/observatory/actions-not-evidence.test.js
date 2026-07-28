import test from "node:test";
import assert from "node:assert/strict";

// Article: an action is never citable as evidence. A finding may not compute a
// figure from something this site did — announcing a URL is not proof anyone
// read it.
//
// The check enforcing that read the database, so what is pinned here is the
// predicate. It was a bare word match until 28 July 2026, when it went red on
//
//   ... WHERE path LIKE '%config%' ...
//
// which cites nothing at all: it counts requests in the observation record by
// what they asked for. The word `Config` is also the name of an action table,
// and the pattern could not tell a table from a substring of a URL.
//
// Narrowed to positions where a table can actually appear. That is not the same
// as teaching it which occurrences are "safe" — it is looking where tables are.

const ACTION_TABLES = ["IndexSubmission", "Trial", "Config"];

const citesAnAction = (sql) =>
  ACTION_TABLES.some((t) => new RegExp(`\\b(?:from|join)\\s+"?${t}"?\\b`, "i").test(sql));

test("a claim reading an action table is caught", () => {
  const citing = [
    "SELECT COUNT(*) AS n FROM Config WHERE key = 'search_console_token'",
    "SELECT COUNT(*) AS n FROM RequestReality r JOIN Trial t ON t.id = r.trialId",
    "SELECT COUNT(*) AS n FROM IndexSubmission WHERE submittedAt > 0",
    'SELECT COUNT(*) AS n FROM "Config"'
  ];

  for (const sql of citing) assert.equal(citesAnAction(sql), true, `must catch: ${sql}`);
});

test("a claim naming one of those words inside a path pattern is not", () => {
  // Every one of these reads the observation record only. This is the exact
  // shape that turned integrity red on a sound finding.
  const innocent = [
    "SELECT COUNT(*) AS n FROM RequestReality WHERE path LIKE '%config%'",
    "SELECT COUNT(*) AS n FROM RequestReality WHERE path LIKE '%/trial/%'",
    "SELECT COUNT(*) AS n FROM RequestReality WHERE path LIKE '%wp-config.php%'",
    "SELECT COUNT(*) AS n FROM RequestReality WHERE query LIKE '%indexsubmission%'"
  ];

  for (const sql of innocent) assert.equal(citesAnAction(sql), false, `must permit: ${sql}`);
});

test("the live store carries no claim that cites an action", async () => {
  const { default: db } = await import("../../public-site/realityDb.js");
  const offenders = db
    .prepare("SELECT label, sql FROM FindingClaim")
    .all()
    .filter((c) => citesAnAction(c.sql))
    .map((c) => c.label);

  assert.deepEqual(offenders, []);
});
