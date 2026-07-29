import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Article IX on a surface the Article IX check does not reach.
//
// `integrity.js` reads published finding titles from the database. The verify
// page is neither: its sentences are assembled in browser code from a template,
// so nothing in the suite had ever looked at them. On 29 July a card read
//
//   Observed. Amazonbot has been recorded here 27 times from 27 addresses.
//
// The counts were right. The sentence was the one that withdrew six findings on
// 27 July, printed underneath a card whose entire lesson is that a user agent is
// a claim rather than an identity — and Amazon publishes no address list, so
// every one of those 27 is unverifiable and the company cannot be the subject of
// any of it.
//
// This scans source rather than rendered output, because the agent name is a
// runtime value and never appears literally in the HTML. That makes it a test of
// the templates, not of every possible sentence. It catches the two shapes that
// actually failed, which is what it is for.

const SOURCE = readFileSync(new URL("../../public-site/pages/verify.js", import.meta.url), "utf8");

test("no template makes the declared agent the subject of a verb", () => {
  // `c.agent + " has …"`, `c.agent + " was …"`, `c.agent + " fetched …"` — an
  // agent name concatenated straight onto a verb phrase.
  const asSubject = /\bc\.agent\s*\+\s*"\s+(has|have|was|were|did|fetched|requested|read|visited|crawled|ignored|obeyed)\b/;

  assert.doesNotMatch(
    SOURCE,
    asSubject,
    "a card sentence starts with the agent and continues with what it did"
  );
});

test("no template labels a company with a colon", () => {
  // `esc(c.agent) + ": no published list"` — a name, a colon, a verdict.
  assert.doesNotMatch(
    SOURCE,
    /(?:esc\()?c\.agent\)?\s*\+\s*"\s*:/,
    "a card labels the agent rather than describing a check"
  );
});

test("the sentences that replaced them are still there", () => {
  // If these disappear the tests above start passing for the wrong reason.
  assert.match(
    SOURCE,
    /Requests declaring this agent have been recorded here/,
    "the observed-provenance sentence should make requests the subject"
  );
  assert.match(
    SOURCE,
    /No published list was found for this agent/,
    "the missing-list sentence should make the check the subject"
  );
});

test("naming a vendor to describe its own published act is still allowed", () => {
  // The line to hold is between conduct and publication. "Google publishes 1054
  // prefixes" is a fact about something Google did on purpose and is checkable;
  // it is not an inference from a string the client chose. Removing it would
  // make the corroborated card unanswerable.
  assert.match(
    SOURCE,
    /c\.vendor \+ " publishes/,
    "a card must still be able to say which vendor published the list it shows"
  );
});
