import test from "node:test";
import assert from "node:assert/strict";

import { surfaceTransition, DETECTORS } from "../../public-site/findings/detectors.js";
import { render } from "../../public-site/findings/templates.js";

// The detector that has to stay silent.
//
// This site's own sitemap rewrites one `<lastmod>` line at midnight UTC. Both
// vantages carry it, so both change together — and a detector that reports
// change rather than disagreement would announce our own edit every single day
// and be ignored by the end of the week. These tests are mostly about the cases
// where nothing should be produced, because that is where a change detector
// fails: not by missing an event, but by crying often enough that a real one
// reads like the others.

const sweep = (atMs, { agrees, originBytes = 1468, edgeBytes = 1468 }) => ({
  runId: `r${atMs}`,
  path: "/robots.txt",
  atMs,
  agrees,
  originBytes,
  edgeBytes
});

test("both vantages changing together is not a transition", () => {
  // The midnight sitemap bump. Origin and edge both serve the new line, they go
  // on agreeing, and nothing is reported.
  const series = [
    sweep(1, { agrees: true }),
    sweep(2, { agrees: true }),
    sweep(3, { agrees: true })
  ];

  assert.equal(surfaceTransition(series), null);
});

test("agreement turning into disagreement is the event", () => {
  const series = [
    sweep(1, { agrees: true }),
    sweep(2, { agrees: true }),
    sweep(3, { agrees: false, originBytes: 1468, edgeBytes: 3304 })
  ];

  const t = surfaceTransition(series);

  assert.notEqual(t, null);
  assert.equal(t.from.atMs, 2, "the last sweep where they still matched");
  assert.equal(t.to.atMs, 3, "the first where they did not");
  assert.equal(t.to.edgeBytes - t.to.originBytes, 1836);
});

test("a disagreement present from the first sweep is not dated to the sensor", () => {
  // The instrument was installed at 07:57. If the CDN had already been rewriting
  // the file for a month, reporting "changed at 07:57" would publish the moment
  // this site started looking as the moment the world changed. There is no
  // transition in the record, so there is no finding.
  const series = [
    sweep(1, { agrees: false }),
    sweep(2, { agrees: false }),
    sweep(3, { agrees: false })
  ];

  assert.equal(surfaceTransition(series), null);
});

test("the most recent transition wins, so a resolved episode does not resurface", () => {
  const series = [
    sweep(1, { agrees: true }),
    sweep(2, { agrees: false }),
    sweep(3, { agrees: false }),
    sweep(4, { agrees: true })
  ];

  const t = surfaceTransition(series);

  assert.equal(t.to.atMs, 4);
  assert.equal(t.to.agrees, true, "the live state is agreement, and that is what is reported");
});

test("one sweep is not a comparison", () => {
  assert.equal(surfaceTransition([sweep(1, { agrees: true })]), null);
  assert.equal(surfaceTransition([]), null);
});

test("the detector is registered and always requires review", () => {
  // A statement that a network is altering what this site publishes costs more
  // when wrong than when late. The candidate must never publish itself.
  assert.ok(
    DETECTORS.some((d) => d.name === "surfaceDivergence"),
    "the detector has to be in the pipeline, not merely defined"
  );
});

test("the headline is about the bytes, never about a company", () => {
  // Article IX is written about crawlers, and its reason applies here with more
  // force: naming a network as the subject of a sentence about conduct is a
  // claim this record cannot support. A pair of fetched responses establishes a
  // difference and not who made it.
  const rendered = render({
    detectorId: "surface_divergence",
    windowStartMs: Date.UTC(2026, 6, 28, 7, 0),
    windowEndMs: Date.UTC(2026, 6, 28, 8, 0),
    facts: {
      path: "/robots.txt",
      diverged: true,
      sweeps: 4,
      byteDelta: 1836,
      lastAgreedAtMs: Date.UTC(2026, 6, 28, 7, 0)
    }
  });

  for (const name of ["Cloudflare", "Akamai", "Fastly"])
    assert.ok(
      !rendered.title.includes(name),
      `the headline names ${name} as the actor`
    );

  assert.match(rendered.title, /^What this site publishes/, "the subject is our own file");
  assert.match(rendered.summary, /1836 bytes more/);
  assert.match(rendered.body, /no cause is assigned here/);
});
