import { readFileSync } from "node:fs";
import { STAMP_PATH } from "../deploy/integrity-watch.mjs";
import db, { SITE_ID } from "../realityDb.js";
import { notOperator } from "../stats.js";
import { EXTERNAL } from "../stats.js";
export { epistemicIntegrity } from "../integrity.js";

// The scheduled watcher's last result. Read from disk on every request rather
// than cached, so the console reflects a run that happened after it booted.
export function integrityStamp() {
  try {
    return JSON.parse(readFileSync(STAMP_PATH, "utf8"));
  } catch {
    return null;
  }
}

// "External" is defined once, in stats.js, and imported here. It used to be
// written out a second time in this file with a subtly looser rule — it
// excluded rows whose own agent was curl, rather than every row from an address
// that had ever sent curl — and the two definitions drifted 81 requests apart.
// The public site said 89 external and this console said 170, for the same
// word, on the same record. One definition, one number.

// Read models for the operator console. Everything here is a SELECT; the
// dashboard's only writes go through the findings engine's own approve/reject.

const AI_PATTERNS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User",
  "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "CCBot", "meta-externalagent",
  "Amazonbot", "Bytespider", "cohere-ai", "Diffbot", "YouBot", "Timpibot"
];

const aiLike = AI_PATTERNS.map(() => "userAgent LIKE ?").join(" OR ");
const aiParams = AI_PATTERNS.map((p) => `%${p}%`);

const PLAIN_CLIENT =
  "(userAgent LIKE 'curl%' OR userAgent LIKE 'Wget%' OR userAgent LIKE 'Python-urllib%' " +
  "OR userAgent LIKE '%python-requests%' OR userAgent LIKE 'Go-http-client%' OR userAgent LIKE 'node-fetch%')";

const NON_ROUTABLE =
  "(cfConnectingIp IS NULL OR cfConnectingIp LIKE '192.0.2.%' OR cfConnectingIp LIKE '198.51.100.%' " +
  "OR cfConnectingIp LIKE '203.0.113.%' OR cfConnectingIp LIKE '10.%' OR cfConnectingIp LIKE '192.168.%' " +
  "OR cfConnectingIp LIKE '127.%' OR cfConnectingIp = '::1')";

/**
 * Addresses that have sent a plain command-line client at some point. Traffic
 * from these is almost certainly the operator's own testing, and mistaking it
 * for a real crawler has already produced eight false findings once.
 */
export function operatorIps() {
  return new Set(
    db
      .prepare(
        `SELECT DISTINCT cfConnectingIp FROM RequestReality
         WHERE siteId = ? AND cfConnectingIp IS NOT NULL AND ${PLAIN_CLIENT}`
      )
      .all(SITE_ID)
      .map((r) => r.cfConnectingIp)
  );
}

export function overview() {
  const q = (sql, params = [SITE_ID]) =>
    Object.values(db.prepare(sql).get(...params))[0];

  return {
    external: q(`SELECT COUNT(*) FROM RequestReality WHERE siteId = ? AND ${EXTERNAL}`),
    // Counted over external traffic, matching the public site. The operator
    // console may show everything elsewhere, but a figure that shares a label
    // with a published one must share its definition.
    agents: q(
      `SELECT COUNT(DISTINCT userAgent) FROM RequestReality WHERE siteId = ? AND ${EXTERNAL} AND userAgent IS NOT NULL`
    ),
    ips: q(`SELECT COUNT(DISTINCT cfConnectingIp) FROM RequestReality WHERE siteId = ? AND ${EXTERNAL}`),
    countries: q(
      `SELECT COUNT(DISTINCT cfIpCountry) FROM RequestReality WHERE siteId = ? AND ${EXTERNAL} AND cfIpCountry IS NOT NULL`
    ),
    aiRequests: db
      .prepare(
        `SELECT COUNT(*) AS n FROM RequestReality WHERE siteId = ? AND ${EXTERNAL} AND (${aiLike})`
      )
      .get(SITE_ID, ...aiParams).n,
    markers: q("SELECT COUNT(*) FROM CanaryToken WHERE siteId = ?"),
    jsBeacons: q(
      `SELECT COUNT(*) FROM JsExecution j WHERE j.siteId = ? AND EXISTS (
         SELECT 1 FROM RequestReality r WHERE r.id = j.requestId AND ${EXTERNAL})`
    ),
    since: q(`SELECT MIN(observedAt) FROM RequestReality WHERE siteId = ? AND ${EXTERNAL}`),
    last: q(`SELECT MAX(observedAt) FROM RequestReality WHERE siteId = ? AND ${EXTERNAL}`),
    last24h: q(
      `SELECT COUNT(*) FROM RequestReality WHERE siteId = ? AND ${EXTERNAL} AND observedAtMs > (strftime('%s','now')-86400)*1000`
    ),
    findings: db
      .prepare(
        `SELECT status, COUNT(*) AS n FROM Finding WHERE siteId = ? GROUP BY status`
      )
      .all(SITE_ID)
      .reduce((acc, r) => ({ ...acc, [r.status]: r.n }), {})
  };
}

