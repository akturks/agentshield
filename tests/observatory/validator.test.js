import test from "node:test";
import assert from "node:assert/strict";

import { etagFor, clientHolds } from "../../public-site/validator.js";

// The site sent no ETag, no Last-Modified and no Cache-Control for its first two
// days. One request in 582 carried a conditional header, and it came from a client
// that had invented an If-Modified-Since from its own previous fetch — which the
// server then ignored and answered 200.
//
// That number was very nearly published as "AI crawlers do not use conditional
// requests". It was a measurement of our own response headers. These tests cover
// the code that makes the question askable at all.

test("the tag is derived from the bytes and nothing else", () => {
  assert.equal(etagFor("hello"), etagFor("hello"), "same body, same tag");
  assert.notEqual(etagFor("hello"), etagFor("hello "), "one byte changes it");
});

test("a page that moves gets a new tag, which is the point", () => {
  // /lab recomputes its counters on every request. Its tag changing every time is
  // correct: it means nothing can be concluded about caching from that page,
  // rather than a stable tag falsely implying the page stood still.
  const before = etagFor("External requests: 566");
  const after = etagFor("External requests: 567");
  assert.notEqual(before, after);
});

test("the tag is weak and quoted, as the header requires", () => {
  const tag = etagFor("body");
  assert.match(tag, /^W\/"[A-Za-z0-9_-]{27}"$/);
});

test("a weak tag matches itself, weak prefix and all", () => {
  // clientHolds strips W/ before comparing, so a client echoing exactly what it
  // was given must match. This broke once already in the making: the tag became
  // weak and the comparison still expected a strong one.
  const tag = etagFor("body");
  assert.equal(clientHolds(tag, tag), true);
});

test("a client offering the same tag is recognised", () => {
  const tag = etagFor("body");
  assert.equal(clientHolds(tag, tag), true);
});

test("the list form is honoured, because the header is defined as a list", () => {
  const tag = etagFor("body");
  assert.equal(clientHolds(`"other", ${tag}, "another"`, tag), true);
  assert.equal(clientHolds(`"other", "another"`, tag), false);
});

test("the weak prefix is ignored on whichever side carries it", () => {
  const weak = etagFor("body");
  const strong = weak.replace(/^W\//, "");

  // Our tags are weak now, but an intermediary or a client may hand either form
  // back. Comparison is on the value, never on the prefix.
  assert.equal(clientHolds(strong, weak), true, "strong offered against our weak");
  assert.equal(clientHolds(weak, strong), true, "weak offered against a strong one");
  assert.equal(clientHolds(weak, weak), true, "both weak");
});

test("* matches anything, and nonsense matches nothing", () => {
  const tag = etagFor("body");
  assert.equal(clientHolds("*", tag), true);
  for (const bad of ["", null, undefined, "garbage", '"'])
    assert.equal(clientHolds(bad, tag), false, `${bad} must not match`);
});

test("a stale tag never matches, so a stale body is never served", () => {
  assert.equal(clientHolds(etagFor("old body"), etagFor("new body")), false);
});
