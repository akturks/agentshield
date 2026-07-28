import test from "node:test";
import assert from "node:assert/strict";

import { readiness, QUESTIONS, READINESS_VERSION } from "../../public-site/readiness.js";
import { status } from "../../public-site/pages/status.js";
import { escapeHtml } from "../../public-site/layout.js";

// The table exists to stop this system claiming more than it has seen.
//
// A measurement instrument does not usually lie by reporting a wrong number. It
// lies by reporting a real one from a sample that cannot carry it — "GPTBot does
// not read product pages" is defensible after two hundred visits and a
// fabrication after six. These tests are about the machinery that keeps the two
// apart, so most of them assert that a row stays amber.

test("every question declares what it needs before it may be answered", () => {
  // A threshold held in judgement rather than in code moves quietly at the moment
  // an answer is wanted. This asserts each one is written down.
  for (const q of QUESTIONS) {
    assert.ok(q.threshold >= 1, `${q.id} has no threshold`);
    assert.ok(q.needs && q.needs.length > 4, `${q.id} does not say what it needs`);
    assert.equal(typeof q.observed, "function", `${q.id} does not measure itself`);
  }
});

test("built code and sufficient observation are separate axes", () => {
  // The confusion this file exists to prevent. A question can hold plenty of
  // observations with no code behind it, and — more dangerously — can have
  // finished code, nothing observed, and look complete.
  const rows = readiness();

  for (const row of rows)
    assert.ok(
      ["not built", "nothing observed", "observing", "answerable"].includes(row.state),
      `${row.id} is in an undeclared state: ${row.state}`
    );

  const unbuilt = QUESTIONS.filter((q) => !q.built).map((q) => q.id);
  for (const id of unbuilt) {
    const row = rows.find((r) => r.id === id);
    assert.equal(row.state, "not built", `${id} has no code and must not read as ready`);
    assert.equal(row.answerable, false, `${id} must never be answerable without code`);
  }
});

test("a question is answerable only at or above its own threshold", () => {
  for (const row of readiness()) {
    if (!row.answerable) continue;
    assert.ok(
      row.observed >= row.threshold,
      `${row.id} is answerable on ${row.observed} of a required ${row.threshold}`
    );
  }
});

test("ingestion is stated as zero rather than queried into looking better", () => {
  // The counter this site exists to move. It has been zero since the first day,
  // and it is the one row where a plausible-looking query — counting markers
  // published, or requests to marker-bearing pages — would quietly answer a
  // different question and turn the row green.
  const row = readiness().find((r) => r.id === "ingestion");

  assert.equal(row.observed, 0);
  assert.equal(row.state, "nothing observed");
  assert.equal(row.threshold, 1, "one marker would be enough; it is not a trend claim");
});

test("a trend needs three weeks, because two points make a line through anything", () => {
  const row = readiness().find((r) => r.id === "trend");
  assert.equal(row.threshold, 3);
});

test("the status page prints the state, not a tick", () => {
  const html = status("asd-test-marker", "2026-07-28T09:00:00.000Z");

  assert.match(html, /What this instrument can answer today/);

  // Compared through the same escaper the page uses. A question containing an
  // apostrophe reaches the HTML as an entity, and a test searching for the raw
  // string fails on a page that is correct.
  for (const row of readiness()) {
    assert.ok(html.includes(escapeHtml(row.question)), `the page omits: ${row.question}`);
    if (!row.answerable)
      assert.ok(
        html.includes(String(row.observed)),
        `${row.id} is shown without how much the record actually holds`
      );
  }
});

test("the version is stamped, so a threshold change is visible", () => {
  assert.match(READINESS_VERSION, /^rdy-\d+$/);
});