export function recentRequests({ limit = 60, filter = "external" } = {}) {
  // Everything here is external unless the caller explicitly asks for the
  // instrument's own traffic, which is a diagnostic view and is labelled as one.
  let where = filter === "instrument" ? `siteId = ? AND NOT (${EXTERNAL})` : `siteId = ? AND ${EXTERNAL}`;
  const params = [SITE_ID];

  if (filter === "ai") {
    where += ` AND (${aiLike})`;
    params.push(...aiParams);
  } else if (filter === "disallowed") {
    where += " AND (path LIKE '/internal/%' OR path LIKE '/no-crawl/%' OR path LIKE '/private-preview/%')";
  } else if (filter === "errors") {
    where += " AND responseStatus >= 400";
  }

  return db
    .prepare(
      `SELECT id, observedAt, method, path, responseStatus, userAgent,
              cfConnectingIp, cfIpCountry, cfRay, routeVariant, responseTimeMs
       FROM RequestReality WHERE ${where}
       ORDER BY observedAtMs DESC LIMIT ?`
    )
    .all(...params, limit);
}

export function agentBreakdown() {
  return db
    .prepare(
      `SELECT userAgent, COUNT(*) AS hits, COUNT(DISTINCT path) AS paths,
              COUNT(DISTINCT cfConnectingIp) AS ips,
              MIN(observedAt) AS firstAt, MAX(observedAt) AS lastAt,
              1 AS viaCdn
       FROM RequestReality WHERE siteId = ? AND ${EXTERNAL} AND userAgent IS NOT NULL
       GROUP BY userAgent ORDER BY hits DESC LIMIT 50`
    )
    .all(SITE_ID);
}

/**
 * Marker lifecycle: created → published → fetched → archived.
 *
 * Appearing in a model is deliberately not a stage. It may never happen, and a
 * lifecycle whose final step might never arrive is not a lifecycle — so that
 * remains an observation recorded against the marker, not a state it enters.
 */
export function canaries() {
  return db
    .prepare(
      `SELECT c.token, c.page, c.variant, c.publishedAt, c.retiredAt,
              (SELECT COUNT(*) FROM RequestReality r
               WHERE r.siteId = c.siteId AND r.canaryToken = c.token AND r.cfRay IS NOT NULL
                 AND ${notOperator("r")}
              ) AS served
       FROM CanaryToken c WHERE c.siteId = ?
       ORDER BY c.publishedAt, c.page`
    )
    .all(SITE_ID)
    .map((c) => ({
      ...c,
      stage: c.retiredAt ? "archived" : c.served > 0 ? "fetched" : "published"
    }));
}

export function findingsByStatus(status) {
  return db
    .prepare(
      `SELECT id, slug, detectorId, origin, status, title, summary,
              subjectKey, detectedAt, publishedAt, rejectedReason
       FROM Finding WHERE siteId = ? AND status = ?
       ORDER BY COALESCE(publishedAt, detectedAt) DESC`
    )
    .all(SITE_ID, status);
}

export function findingClaims(findingId) {
  return db
    .prepare(
      "SELECT label, expected, observed, ok, checkedAt FROM FindingClaim WHERE findingId = ?"
    )
    .all(findingId);
}

