import test from "node:test";
import assert from "node:assert/strict";

import { classify } from "../../public-site/vendors/index.js";
import { AI_AGENT_PATTERNS } from "../../public-site/findings/detectors.js";

// The lab page invites a reader to watch a crawler figure over time, which makes
// that figure worth attacking. Anyone can send requests claiming to be GPTBot: the
// rate limit allows 240 a minute and no client is refused. So the claim the page
// makes is not "this cannot be inflated" — it is that inflation lands in a column
// the reader can see, and that the corroborated column cannot be reached at all
// without the vendor's own addresses.
//
// These tests hold that property. They are about the predicate, not the page: a
// rendering test would pass on an empty database and prove nothing.

test("a forged identity can never reach 'verified'", () => {
  // The addresses an attacker can actually send from: their own, a hosting
  // provider's, a documentation range. None is inside OpenAI's published list.
  for (const address of ["45.45.237.206", "1.2.3.4", "203.0.113.9", "88.230.173.142"])
    assert.equal(
      classify("GPTBot", address).status,
      "unlisted",
      `${address} must not corroborate a GPTBot claim`
    );
});

test("the vendor's own range is what 'verified' costs", () => {
  // Inside OpenAI's published gptbot range. Reaching this column requires sending
  // from infrastructure the attacker would have to control at the vendor.
  assert.equal(classify("GPTBot", "74.7.242.21").status, "verified");
});

test("a vendor that publishes nothing yields unverifiable, never unlisted", () => {
  // Anthropic publishes no machine-readable list. Rendering that silence as
  // 'unlisted' would print an accusation the record cannot support, against every
  // genuine ClaudeBot request there is.
  const result = classify("ClaudeBot", "160.79.104.10");
  assert.equal(result.status, "unverifiable");
  assert.ok(result.reason, "unverifiable must carry the reason it could not be checked");
});

test("every status the page tallies is one the classifier can return", () => {
  // The table has four columns. A status the page does not know would be counted
  // into a column that does not exist and silently vanish from the totals.
  const columns = new Set(["verified", "vendor_other", "unlisted", "unverifiable"]);
  const seen = new Set();

  for (const pattern of AI_AGENT_PATTERNS)
    for (const address of ["74.7.242.21", "45.45.237.206", "160.79.104.10"])
      seen.add(classify(pattern, address).status);

  for (const status of seen)
    assert.ok(columns.has(status), `${status} has no column on the lab page`);
});

test("classification needs an address, and says so rather than guessing", () => {
  // Pre-tunnel rows carry no client address. Treating a missing address as a
  // failed check would count local test traffic as evidence against a vendor.
  for (const missing of [null, undefined, ""])
    assert.equal(classify("GPTBot", missing).status, "unverifiable");
});

test("the snapshot is dated, because a live list would not reproduce", () => {
  const result = classify("GPTBot", "74.7.242.21");
  assert.match(result.at, /^\d{4}-\d{2}-\d{2}$/, "every result carries its snapshot date");
});
