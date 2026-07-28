import test from "node:test";
import assert from "node:assert/strict";

import {
  changesIn,
  volatilityIn,
  divergenceIn,
  diffBodies
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

test("the sensor watches the terms and the pages a crawler would read", () => {
  // Three files that state this site's terms, and five pages a client arriving
  // from them would actually read. Asserted rather than left to a comment: what
  // is watched is what a future finding can be dated against, and a path quietly
  // dropped from this list stops being observable without anything failing.
  assert.deepEqual(WATCHED, [
    "/robots.txt",
    "/llms.txt",
    "/sitemap.xml",
    "/",
    "/about",
    "/lab",
    "/findings",
    "/constitution"
  ]);
});

test("a diff says which rules arrived and which left", () => {
  // With three files watched, "something changed" stops being actionable. This
  // is the exact shape of what was done to this site: a block prepended, nothing
  // removed.
  const before = "User-agent: GPTBot\nAllow: /\n";
  const after = "User-agent: GPTBot\nDisallow: /\nUser-agent: CCBot\nDisallow: /\n";

  const d = diffBodies(before, after);

  assert.deepEqual(d.removed, ["Allow: /"], "the permission that disappeared");
  assert.deepEqual(
    d.added,
    ["Disallow: /", "User-agent: CCBot"],
    "and what replaced it, deduplicated — a rules file repeats Disallow under every agent"
  );
  assert.equal(d.reorderedOnly, false);
});

test("a repeated rule is one change, not nine", () => {
  // The block inserted into this site's robots.txt carried `Disallow: /` under
  // nine user-agent groups. Listing the identical line nine times would make one
  // insertion read as nine separate changes.
  const after = ["A", "B", "C"].map((a) => `User-agent: ${a}\nDisallow: /`).join("\n");
  const d = diffBodies("User-agent: *\nAllow: /", after);

  assert.equal(d.added.filter((l) => l === "Disallow: /").length, 1);
});

test("the daily sitemap bump shows as one line, so it can be told from a rewrite", () => {
  // This site's own sitemap derives <lastmod> from today's date, so its bytes
  // change every midnight UTC by its own doing. A change detector that cannot
  // separate that from a rewritten rule will be ignored inside a week — and the
  // separation is visible in the diff rather than hardcoded as an exception.
  const before = "<loc>https://x/a</loc>\n<lastmod>2026-07-28</lastmod>\n<loc>https://x/b</loc>";
  const after = "<loc>https://x/a</loc>\n<lastmod>2026-07-29</lastmod>\n<loc>https://x/b</loc>";

  const d = diffBodies(before, after);

  assert.equal(d.added.length, 1);
  assert.equal(d.removed.length, 1);
  assert.match(d.added[0], /lastmod/, "only the date line moved");
  assert.match(d.removed[0], /lastmod/);
});

test("a body whose lines were only reordered does not read as unchanged", () => {
  // The worst possible answer. Hashes differ, so something happened; a line-set
  // diff finds nothing, and reporting nothing would hide a file whose parse
  // order changed — which for a rules file changes what applies first.
  const d = diffBodies("A\nB\nC", "C\nB\nA");

  assert.deepEqual(d.added, []);
  assert.deepEqual(d.removed, []);
  assert.equal(d.reorderedOnly, true, "the emptiness has to be labelled, not returned bare");
});

test("blank lines and trailing whitespace are not changes", () => {
  const d = diffBodies("User-agent: *\n\nDisallow: /x", "User-agent: *   \nDisallow: /x\n\n");
  assert.equal(d.added.length, 0);
  assert.equal(d.removed.length, 0);
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
