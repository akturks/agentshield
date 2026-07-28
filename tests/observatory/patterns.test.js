import test from "node:test";
import assert from "node:assert/strict";

import {
  sessionise,
  agentOf,
  habits,
  VISIT_GAP_MS,
  MIN_VISITS,
  MIN_DAYS
} from "../../public-site/patterns.js";

// A habit is repetition across visits. Everything here defends that sentence
// against the two ways it goes wrong on this record: counting requests instead
// of visits, and attributing a visit to whoever the user agent claimed to be.

const req = (ua, ip, path, minutes) => ({
  userAgent: ua,
  ip,
  path,
  observedAt: new Date(Date.UTC(2026, 6, 26, 0, minutes)).toISOString(),
  observedAtMs: Date.UTC(2026, 6, 26, 0, minutes)
});

test("a pause longer than the gap starts a new visit", () => {
  const rows = [
    req("GPTBot/1.2", "1.1.1.1", "/a", 0),
    req("GPTBot/1.2", "1.1.1.1", "/b", 5),
    req("GPTBot/1.2", "1.1.1.1", "/c", 40)
  ];

  const visits = sessionise(rows);

  assert.equal(visits.length, 2);
  assert.deepEqual(visits[0].paths, ["/a", "/b"]);
  assert.deepEqual(visits[1].paths, ["/c"]);
});

test("the same identity at a different address is a different visit", () => {
  const visits = sessionise([
    req("GPTBot/1.2", "1.1.1.1", "/a", 0),
    req("GPTBot/1.2", "2.2.2.2", "/a", 1)
  ]);

  assert.equal(visits.length, 2, "one crawler on two addresses is two visits, not one");
});

test("eleven pages in one afternoon is one visit, not eleven observations of a habit", () => {
  // The conflation this file exists to prevent, and it always flatters: a single
  // busy crawl becomes "this crawler reads eleven pages", stated as behaviour.
  const rows = Array.from({ length: 11 }, (_, i) => req("GPTBot/1.2", "1.1.1.1", `/p${i}`, i));
  const visits = sessionise(rows);

  assert.equal(visits.length, 1);
  assert.equal(visits[0].paths.length, 11);
});

test("the gap is a declared number, not a discovered one", () => {
  assert.equal(VISIT_GAP_MS, 30 * 60 * 1000);
  assert.equal(MIN_VISITS, 3);
  assert.equal(MIN_DAYS, 3);
});

test("the declared crawler name is read out of the user agent string", () => {
  assert.equal(agentOf("Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"), "GPTBot");
  assert.equal(agentOf("CCBot/2.0 (https://commoncrawl.org/faq/)"), "CCBot");
  assert.equal(agentOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), null);
});

test("no habit is described below the declared minimum", () => {
  // The threshold has to bite on the live record, not only in principle. An
  // agent seen twice must come back as not describable, with the requirement
  // printed rather than left for the reader to work out.
  for (const h of habits()) {
    if (h.describable) {
      assert.ok(h.corroboratedVisits >= MIN_VISITS, `${h.agent} described from ${h.corroboratedVisits} visits`);
      assert.ok(h.days >= MIN_DAYS, `${h.agent} described from ${h.days} days`);
      assert.equal(h.needs, null);
    } else {
      assert.notEqual(h.needs, null, `${h.agent} is not describable and does not say what it needs`);
    }
  }
});

test("the minute that sent 90 requests under 13 identities contributes no habit", () => {
  // 26 July, 22:09, one address, 13 crawler identities. Sessionised without a
  // corroboration filter it donates a visit to OAI-SearchBot, to GPTBot and to
  // ChatGPT-User, and the impostor's itinerary is published as their habit.
  //
  // Checked from the other end: every agent it impersonated must show at least
  // one visit it was not credited for.
  const impersonated = ["OAI-SearchBot", "GPTBot", "ChatGPT-User"];
  const rows = habits();

  for (const agent of impersonated) {
    const h = rows.find((r) => r.agent === agent);
    if (!h) continue;
    assert.ok(
      h.uncorroboratedVisits >= 1,
      `${agent} counts every visit as its own, including one from an address its vendor does not publish`
    );
    assert.ok(
      h.corroboratedVisits < h.totalVisits,
      `${agent} attributes all ${h.totalVisits} visits to itself`
    );
  }
});

test("a vendor that publishes no list yields counts and no habits", () => {
  // Anthropic and Common Crawl publish nothing machine-readable, so nothing can
  // be attributed to their crawlers here. That is a limit on what is knowable,
  // and a weaker test invented to fill it would be inventing the knowledge.
  for (const agent of ["ClaudeBot", "Claude-User", "CCBot"]) {
    const h = habits().find((r) => r.agent === agent);
    if (!h) continue;
    assert.equal(h.corroboratedVisits, 0, `${agent} was corroborated against a list that does not exist`);
    assert.equal(h.describable, false);
    assert.ok(h.totalVisits > 0, "the visits are still counted, they are simply not attributed");
  }
});

test("a described habit reports the visits it rests on, not a bare percentage", () => {
  for (const h of habits().filter((r) => r.describable)) {
    assert.ok(h.corroboratedVisits > 0);
    assert.ok(h.addresses > 0, `${h.agent} rests on no distinct address`);
    for (const t of h.soleTargets)
      assert.ok(
        t.visits > 0 && t.share !== null,
        `${h.agent} states a share for ${t.path} without the count under it`
      );
  }
});
