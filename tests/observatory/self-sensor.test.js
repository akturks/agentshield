import test from "node:test";
import assert from "node:assert/strict";

import {
  changesIn,
  volatilityIn,
  divergenceIn
} from "../../public-site/self/changes.js";
import { WATCHED, USER_AGENT } from "../../public-site/self/sensor.js";
import db from "../../public-site/realityDb.js";
import { EXTERNAL } from "../../public-site/stats.js";

// The sensor exists because this site could not say when its own robots.txt
// started being rewritten. Its whole value is in the comparison, so the
// comparison is what gets tested — over rows written here rather than over the
// live record, which would make these tests pass or fail on what the CDN
// happened to do this morning.

const at = (minute, sha, extra = {}) => ({
  observedAt: `2026-07-28T${String(minute).padStart(2, "0")}:00:00.000Z`,
  observedAtMs: Date.UTC(2026, 6, 28, minute),
  bodySha256: sha,
  bodyBytes: sha === null ? null : sha.length * 100,
  httpStatus: 200,
  errorCode: null,
  ...extra
});

test("a change is two consecutive observations whose bytes differ", () => {
  const found = changesIn([at(1, "aaa"), at(2, "aaa"), at(3, "bbb"), at(4, "bbb")]);

  assert.equal(found.length, 1, "one transition, not two identical pairs");
  assert.equal(found[0].from.sha256, "aaa");
  assert.equal(found[0].to.sha256, "bbb");
  assert.equal(found[0].to.at, "2026-07-28T03:00:00.000Z", "dated at the observation that differed");
});

test("an outage is not an edit", () => {
  // "The edge did not answer" and "the edge answered with something new" are
  // different events. Folding them together would publish an outage as a change
  // to the file, twice — once entering the outage and once leaving it.
  const found = changesIn([
    at(1, "aaa"),
    at(2, null, { errorCode: "ECONNRESET", httpStatus: null, bodyBytes: null }),
    at(3, "aaa")
  ]);

  assert.deepEqual(found, [], "a failed observation ends a comparison, it does not make one");
});

test("volatility with nothing to compare is null, not zero", () => {
  // Zero would read as "this file never changes", which is a claim. One
  // observation supports no claim about change at all.
  const none = volatilityIn([]);
  const one = volatilityIn([at(1, "aaa")]);

  assert.equal(none.rate, null);
  assert.equal(none.comparisons, 0);
  assert.equal(one.rate, null, "one snapshot is not evidence of stability");
});

test("a path that changes on every sweep describes itself as dynamic", () => {
  // This is how the site learns that /lab is regenerated per request instead of
  // being told in a hardcoded list. A list is a claim nobody rechecks, and it
  // goes stale the first time a page becomes static.
  const stable = volatilityIn([at(1, "aaa"), at(2, "aaa"), at(3, "aaa")]);
  const dynamic = volatilityIn([at(1, "aaa"), at(2, "bbb"), at(3, "ccc")]);

  assert.equal(stable.rate, 0);
  assert.equal(dynamic.rate, 100);
  assert.equal(dynamic.comparisons, 2, "three observations make two comparisons");
});

test("the two vantages are paired by sweep, never by nearest timestamp", () => {
  // Time-matching would answer even when a vantage is missing, by reaching for a
  // neighbour minutes away. A difference measured across that gap cannot tell a
  // CDN apart from an edit that happened in between.
  const runs = [
    {
      runId: "r1",
      atMs: 1,
      rows: [
        { vantage: "origin", ...at(1, "same") },
        { vantage: "edge", ...at(1, "same") }
      ]
    },
    {
      runId: "r2",
      atMs: 2,
      rows: [{ vantage: "origin", ...at(2, "lonely") }]
    }
  ];

  const [paired, halfSweep] = divergenceIn(runs);

  assert.equal(paired.comparable, true);
  assert.equal(paired.identical, true);

  assert.equal(halfSweep.comparable, false, "one vantage is not a comparison");
  assert.equal(halfSweep.identical, null, "and yields no verdict, rather than 'unchanged'");
  assert.equal(halfSweep.byteDelta, null);
});

test("the byte delta is signed from the edge's side", () => {
  // The injected robots.txt was 3,304 bytes over an origin of 1,468. A positive
  // delta means the edge delivered more than this server sent, which is the
  // direction that matters.
  const [run] = divergenceIn([
    {
      runId: "r1",
      atMs: 1,
      rows: [
        { vantage: "origin", ...at(1, "o"), bodyBytes: 1468 },
        { vantage: "edge", ...at(1, "e"), bodyBytes: 3304 }
      ]
    }
  ]);

  assert.equal(run.identical, false);
  assert.equal(run.byteDelta, 1836, "the edge added bytes this server never sent");
});

test("an unreachable edge is not reported as agreement", () => {
  const [run] = divergenceIn([
    {
      runId: "r1",
      atMs: 1,
      rows: [
        { vantage: "origin", ...at(1, "o") },
        { vantage: "edge", ...at(1, null, { errorCode: "UND_ERR_CONNECT_TIMEOUT", bodyBytes: null }) }
      ]
    }
  ]);

  assert.equal(run.comparable, false);
  assert.equal(run.identical, null);
});

test("stage one watches the file that caused the problem, and only it", () => {
  // A sensor pointed at everything before it is known to work on anything
  // produces noise nobody reads. This asserts the scope rather than trusting a
  // comment about it.
  assert.deepEqual(WATCHED, ["/robots.txt"]);
});

test("the sensor's own requests never count as external traffic", () => {
  // The sensor makes real HTTP requests to this server, so it appears in
  // RequestReality like any client. The loopback side carries no cf-ray and the
  // edge side comes from a declared operator address, so both fall outside
  // EXTERNAL — but that is a consequence of two separate rules, and a change to
  // either would silently turn this instrument into its own traffic.
  const leaked = db
    .prepare(
      `SELECT COUNT(*) AS n FROM RequestReality
       WHERE userAgent LIKE 'AgentShieldSelfSensor%' AND ${EXTERNAL}`
    )
    .get().n;

  assert.equal(leaked, 0, "the site is measuring itself watching itself");
});

test("the sensor introduces itself with a reachable explanation", () => {
  assert.match(USER_AGENT, /^AgentShieldSelfSensor\//);
  assert.match(USER_AGENT, /\+https:\/\/agentshieldaidefense\.com\//);
});