/** Things worth an operator's attention right now. */
export function alerts() {
  const out = [];

  const pending = db
    .prepare("SELECT COUNT(*) AS n FROM Finding WHERE siteId = ? AND status = 'pending'")
    .get(SITE_ID).n;
  if (pending > 0) {
    out.push({
      level: "review",
      text: `${pending} finding${pending === 1 ? "" : "s"} held for review`,
      href: "/findings?status=pending"
    });
  }

  const spoofish = db
    .prepare(
      `SELECT COUNT(DISTINCT cfConnectingIp) AS n FROM RequestReality
       WHERE siteId = ? AND cfConnectingIp IS NOT NULL AND (${aiLike})
         AND cfConnectingIp IN (
           SELECT cfConnectingIp FROM RequestReality
           WHERE siteId = ? AND cfConnectingIp IS NOT NULL AND ${PLAIN_CLIENT})`
    )
    .get(SITE_ID, ...aiParams, SITE_ID).n;
  if (spoofish > 0) {
    out.push({
      level: "warn",
      text: `${spoofish} address${spoofish === 1 ? "" : "es"} declared an AI crawler and also sent a plain client — excluded from findings`,
      href: "/requests?filter=ai"
    });
  }

  const stale = db
    .prepare(
      `SELECT MAX(observedAtMs) AS t FROM RequestReality WHERE siteId = ?`
    )
    .get(SITE_ID).t;
  if (stale && Date.now() - stale > 3 * 3600 * 1000) {
    out.push({
      level: "warn",
      text: `no request observed in ${Math.round((Date.now() - stale) / 3600000)} hours — check the tunnel`,
      href: "/requests"
    });
  }

  return out;
}

export { SITE_ID };


/**
 * Operational health. Only components that can genuinely fail are listed: a
 * light that cannot turn red is decoration, not a status indicator.
 */
export function health() {
  const now = Date.now();
  const check = (name, detail, ok, note) => ({ name, detail, ok, note });

  // Deliberately counts any arrival, including ours: this asks whether the
  // capture path is alive, not what was observed. External-only here would go
  // red during a quiet night and mean nothing.
  const lastRequest = db
    .prepare("SELECT MAX(observedAtMs) AS t FROM RequestReality WHERE siteId = ?")
    .get(SITE_ID).t;
  const requestAgeMin = lastRequest ? Math.round((now - lastRequest) / 60000) : null;

  const lastFinding = db
    .prepare("SELECT MAX(detectedAt) AS t FROM Finding WHERE siteId = ?")
    .get(SITE_ID).t;

  const pendingCount = db
    .prepare("SELECT COUNT(*) AS n FROM Finding WHERE siteId = ? AND status = 'pending'")
    .get(SITE_ID).n;

  const markerCount = db
    .prepare("SELECT COUNT(*) AS n FROM CanaryToken WHERE siteId = ?")
    .get(SITE_ID).n;

  const unverified = db
    .prepare(
      `SELECT COUNT(*) AS n FROM Finding f WHERE f.siteId = ? AND f.status = 'published'
       AND f.origin = 'detector'
       AND NOT EXISTS (SELECT 1 FROM FindingClaim c WHERE c.findingId = f.id AND c.ok = 1)`
    )
    .get(SITE_ID).n;

  const lastSubmission = db
    .prepare("SELECT MAX(submittedAtMs) AS t, MAX(httpStatus) AS s FROM IndexSubmission WHERE siteId = ?")
    .get(SITE_ID);

  return [
    check(
      "Capture",
      requestAgeMin === null
        ? "no requests yet"
        : `last request ${requestAgeMin} min ago (any, incl. ours — liveness)`,
      requestAgeMin !== null && requestAgeMin < 180,
      "Nothing recorded for three hours usually means the tunnel is down, not that the internet went quiet."
    ),
    check(
      "Detector scheduler",
      lastFinding ? `last pass produced a candidate ${lastFinding.slice(0, 16).replace("T", " ")}` : "no candidate yet",
      true,
      "Runs every 15 minutes; a quiet pass is normal."
    ),
    check(
      "Review queue",
      pendingCount === 0 ? "empty" : `${pendingCount} awaiting a person`,
      pendingCount < 10,
      "Findings that name an actor wait here. A queue that only grows means nobody is reading it."
    ),
    check(
      "Verification",
      unverified === 0
        ? "every published detector finding has a matched figure"
        : `${unverified} published without a matched figure`,
      unverified === 0,
      "A published finding with no verified figure would mean the gate was bypassed."
    ),
    check(
      "Markers",
      `${markerCount} published`,
      markerCount > 0,
      "Each page must carry a marker or ingestion cannot be measured at all."
    ),
    check(
      "Discovery",
      lastSubmission.t
        ? `last announced ${new Date(lastSubmission.t).toISOString().slice(0, 16).replace("T", " ")}, index replied ${lastSubmission.s}`
        : "nothing announced",
      lastSubmission.s === 200 || lastSubmission.s === 202 || !lastSubmission.t,
      "An action, not evidence. It starts a clock; whether anyone fetches is observed separately."
    )
  ];
}
