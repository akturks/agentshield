import test from "node:test";
import assert from "node:assert/strict";

import { splitManaged, parseGroups, verdictFor, AI_AGENTS } from "../../public-site/survey/analyse.js";
import { POPULATION, sample } from "../../public-site/survey/population.js";

// The whole survey reduces to two questions asked of a text file: did somebody
// insert a block into it, and does that block contradict what the owner wrote.
// Both are answered by the functions below, so a mistake in them is not a bug in
// a page — it is a published percentage about other people's websites that is
// wrong in a direction nobody can see.
//
// The fixture is the block this site was actually served on 27 July 2026,
// reproduced from `docs/cdn-interventions.md` including its inconsistent
// capitalisation, which is the detail that broke the first implementation.

const INJECTED = `# BEGIN Cloudflare Managed content
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: Bytespider
Disallow: /
User-agent: Amazonbot
Disallow: /
User-agent: meta-externalagent
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: Applebot-Extended
Disallow: /
User-agent: CloudflareBrowserRenderingCrawler
Disallow: /
# END Cloudflare Managed Content
`;

const OWNER = `# We want AI crawlers here. That is the point of the site.
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: *
Disallow: /internal/
Crawl-delay: 10
`;

test("the closing marker is found despite Cloudflare's own capitalisation", () => {
  // `Managed content` opening, `Managed Content` closing. An exact-match split
  // finds the first and misses the second, and because the block is prepended,
  // everything the owner wrote ends up inside `managed` — where it is read as
  // part of the injection. Contradictions then count zero, always.
  const { managed, rest, unterminated } = splitManaged(INJECTED + OWNER);

  assert.equal(unterminated, false, "the block must be seen as closed");
  assert.ok(managed.includes("GPTBot"), "the injected block holds the agents");
  assert.ok(!rest.includes("BEGIN Cloudflare"), "no marker survives into the owner's part");
  assert.ok(rest.includes("Crawl-delay: 10"), "the owner's own rules stay outside");
  assert.ok(!managed.includes("Crawl-delay"), "and never leak into the injected part");
});

test("a file nobody injected into is entirely the owner's", () => {
  const { managed, rest } = splitManaged(OWNER);
  assert.equal(managed, null, "absence of the marker is not absence of a CDN, and is reported as null");
  assert.equal(rest, OWNER);
});

test("consecutive user-agent lines form one group", () => {
  const groups = parseGroups("User-agent: A\nUser-agent: B\nDisallow: /\n");
  assert.equal(groups.length, 1, "two names, one group");
  assert.deepEqual(groups[0].agents, ["A", "B"]);
  assert.equal(groups[0].rules.length, 1, "the rule belongs to both");
});

test("a rule after a group closes it, so the next agent starts a new one", () => {
  const groups = parseGroups("User-agent: A\nDisallow: /x\nUser-agent: B\nDisallow: /y\n");
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].agents, ["A"]);
  assert.deepEqual(groups[1].agents, ["B"]);
});

test("a wildcard group is not an answer about a named crawler", () => {
  // The question is whether somebody decided about GPTBot. `User-agent: *` is
  // the absence of that decision, and counting it as one would report a site as
  // having closed its door to an agent it never considered.
  const text = "User-agent: *\nDisallow: /\n";
  assert.equal(verdictFor(text, "GPTBot"), "unmentioned");
});

test("only a bare Disallow: / counts as blocked", () => {
  assert.equal(verdictFor("User-agent: GPTBot\nDisallow: /\n", "GPTBot"), "blocked");
  assert.equal(
    verdictFor("User-agent: GPTBot\nDisallow: /private/\n", "GPTBot"),
    "allowed",
    "a narrow disallow is a rule, not a closed door"
  );
  assert.equal(verdictFor("User-agent: GPTBot\nAllow: /\n", "GPTBot"), "allowed");
});

test("agent names match without regard to case", () => {
  assert.equal(verdictFor("user-agent: gptbot\ndisallow: /\n", "GPTBot"), "blocked");
});

test("comments are stripped before a line is read", () => {
  assert.equal(verdictFor("User-agent: GPTBot\n# Disallow: /\n", "GPTBot"), "allowed");
});

test("the injected block and the owner's file disagree, and the split shows it", () => {
  // This is the finding the survey exists to count, verified end to end on the
  // exact bytes this site was served.
  const { managed, rest } = splitManaged(INJECTED + OWNER);

  assert.equal(verdictFor(managed, "GPTBot"), "blocked", "the CDN says no");
  assert.equal(verdictFor(rest, "GPTBot"), "allowed", "the owner said yes");

  assert.equal(verdictFor(managed, "ClaudeBot"), "blocked");
  assert.equal(verdictFor(rest, "ClaudeBot"), "allowed");

  // An agent the owner never mentioned is blocked without being contradicted.
  // Both are worth counting and they are not the same thing.
  assert.equal(verdictFor(managed, "Bytespider"), "blocked");
  assert.equal(verdictFor(rest, "Bytespider"), "unmentioned");
});

test("every agent in the injected block is one the survey asks about", () => {
  // If Cloudflare adds a name to its managed block and AI_AGENTS does not carry
  // it, the survey silently stops counting that agent. Nine names are injected;
  // eight are AI crawlers and the ninth is Cloudflare's own renderer.
  const injectedNames = parseGroups(INJECTED).flatMap((g) => g.agents);
  const unknown = injectedNames.filter(
    (name) =>
      name !== "CloudflareBrowserRenderingCrawler" &&
      !AI_AGENTS.some((a) => a.toLowerCase() === name.toLowerCase())
  );

  assert.deepEqual(unknown, [], "an injected agent this survey does not ask about");
});

test("the declared sample is the rule it claims to be", () => {
  // The population file is committed, so it can drift from the sentence that
  // describes it without anything failing. Here the sentence is checked against
  // the file: ranks 1, 251, 501, … and nothing else.
  const drawn = sample();

  assert.equal(drawn.length, POPULATION.size);
  assert.equal(drawn.length, 400);

  drawn.forEach((entry, i) => {
    assert.equal(entry.rank, 1 + i * 250, `rank at index ${i}`);
    assert.match(entry.domain, /^[a-z0-9.-]+$/i, `${entry.domain} is a bare domain`);
  });

  assert.equal(new Set(drawn.map((d) => d.domain)).size, drawn.length, "no domain twice");
});

test("the sample is a copy, so a caller cannot edit the declared population", () => {
  const first = sample();
  first[0].domain = "example.invalid";
  assert.notEqual(sample()[0].domain, "example.invalid");
});
