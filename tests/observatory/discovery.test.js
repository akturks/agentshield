import test from "node:test";
import assert from "node:assert/strict";

import { ladder, REPORTS, DISCOVERY_VERSION } from "../../public-site/discovery.js";
import { discovery } from "../../public-site/pages/discovery.js";
import { escapeHtml } from "../../public-site/layout.js";

// The ladder answers the question a site owner actually arrives with, and the
// only thing that makes it worth answering is the separation between what this
// site saw and what somebody else said. Collapse that and the page becomes a
// score with extra steps.

test("every rung declares whether it was observed here or reported by someone else", () => {
  for (const r of ladder().rungs)
    assert.ok(
      r.kind === "observed" || r.kind === "reported",
      `${r.id} is neither observed nor reported: ${r.kind}`
    );
});

test("nothing inside another party's system is called observed", () => {
  // A search console saying a page is indexed is a vendor's account of its own
  // index — the same class of evidence this project refuses when a model
  // describes what it has read. Calling it an observation would be the exact
  // substitution the site exists to reject.
  const insideSomeoneElse = new Set(["google-index", "assistant-retrieval"]);
  for (const r of ladder().rungs)
    if (insideSomeoneElse.has(r.id))
      assert.equal(r.kind, "reported", `${r.id} is presented as something this site observed`);
});

test("the marker rung is observed, because a coined string needs nobody's word", () => {
  // The one upper rung that is evidence rather than testimony: the string exists
  // in exactly one place, so its appearance is a fact rather than a claim.
  const marker = ladder().rungs.find((r) => r.id === "marker-in-output");
  assert.equal(marker.kind, "observed");
  assert.equal(marker.at, null, "it has never been reached");
});

test("every report names who said it and when", () => {
  for (const r of REPORTS) {
    assert.ok(r.reportedBy && r.reportedBy.length > 8, `${r.id} does not say who reported it`);
    assert.match(r.reportedAt, /^\d{4}-\d{2}-\d{2}$/, `${r.id} has no date`);
    assert.ok(r.says && r.says.length > 8, `${r.id} does not say what was reported`);
  }
});

test("the corroborated arrival is not the impostor", () => {
  // Without the address check, the earliest "AI crawler arrival" on this record
  // would be the minute one address presented thirteen identities. The rung
  // would then be dated to a forgery.
  const arrival = ladder().rungs.find((r) => r.id === "crawler-arrival");
  if (!arrival.at) return;
  assert.ok(arrival.at < "2026-07-26T22:00", "the first corroborated arrival is dated to the rotation incident");
});

test("a rung nobody has reached prints as not reached rather than as zero", () => {
  const html = discovery("asd-test-marker", "2026-07-28T11:00:00.000Z");
  const unreached = ladder().rungs.filter((r) => !r.at);

  for (const r of unreached)
    assert.ok(
      html.includes(escapeHtml(r.rung)),
      `${r.id} is missing from the page entirely rather than shown as unreached`
    );

  if (unreached.length > 0) assert.match(html, /not reached/);
});

test("the page refuses to compress the ladder into a score", () => {
  // A number would lose the only actionable part, which is which rung. This is
  // the site's own stated reason and it is asserted so that a later "visibility
  // score" cannot be added quietly beside it.
  const html = discovery("asd-test-marker", "2026-07-28T11:00:00.000Z");
  assert.doesNotMatch(html, /visibility score of|score: ?\d|\bscore\b ?[:=] ?\d/i);
  assert.match(html, /which rung/i);
});

test("the version is stamped", () => {
  assert.match(DISCOVERY_VERSION, /^dsc-\d+$/);
});
