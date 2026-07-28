import test from "node:test";
import assert from "node:assert/strict";

import { injectedAgainst } from "../../public-site/self/changes.js";

// Detecting an insertion into a page that rewrites itself.
//
// Byte equality is unusable on these surfaces. `/lab` differs from its own
// previous response every time and `/` differs whenever a request arrived in
// between, so an equality test reports this site's own counters as an
// intervention, permanently, from the first sweep — and a detector in that state
// is worse than none, because the real event arrives looking like the noise.
//
// The instrument is two origin responses taken either side of the edge fetch,
// plus one stated rule about what counts as the same line. Both halves are
// tested here against the two interventions this site has actually measured.

// The hidden anchor Cloudflare injected into every HTML body in July.
const LABYRINTH =
  '<a href="/cdn-cgi/content?id=b41f6d2e" aria-hidden="true" style="display:none">The Labyrinth of Knowledge</a>';

const page = (visits, extra = "") => `<html>
<body>
<h1>Live record</h1>
<p>External requests recorded so far: ${visits}</p>
<p>Distinct addresses: ${Math.floor(visits / 3)}</p>
${extra}
</body>
</html>`;

test("a counter moving between fetches is not an injection", () => {
  // Three renders, three different figures, nothing added by anyone. This is the
  // ordinary state of /lab and it must be silent.
  const r = injectedAgainst([page(971), page(973)], page(972));

  assert.deepEqual(r.added, []);
  assert.deepEqual(r.removed, []);
  assert.equal(r.originHeldStill, false, "the page did move, and that is recorded");
});

test("an element the origin never sent is found on a page that rewrites itself", () => {
  // The case the whole design exists for: the page is varying *and* something was
  // inserted. Byte equality cannot separate these; this can.
  const r = injectedAgainst([page(971), page(973)], page(972, LABYRINTH));

  assert.equal(r.added.length, 1);
  assert.match(r.added[0], /cdn-cgi\/content/);
  assert.match(r.added[0], /display:none/);
});

test("a line the origin always sends and the edge drops is reported", () => {
  const withNotice = (v) => page(v, "<p>Every client receives identical bytes.</p>");
  const r = injectedAgainst([withNotice(971), withNotice(973)], page(972));

  assert.equal(r.added.length, 0);
  assert.deepEqual(r.removed, ["<p>Every client receives identical bytes.</p>"]);
});

test("the nine injected user-agent groups survive the numeral rule", () => {
  // The other measured intervention. Reading a line's digits as interchangeable
  // must not make crawler rules invisible.
  const origin = "User-agent: GPTBot\nAllow: /\n";
  const edge =
    "# BEGIN Cloudflare Managed content\nUser-agent: GPTBot\nDisallow: /\nUser-agent: CCBot\nDisallow: /\n# END Cloudflare Managed Content\n" +
    origin;

  const r = injectedAgainst([origin, origin], edge);

  assert.ok(r.added.includes("Disallow: /"), "the refusal is visible");
  assert.ok(r.added.some((l) => /BEGIN Cloudflare/.test(l)), "and so is the marker");
  assert.equal(r.originHeldStill, true);
});

test("an identical line inserted many times is reported once", () => {
  const origin = "User-agent: *\nAllow: /";
  const edge = ["A", "B", "C"].map((a) => `User-agent: ${a}\nDisallow: /`).join("\n") + "\n" + origin;

  const r = injectedAgainst([origin, origin], edge);

  assert.equal(
    r.added.filter((l) => l === "Disallow: /").length,
    1,
    "one insertion, not three changes"
  );
});

test("the stated cost of the numeral rule is real and is this", () => {
  // Disclosed rather than discovered later: an insertion differing from existing
  // text only in digits is not seen. Nothing this site has measured looks like
  // that, and the test exists so the limit is written down as behaviour instead
  // of as a promise in a comment.
  const r = injectedAgainst([page(971), page(973)], page(972) + "\n<p>Distinct addresses: 4242</p>");

  assert.deepEqual(r.added, [], "shares a shape with a line the origin sends");
});

test("a page that held still says so, and one that did not says that", () => {
  assert.equal(injectedAgainst([page(10), page(10)], page(10)).originHeldStill, true);
  assert.equal(injectedAgainst([page(10), page(11)], page(10)).originHeldStill, false);
  assert.equal(injectedAgainst([page(10)], page(10)).originHeldStill, false, "one sample brackets nothing");
});
