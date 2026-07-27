import test from "node:test";
import assert from "node:assert/strict";

import { AGENT_OWNER } from "../../public-site/vendors/sources.js";
import { ARTICLES } from "../../public-site/constitution.js";

// Article IX exists because six findings were published here with a company as
// the subject of the headline — "ClaudeBot has been observed on this site" — and
// every one of those requests came from a single address wearing ten companies'
// identities while hunting credential files. The counts were right. The subject
// was wrong, and that alone made each finding false.
//
// The integrity check that enforces it reads the live database, so it cannot be
// made to fail from a test without writing to the record. What is tested here is
// the predicate underneath it, against the exact titles that were withdrawn.

/** The predicate used by integrity.js — a title opening with a crawler's name. */
function namesClientAsSubject(title) {
  return Object.keys(AGENT_OWNER).some((agent) =>
    new RegExp(`^${agent}\\b`, "i").test(title.trim())
  );
}

test("the predicate rejects every headline withdrawn on 27 July 2026", () => {
  const withdrawn = [
    "ClaudeBot has been observed on this site",
    "CCBot has been observed on this site",
    "GPTBot has been observed on this site",
    "OAI-SearchBot has been observed on this site",
    "ChatGPT-User has been observed on this site",
    "PerplexityBot has been observed on this site"
  ];

  for (const title of withdrawn) {
    assert.equal(
      namesClientAsSubject(title),
      true,
      `"${title}" makes a named client the subject and must be caught`
    );
  }
});

test("it permits a headline where we are the subject and the agent is named", () => {
  // Rewritten into this shape before Article IX existed, for the same reason it
  // now exists: an earlier version read "<agent> fetched this site inside a
  // trial we ran", and machine translation dropped our part of the sentence.
  assert.equal(
    namesClientAsSubject("We asked Claude-User to read this page, and it did"),
    false
  );
});

test("it permits the behaviour-first headlines currently published", () => {
  const published = [
    "One address presented crawler identities belonging to 10 different companies",
    "One user agent, 18 addresses, 14 paths — a retrieval spread thin enough to look like nothing",
    "One address requested 87 distinct paths within 6 seconds",
    "Machines are fetching this site through a second hostname of ours that we never published",
    "A new domain with no inbound links received its first automated probe in under two minutes",
    "An assistant given a direct URL substituted a search, and reported a competitor instead",
    "Anatomy of a user-triggered fetch: one page, no robots.txt, no JavaScript"
  ];

  for (const title of published) {
    assert.equal(
      namesClientAsSubject(title),
      false,
      `"${title}" describes what was done and must pass`
    );
  }
});

test("Article IX is stated on the page, not only enforced in code", () => {
  // A check with no published article is a secret rule; an article with no check
  // is an intention. This asserts the first half.
  const ix = ARTICLES.find((a) => a.id === "IX");
  assert.ok(ix, "Article IX must exist in the constitution");
  assert.equal(ix.slug, "the-subject-is-the-behaviour");
  assert.match(ix.body, /ClaudeBot/, "the article names the findings that caused it");
  assert.match(ix.body, /Article VII|observation-is-not-surveillance/, "it must tie to the surveillance rule");
});
