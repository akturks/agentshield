import test from "node:test";
import assert from "node:assert/strict";

import { render } from "../../public-site/findings/templates.js";

// A finding reached review reading "arrived from 11 distinct addresses in 1
// countries over 20 hours". The count was right and the sentence was wrong, and
// a summary is the part that gets quoted, indexed and translated — so a broken
// plural there travels further than one in a table.
//
// This is the third defect found in this file, and all three shared a shape:
// a branch that renders correctly for the values it happened to be built with
// and wrongly for values the record had not produced yet. Article IX has its
// own test for the same reason. This one covers the counting.
//
// `countries` is why appending "s" was not the fix.

const base = {
  detectorId: "distributed_crawl",
  windowStartMs: Date.UTC(2026, 6, 27, 14),
  windowEndMs: Date.UTC(2026, 6, 28, 10),
  claims: [{ expected: 11 }],
  facts: {
    ua: "Mozilla/5.0 (compatible; Examplebot/1.0)",
    ips: 11,
    paths: 11,
    singles: 11,
    countries: 1,
    hours: 20,
    hits: 11
  }
};

const at = (over) => render({ ...base, facts: { ...base.facts, ...over } });

test("a single-country spread does not read '1 countries'", () => {
  const out = at({ countries: 1 });
  assert.match(out.summary, /in 1 country over/);
  assert.doesNotMatch(out.summary, /1 countries/);
});

test("plural counts keep their plural", () => {
  const out = at({ countries: 6, hours: 20, ips: 11, paths: 9 });
  assert.match(out.summary, /from 11 distinct addresses/);
  assert.match(out.summary, /in 6 countries/);
  assert.match(out.summary, /over 20 hours/);
  assert.match(out.summary, /fetched 9 distinct paths/);
});

test("no rendered sentence pairs the number one with a plural noun", () => {
  // Every count in this template driven to 1 at once, which is not a spread the
  // detector would report but is exactly the combination no author tries.
  //
  // The plurals are listed rather than matched by suffix. A pattern for "1 <word
  // ending in s>" flags "1 address", which is correct English — the first draft
  // of this test failed on the code being right.
  const PLURALS = ["addresses", "paths", "countries", "hours", "requests", "fetches"];
  const singular = at({ ips: 1, paths: 1, singles: 1, countries: 1, hours: 1, hits: 1 });

  for (const [where, text] of [
    ["title", singular.title],
    ["summary", singular.summary]
  ])
    for (const plural of PLURALS)
      assert.ok(
        !new RegExp(`\\b1 (?:distinct )?${plural}\\b`).test(text),
        `${where}: "${text}" pairs 1 with "${plural}"`
      );
});

test("the title counts addresses and paths in agreement with itself", () => {
  assert.match(at({ ips: 1, paths: 1 }).title, /One user agent, 1 address, 1 path/);
  assert.match(at({ ips: 11, paths: 9 }).title, /One user agent, 11 addresses, 9 paths/);
});
