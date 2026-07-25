import { randomUUID } from "node:crypto";
import { notOperator } from "../stats.js";
import db, { SITE_ID } from "../realityDb.js";

// Controlled trials.
//
// The observatory is otherwise passive: it waits for clients to arrive. But one
// side of this is under our control — we can ask an assistant to read a page and
// then watch what the server actually receives. That converts an open-ended wait
// into an experiment that can be run this afternoon and repeated tomorrow.
//
// A trial is an ACTION: it records what we did and when. Everything that
// arrives afterwards stays in the reality layer, and linking the two is an
// inference computed here at read time. A request inside the window may have
// nothing to do with the trial, and this module never pretends otherwise.

export const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

const insertTrial = db.prepare(`
  INSERT INTO Trial (id, siteId, vendor, prompt, targetPath, startedAt, startedAtMs, windowMs, reply, note)
  VALUES (@id, @siteId, @vendor, @prompt, @targetPath, @startedAt, @startedAtMs, @windowMs, @reply, @note)
`);

export function startTrial({ vendor, prompt, targetPath, windowMs = DEFAULT_WINDOW_MS, note = null }) {
  const at = new Date();
  const id = randomUUID();
  insertTrial.run({
    id,
    siteId: SITE_ID,
    vendor,
    prompt,
    targetPath,
    startedAt: at.toISOString(),
    startedAtMs: at.getTime(),
    windowMs,
    reply: null,
    note
  });
  return { id, startedAt: at.toISOString() };
}

export function recordReply(id, reply) {
  return db.prepare("UPDATE Trial SET reply = ? WHERE id = ?").run(reply, id).changes > 0;
}

const listTrials = db.prepare(
  "SELECT * FROM Trial WHERE siteId = ? ORDER BY startedAtMs DESC"
);

export function trials() {
  return listTrials.all(SITE_ID);
}

export function trial(id) {
  return db.prepare("SELECT * FROM Trial WHERE id = ?").get(id);
}

// Requests inside a trial's window that came over the internet and not from an
// address this operator has driven from a command line.
const OPERATOR_EXCLUDE = `cfConnectingIp IS NOT NULL AND ${notOperator()}`;

const windowRequests = db.prepare(`
  SELECT id, observedAt, observedAtMs, method, path, responseStatus,
         userAgent, cfConnectingIp, cfIpCountry
  FROM RequestReality
  WHERE siteId = ? AND cfRay IS NOT NULL
    AND observedAtMs >= ? AND observedAtMs <= ?
    AND ${OPERATOR_EXCLUDE}
  ORDER BY observedAtMs
`);

/**
 * What arrived during a trial's window, and what that traffic did.
 *
 * Every field here is derived, not stored. `attributed` means "arrived inside
 * the window", which is correlation and not causation — an unrelated crawler
 * passing through would land in the same bucket, and the count of distinct
 * addresses is reported so that possibility stays visible.
 */
export function outcome(id) {
  const t = trial(id);
  if (!t) return null;

  const rows = windowRequests.all(
    SITE_ID,
    t.startedAtMs,
    t.startedAtMs + t.windowMs
  );

  const target = rows.filter((r) => r.path === t.targetPath);
  const robots = rows.filter((r) => r.path === "/robots.txt");
  const jsBeacon = rows.filter((r) => r.path === "/beacon.js");

  const firstTarget = target[0] ?? null;
  const firstAny = rows[0] ?? null;

  return {
    trial: t,
    requests: rows,
    distinctAddresses: new Set(rows.map((r) => r.cfConnectingIp)).size,
    fetchedTarget: target.length > 0,
    targetFetches: target.length,
    readRobotsFirst:
      robots.length > 0 &&
      firstTarget !== null &&
      robots[0].observedAtMs < firstTarget.observedAtMs,
    requestedRobots: robots.length > 0,
    executedJs: jsBeacon.length > 0,
    pathsTaken: new Set(rows.map((r) => r.path)).size,
    latencyMs: firstAny ? firstAny.observedAtMs - t.startedAtMs : null,
    declaredAgents: [...new Set(rows.map((r) => r.userAgent).filter(Boolean))],
    countries: [...new Set(rows.map((r) => r.cfIpCountry).filter(Boolean))]
  };
}

/** One row per trial: the cross-vendor comparison this exists to produce. */
export function comparison() {
  return trials()
    .map((t) => outcome(t.id))
    .filter(Boolean);
}
