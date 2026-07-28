import db from "../realityDb.js";

// The questions asked of the snapshots. Nothing here writes.
//
// The record holds hashes at instants. "It changed" is a sentence about two of
// them, and it belongs here rather than in a column, so that a better comparison
// — ignoring a timestamp inside a file, say — can be written next month and
// applied to everything already observed.
//
// The version moves when an answer would change.
export const ANALYSIS_VERSION = "self-sa-1";

const observations = db.prepare(`
  SELECT id, runId, path, vantage, observedAt, observedAtMs, httpStatus,
         bodyBytes, bodySha256, errorCode
  FROM SelfObservation
  WHERE path = ? AND vantage = ?
  ORDER BY observedAtMs
`);

const watchedPaths = db.prepare(
  `SELECT DISTINCT path FROM SelfObservation ORDER BY path`
);

/** Every path the sensor has ever recorded. */
export function paths() {
  return watchedPaths.all().map((r) => r.path);
}

/**
 * Consecutive observations of one path from one vantage whose bytes differ.
 *
 * A failed observation ends a comparison rather than counting as a change: "the
 * edge did not answer" and "the edge answered with something new" are different
 * events, and folding them together would report an outage as an edit.
 */
export function changesIn(rows, { path, vantage } = {}) {
  const out = [];

  for (let i = 1; i < rows.length; i += 1) {
    const before = rows[i - 1];
    const after = rows[i];
    if (before.errorCode || after.errorCode) continue;
    if (before.bodySha256 === after.bodySha256) continue;

    out.push({
      path,
      vantage,
      from: { at: before.observedAt, sha256: before.bodySha256, bytes: before.bodyBytes },
      to: { at: after.observedAt, sha256: after.bodySha256, bytes: after.bodyBytes }
    });
  }

  return out;
}

export function changes(path, vantage) {
  return changesIn(observations.all(path, vantage), { path, vantage });
}

/**
 * How often this path's bytes differ between consecutive observations.
 *
 * This is how the site learns that a page is regenerated per request, instead of
 * being told. A hardcoded list of "dynamic" URLs is a claim nobody checks, and it
 * goes stale the first time a page becomes static — whereas a path that has
 * changed on every single sweep is describing itself.
 *
 * `comparisons` is the honest denominator: with one observation there is nothing
 * to compare and the rate is null, not zero.
 */
export function volatilityIn(all, { path, vantage } = {}) {
  const rows = all.filter((r) => !r.errorCode);
  const comparisons = Math.max(rows.length - 1, 0);
  if (comparisons === 0) return { path, vantage, comparisons: 0, changed: 0, rate: null };

  let changed = 0;
  for (let i = 1; i < rows.length; i += 1)
    if (rows[i - 1].bodySha256 !== rows[i].bodySha256) changed += 1;

  return {
    path,
    vantage,
    comparisons,
    changed,
    rate: Math.round((changed / comparisons) * 1000) / 10
  };
}

export function volatility(path, vantage) {
  return volatilityIn(observations.all(path, vantage), { path, vantage });
}

const byRun = db.prepare(`
  SELECT vantage, observedAt, observedAtMs, httpStatus, bodyBytes, bodySha256, errorCode
  FROM SelfObservation
  WHERE runId = ? AND path = ?
`);

const runsFor = db.prepare(`
  SELECT DISTINCT runId, MIN(observedAtMs) AS atMs
  FROM SelfObservation WHERE path = ?
  GROUP BY runId ORDER BY atMs
`);

/**
 * Whether the two vantages saw the same bytes, per sweep.
 *
 * Paired by `runId` rather than by nearest timestamp. Time-matching would answer
 * even when one vantage is missing, by reaching for a neighbour minutes away —
 * and a difference measured across a gap cannot separate a CDN from an edit that
 * happened in between. A sweep missing a side yields `comparable: false`, which
 * is a smaller answer and a true one.
 */
export function divergenceIn(runs) {
  return runs.map((run) => {
    const rows = run.rows;
    const origin = rows.find((r) => r.vantage === "origin");
    const edge = rows.find((r) => r.vantage === "edge");

    const comparable = Boolean(origin && edge && !origin.errorCode && !edge.errorCode);

    return {
      runId: run.runId,
      at: new Date(run.atMs).toISOString(),
      comparable,
      identical: comparable ? origin.bodySha256 === edge.bodySha256 : null,
      origin: origin
        ? { status: origin.httpStatus, bytes: origin.bodyBytes, sha256: origin.bodySha256, errorCode: origin.errorCode }
        : null,
      edge: edge
        ? { status: edge.httpStatus, bytes: edge.bodyBytes, sha256: edge.bodySha256, errorCode: edge.errorCode }
        : null,
      // Positive when the edge delivered more than the origin sent. The sign is
      // the interesting part: the injected robots.txt was 3,304 bytes over an
      // origin of 1,468.
      byteDelta: comparable ? edge.bodyBytes - origin.bodyBytes : null
    };
  });
}

export function divergence(path) {
  return divergenceIn(
    runsFor.all(path).map((run) => ({
      runId: run.runId,
      atMs: run.atMs,
      rows: byRun.all(run.runId, path)
    }))
  );
}

/** One path, everything the record can say about it. */
export function summarise(path) {
  const runs = divergence(path);
  const comparable = runs.filter((r) => r.comparable);
  const diverged = comparable.filter((r) => !r.identical);

  return {
    analysisVersion: ANALYSIS_VERSION,
    path,
    sweeps: runs.length,
    comparableSweeps: comparable.length,
    divergedSweeps: diverged.length,
    firstDivergence: diverged[0] ?? null,
    latestDivergence: diverged[diverged.length - 1] ?? null,
    originChanges: changes(path, "origin"),
    edgeChanges: changes(path, "edge"),
    originVolatility: volatility(path, "origin"),
    edgeVolatility: volatility(path, "edge"),
    firstObserved: runs[0]?.at ?? null,
    latestObserved: runs[runs.length - 1]?.at ?? null
  };
}
