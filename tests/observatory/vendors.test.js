import test from "node:test";
import assert from "node:assert/strict";

import { inPrefix, classify, SNAPSHOT_DATE } from "../../public-site/vendors/index.js";

// This module is the only thing on the site that can call a visitor's declared
// identity unsupported. A prefix matcher that is loose by one bit turns that
// into an accusation against whoever holds the neighbouring address, so the
// boundaries are tested from both sides rather than only from inside.

test("IPv4 prefixes match on masked bits, not on text", () => {
  assert.equal(inPrefix("74.7.242.21", "74.7.242.0/25"), true, "inside the /25");
  assert.equal(inPrefix("74.7.242.127", "74.7.242.0/25"), true, "last address of the /25");
  assert.equal(inPrefix("74.7.242.128", "74.7.242.0/25"), false, "first address past it");
  assert.equal(inPrefix("74.7.243.21", "74.7.242.0/25"), false, "next /24 over");

  // The failure a textual prefix match would make: "74.7.24" is a prefix of
  // "74.7.240.1" as a string, and nothing to do with it as a network.
  assert.equal(inPrefix("74.7.240.1", "74.7.24.0/24"), false);
});

test("IPv6 prefixes expand :: correctly before comparing", () => {
  assert.equal(inPrefix("2a00:1d34:4896:b600::1", "2a00:1d34:4896:b600::/64"), true);
  assert.equal(inPrefix("2a00:1d34:4896:b601::1", "2a00:1d34:4896:b600::/64"), false);
  assert.equal(
    inPrefix("2a00:1d34:4896:b600:b997:78fb:eb0d:b131", "2a00:1d34:4896:b600::/64"),
    true,
    "a fully written address inside a /64 written with ::"
  );
  assert.equal(inPrefix("::1", "::/0"), true, "a /0 matches everything");
});

test("garbage never matches", () => {
  for (const bad of ["", "not-an-ip", "999.1.1.1", "1.2.3", null, undefined, "1.2.3.4.5"]) {
    assert.equal(inPrefix(bad, "1.2.3.0/24"), false, `${bad} must not match`);
  }
  assert.equal(inPrefix("1.2.3.4", "1.2.3.0/33"), false, "an impossible mask width");
  assert.equal(inPrefix("1.2.3.4", "garbage"), false);
});

test("the real GPTBot arrival verifies against OpenAI's published list", () => {
  const result = classify("GPTBot", "74.7.242.21");
  assert.equal(result.status, "verified");
  assert.equal(result.vendor, "OpenAI");
  assert.equal(result.at, SNAPSHOT_DATE, "every result carries the snapshot it was checked against");
});

test("an address outside every list of that vendor is unlisted, not verified", () => {
  const result = classify("GPTBot", "203.0.113.7");
  assert.equal(result.status, "unlisted");
  assert.equal(result.vendor, "OpenAI");
});

test("the operator's own address does not verify as a crawler", () => {
  // The spoofed GPTBot rows in this record came from here. If this ever returns
  // "verified", the check has stopped checking anything.
  const result = classify("GPTBot", "2a00:1d34:4896:b600:b997:78fb:eb0d:b131");
  assert.equal(result.status, "unlisted");
});

test("a vendor that publishes nothing yields unverifiable, never unlisted", () => {
  const result = classify("ClaudeBot", "34.162.230.222");
  assert.equal(
    result.status,
    "unverifiable",
    "a gap in the vendor's publishing must never read as evidence against a client"
  );
  assert.match(result.reason, /Anthropic/);
});

test("a missing address is unverifiable rather than unlisted", () => {
  assert.equal(classify("GPTBot", null).status, "unverifiable");
});
