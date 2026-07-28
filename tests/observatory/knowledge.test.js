import test from "node:test";
import assert from "node:assert/strict";

import { knowledge, STATEMENTS, KNOWLEDGE_VERSION } from "../../public-site/knowledge.js";
import { findingsIndex } from "../../public-site/pages/findings.js";
import { escapeHtml } from "../../public-site/layout.js";

// This layer was built before it had anything to hold, and that is the risk it
// is written against: an empty container invites being filled later with
// whatever sounds reasonable. The guard is that every statement prints how many
// chances the record has given it to be false, and stays untested below a
// declared minimum.

test("every statement names one observation that would end it", () => {
  // A statement nothing could falsify is not knowledge, it is a slogan. The
  // counterexample query is the sentence made executable.
  for (const s of STATEMENTS) {
    assert.ok(s.endedBy && s.endedBy.length > 10, `${s.id} names nothing that would end it`);
    assert.equal(typeof s.counterexamples, "function", `${s.id} cannot check itself`);
    assert.equal(typeof s.opportunities, "function", `${s.id} does not count its own chances`);
    assert.ok(s.minimum >= 1, `${s.id} has no minimum`);
  }
});

test("a statement with a counterexample has ended, whatever else is true of it", () => {
  // The state that matters. A claim the record has stopped supporting must leave
  // the knowledge column by itself, on the next read, with nobody remembering.
  for (const row of knowledge()) {
    if (row.counterexamples > 0)
      assert.equal(row.state, "ended", `${row.id} has ${row.counterexamples} counterexamples and is not ended`);
    if (row.state === "ended") assert.ok(row.counterexamples > 0);
  }
});

test("a statement below its minimum is never called knowledge", () => {
  // "No external client has executed the script" reads identically across five
  // page views and five thousand. Across five it is worth nothing.
  for (const row of knowledge()) {
    if (row.state === "holding")
      assert.ok(
        row.opportunities >= row.minimum,
        `${row.id} is holding on ${row.opportunities} of a required ${row.minimum}`
      );
    if (row.opportunities < row.minimum && row.counterexamples === 0)
      assert.equal(row.state, "untested", `${row.id} claims more than it has been given a chance to`);
  }
});

test("ingestion is stated, not queried", () => {
  // No column holds whether a marker was seen in a model's output, and none
  // should: the sighting happens outside this system. A query that appeared to
  // answer it would be answering something else and turning the row green.
  const row = knowledge().find((r) => r.id === "no-ingestion");
  assert.equal(row.counterexamples, 0);
  assert.ok(row.opportunities > 0, "markers have been published");
});

test("script execution is counted against external clients only", () => {
  // The unfiltered table holds two beacons and both are the operator's own test
  // clients. That figure once reached a headline function on this site and went
  // unrendered by luck; here it would turn a true statement false.
  const row = knowledge().find((r) => r.id === "no-script-execution");
  assert.equal(row.counterexamples, 0, "an operator beacon is being counted as an external client");
});

test("every claim is negative, because only a negative can be ended by one observation", () => {
  for (const s of STATEMENTS)
    assert.match(
      s.claim,
      /^(No|Nothing|Among[\s\S]*?none|The bytes)/,
      `${s.id} is not phrased as something that could be ended by a single counterexample`
    );
});

test("the page prints the chances alongside the sentence, never the sentence alone", () => {
  const html = findingsIndex("asd-test-marker", "2026-07-28T10:00:00.000Z");

  assert.match(html, /What has kept being true/);

  for (const row of knowledge()) {
    assert.ok(html.includes(escapeHtml(row.claim)), `the page omits: ${row.id}`);
    assert.ok(
      html.includes(`${row.opportunities} ${row.unit}`),
      `${row.id} appears without how many chances it has had`
    );
    assert.ok(html.includes(escapeHtml(row.endedBy)), `${row.id} appears without what would end it`);
  }
});

test("the version is stamped, so a minimum changing is visible", () => {
  assert.match(KNOWLEDGE_VERSION, /^kno-\d+$/);
});
