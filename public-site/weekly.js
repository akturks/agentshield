import db from "./realityDb.js";
import { EXTERNAL } from "./stats.js";
import { declaredIdentities } from "./identities.js";
import { SNAPSHOT_DATE } from "./vendors/index.js";

// A weekly report computed from the record, not written about it.
//
// The distinction matters and it is the whole reason this exists. A newsletter is
// a promise with a due date: miss a week and the page says so. A report is a
// query — the record fills up on its own whether anybody is watching, and the
// week's figures exist the moment the week ends.
//
// So nothing here is authored. Every sentence below is assembled from counts that
// can be recomputed, and the page is willing to say that a week was quiet. That
// willingness is the point: a weekly bulletin that manufactures significance out
// of forty requests would break Article VI on a schedule, once a week, forever.
//
// Weeks are ISO-8601 and run Monday 00:00:00 UTC to Sunday 23:59:59.999 UTC. UTC
// because the record is stored in it and a local week boundary would put the same
// request in different weeks for different readers.

const DAY = 86400000;
const WEEK = 7 * DAY;

/** Midnight UTC on the Monday of the ISO week containing `ms`. */
export function weekStart(ms) {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY;
}

/**
 * ISO week label, `YYYY-Www`.
 *
 * The year is the ISO week-numbering year, which is not always the calendar year
 * of the Monday: 29 December 2025 falls in 2026-W01. Deriving it from the Thursday
 * of the same week is the standard trick and the only one that gets the boundary
 * right in both directions.
 */
export function weekLabel(ms) {
  const monday = weekStart(ms);
  const thursday = new Date(monday + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const firstThursday = (() => {
    const jan4 = Date.UTC(year, 0, 4);
    return weekStart(jan4) + 3 * DAY;
  })();
  const week = Math.round((thursday.getTime() - firstThursday) / WEEK) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The Monday-midnight instant a `YYYY-Www` label refers to, or null. */
export function weekFromLabel(label) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(label ?? ""));
  if (!m) return null;

  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;

  const jan4 = Date.UTC(year, 0, 4);
  const start = weekStart(jan4) + (week - 1) * WEEK;

  // A label may be syntactically valid and still not exist — 2026 has 53 weeks
  // only if the arithmetic lands back inside the same year.
  return weekLabel(start) === label ? start : null;
}

const firstObservation = db.prepare(
  `SELECT MIN(observedAtMs) AS ms FROM RequestReality WHERE ${EXTERNAL}`
);

/** Every week that has a record behind it, newest first. */
export function weeksObserved() {
  const first = firstObservation.get()?.ms;
  if (!first) return [];

  const out = [];
  for (let ms = weekStart(first); ms <= Date.now(); ms += WEEK) out.push(weekLabel(ms));
  return out.reverse();
}

const totals = db.prepare(`
  SELECT COUNT(*) AS requests,
         COUNT(DISTINCT cfConnectingIp) AS addresses,
         COUNT(DISTINCT userAgent) AS agents,
         COUNT(DISTINCT path) AS paths
  FROM RequestReality
  WHERE ${EXTERNAL} AND observedAtMs >= ? AND observedAtMs < ?
`);

const busiestAddress = db.prepare(`
  SELECT COUNT(*) AS hits
  FROM RequestReality
  WHERE ${EXTERNAL} AND observedAtMs >= ? AND observedAtMs < ?
    AND cfConnectingIp IS NOT NULL AND cfConnectingIp <> ''
  GROUP BY cfConnectingIp
  ORDER BY hits DESC
  LIMIT 1
`);

const disallowedFetches = db.prepare(`
  SELECT COUNT(*) AS hits
  FROM RequestReality
  WHERE ${EXTERNAL} AND observedAtMs >= ? AND observedAtMs < ?
    AND (path LIKE '/internal/%' OR path LIKE '/no-crawl/%' OR path LIKE '/private-preview/%')
`);

const conditionalRequests = db.prepare(`
  SELECT COUNT(*) AS hits
  FROM RequestReality
  WHERE ${EXTERNAL} AND observedAtMs >= ? AND observedAtMs < ?
    AND (headersJson LIKE '%if-none-match%' OR headersJson LIKE '%if-modified-since%')
`);

// Findings are counted by the week they were decided in, not detected in. A
// finding held for review across a week boundary belongs to the week a person
// acted on it — the report is about what was established, not about what the
// detector noticed.
const findingsDecided = db.prepare(`
  SELECT status, title, slug, publishedAt, rejectedAt
  FROM Finding
  WHERE (publishedAt IS NOT NULL AND publishedAt >= ? AND publishedAt < ?)
     OR (rejectedAt  IS NOT NULL AND rejectedAt  >= ? AND rejectedAt  < ?)
  ORDER BY COALESCE(publishedAt, rejectedAt)
`);

const markersPublished = db.prepare(
  `SELECT COUNT(*) AS n FROM CanaryToken WHERE publishedAt >= ? AND publishedAt < ?`
);
const markersTotal = db.prepare(`SELECT COUNT(*) AS n FROM CanaryToken`);

/**
 * Everything one week of the record says about itself.
 *
 * Returns figures only. No interpretation is attached here — the page decides how
 * to phrase a quiet week, and phrasing is not evidence.
 */
export function weeklyReport(label) {
  const from = weekFromLabel(label);
  if (from === null) return null;

  const to = from + WEEK;
  const previousFrom = from - WEEK;

  const iso = (ms) => new Date(ms).toISOString();
  const now = totals.get(from, to);
  const before = totals.get(previousFrom, from);

  const busiest = busiestAddress.get(from, to)?.hits ?? 0;
  const decided = findingsDecided.all(iso(from), iso(to), iso(from), iso(to));

  return {
    label,
    from: iso(from),
    to: iso(to - 1),
    complete: to <= Date.now(),
    requests: now.requests,
    addresses: now.addresses,
    agents: now.agents,
    paths: now.paths,
    previousRequests: before.requests,
    busiest,
    busiestShare: now.requests > 0 ? Math.round((busiest / now.requests) * 1000) / 10 : 0,
    identities: declaredIdentities({ from, to }),
    disallowed: disallowedFetches.get(from, to)?.hits ?? 0,
    conditional: conditionalRequests.get(from, to)?.hits ?? 0,
    published: decided.filter((f) => f.status === "published"),
    rejected: decided.filter((f) => f.status === "rejected"),
    markersPublished: markersPublished.get(iso(from), iso(to))?.n ?? 0,
    markersTotal: markersTotal.get().n,
    markersObserved: 0, // No marker has ever been observed in a model's output.
    snapshot: SNAPSHOT_DATE
  };
}

/** The most recent week with a report, which is usually the one in progress. */
export function latestWeek() {
  return weeksObserved()[0] ?? weekLabel(Date.now());
}
