import test from "node:test";
import assert from "node:assert/strict";

import { hypotheses, HYPOTHESIS_VERSION } from "../../public-site/hypotheses.js";
import { habits } from "../../public-site/patterns.js";

// The failure this engine is built against is a single hypothesis.
//
// "AI clients never reached /pricing, so the links to it may not be visible"
// becomes an explanation the moment it is the only one on the page, and the
// reader stops looking — while the record supported four other readings just as
// well. So the tests here are mostly about plurality, about refusing to rank,
// and about not leaving a candidate open when the record could already close it.

test("a habit never yields one explanation", () => {
  for (const h of hypotheses())
    assert.ok(
      h.candidates.length >= 2,
      `${h.id} offers ${h.candidates.length} explanation — that is a conclusion, not a hypothesis`
    );
});

test("every candidate names the observation that would separate it", () => {
  // A hypothesis with no separator cannot be wrong, which means it cannot be
  // useful either. The sentence is also the experiment, written before anyone
  // runs it.
  for (const h of hypotheses())
    for (const c of h.candidates) {
      assert.ok(c.separatedBy && c.separatedBy.length > 10, `${h.id}/${c.id} has no separator`);
      assert.ok(c.evidence && c.evidence.length > 10, `${h.id}/${c.id} says nothing about the record`);
    }
});

test("candidates carry a status and are not ordered by plausibility", () => {
  // Ranking would be an opinion wearing a measurement's clothes. The order is
  // the order the rules are written in, and it is stable regardless of what the
  // record says.
  const order = hypotheses().map((h) => h.candidates.map((c) => c.id).join(","));
  const again = hypotheses().map((h) => h.candidates.map((c) => c.id).join(","));

  assert.deepEqual(order, again, "the order moved between two reads of the same record");

  for (const h of hypotheses())
    for (const c of h.candidates)
      assert.ok(
        ["supported", "contradicted", "untested"].includes(c.status),
        `${h.id}/${c.id} has an undeclared status: ${c.status}`
      );
});

test("a candidate the record can already settle is not left open", () => {
  // The point of writing separators as observations: one that could have been
  // eliminated this morning and is published as open is not a hypothesis, it is
  // a gap in the reading.
  for (const h of hypotheses()) {
    assert.ok(
      h.settled >= 1,
      `${h.id} used none of the record it was drawn from`
    );
    assert.equal(h.settled + h.open, h.candidates.length);
  }
});

test("the site's own rules are read from what the edge delivered, not from the generator", () => {
  // The whole reason this site has a self-observation sensor: for an unknown
  // period the edge served a robots.txt that refused eight AI crawlers over an
  // origin that welcomes them. Answering "do our rules refuse this crawler" from
  // the code that builds the file would answer about bytes nobody received.
  for (const h of hypotheses()) {
    const refused = h.candidates.find((c) => c.id === "refused");
    assert.ok(refused, `${h.id} does not consider its own rules as an explanation`);
    assert.match(refused.separatedBy, /edge/, "the separator must name where it looked");
  }
});

test("the vendor's own account of its crawler is never treated as settling anything", () => {
  // Left open on principle rather than for lack of effort. A verification whose
  // evidence comes from the party being checked is not a verification, and this
  // is the one candidate that could only be closed that way.
  for (const h of hypotheses()) {
    const byDesign = h.candidates.find((c) => c.id === "by-design");
    if (!byDesign) continue;
    assert.equal(byDesign.status, "untested");
    assert.match(byDesign.evidence, /vendor/i);
  }
});

test("no hypothesis is raised about a crawler the pattern layer will not describe", () => {
  // A hypothesis about a crawler seen twice is a hypothesis about nothing.
  const describable = new Set(habits().filter((h) => h.describable).map((h) => h.agent));
  for (const h of hypotheses())
    assert.ok(describable.has(h.agent), `${h.agent} has hypotheses and no describable habit`);
});

test("the observation states the visits it rests on, not just a share", () => {
  for (const h of hypotheses()) {
    assert.match(h.observation, /\d+ of \d+ corroborated visits/);
    assert.ok(h.figures.days >= 1 && h.figures.addresses >= 1);
  }
});

test("the version is stamped", () => {
  assert.match(HYPOTHESIS_VERSION, /^hyp-\d+$/);
});
