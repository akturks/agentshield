import db from "../realityDb.js";
import { notOperator } from "../stats.js";

// Deterministic rules over observed reality. A detector never interprets and
// never writes prose — it returns candidates: a subject, a time window, and the
// exact figures that support it, each paired with the query that produced it.
//
// Every figure a detector emits carries its own SQL so the verifier can
// recompute it independently before anything is published. A detector that
// returned a number without a query would be asking to be trusted, which is the
// thing this system does not do.

export const DETECTOR_VERSION = "det-1";

const AI_AGENT_PATTERNS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
  "Amazonbot",
  "Bytespider",
  "cohere-ai",
  "Diffbot",
  "YouBot",
  "Timpibot"
];

const DISALLOWED_PREFIXES = ["/internal/", "/no-crawl/", "/private-preview/"];

/** A figure plus the query that reproduces it. */
function claim(label, sql, params, expected) {
  return { label, sql, params, expected: String(expected) };
}

function one(sql, params = []) {
  const row = db.prepare(sql).get(...params);
  return row ? Object.values(row)[0] : null;
}

const disallowedWhere = DISALLOWED_PREFIXES.map(() => "path LIKE ?").join(" OR ");
const disallowedParams = DISALLOWED_PREFIXES.map((p) => `${p}%`);

/**
 * A client requested robots.txt and afterwards took a path those rules asked it
 * to leave alone. This is the strong form of the compliance question: the rules
 * were read, then not followed.
 */
function robotsViolation(siteId) {
  const rows = db
    .prepare(
      `SELECT r.cfConnectingIp AS ip, r.userAgent AS ua,
              MIN(r.observedAtMs) AS firstMs, MAX(r.observedAtMs) AS lastMs,
              COUNT(*) AS hits
       FROM RequestReality r
       WHERE r.siteId = ? AND (${disallowedWhere})
         AND r.cfConnectingIp IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM RequestReality p
           WHERE p.siteId = r.siteId AND p.cfConnectingIp = r.cfConnectingIp
             AND p.path = '/robots.txt' AND p.observedAtMs < r.observedAtMs
         )
       GROUP BY r.cfConnectingIp, r.userAgent`
    )
    .all(siteId, ...disallowedParams);

  return rows.map((r) => ({
    detectorId: "robots_violation",
    subjectKey: `${r.ip}|${r.ua ?? ""}`,
    windowStartMs: r.firstMs,
    windowEndMs: r.lastMs,
    facts: { ua: r.ua, hits: r.hits },
    claims: [
      claim(
        "fetches of disallowed paths after reading robots.txt",
        `SELECT COUNT(*) FROM RequestReality r WHERE r.siteId = ? AND r.cfConnectingIp = ?
         AND (${disallowedWhere})
         AND EXISTS (SELECT 1 FROM RequestReality p WHERE p.siteId = r.siteId
                     AND p.cfConnectingIp = r.cfConnectingIp AND p.path = '/robots.txt'
                     AND p.observedAtMs < r.observedAtMs)`,
        [siteId, r.ip, ...disallowedParams],
        r.hits
      )
    ]
  }));
}

// An address that also sends curl, wget or a bare HTTP library is not running a
// production crawler fleet. Requests from such an address are excluded from
// arrival counts entirely.
//
// This clause exists because the first run of this detector without it
// published eight arrivals — GPTBot, ClaudeBot, CCBot and others — every one of
// which was a spoofed user agent sent from the operator's own machine while
// testing whether the CDN was blocking AI crawlers. The record contained
// everything needed to reject them; the rule simply was not consulting it.
const PLAIN_CLIENT_SQL = `
  NOT EXISTS (
    SELECT 1 FROM RequestReality c
    WHERE c.siteId = RequestReality.siteId
      AND c.cfConnectingIp = RequestReality.cfConnectingIp
      AND (c.userAgent LIKE 'curl%' OR c.userAgent LIKE 'Wget%'
           OR c.userAgent LIKE 'Python-urllib%' OR c.userAgent LIKE '%python-requests%'
           OR c.userAgent LIKE 'Go-http-client%' OR c.userAgent LIKE 'node-fetch%')
  )`;

// Addresses that cannot appear as a real client on the public internet: the
// RFC 5737 documentation ranges, RFC 1918 private space, and loopback. A
// request presenting one of these reached the capture layer through a supplied
// header rather than an actual connection, which is to say it was a test.
const ROUTABLE_SQL = `
  cfConnectingIp IS NOT NULL
  AND cfConnectingIp NOT LIKE '192.0.2.%'
  AND cfConnectingIp NOT LIKE '198.51.100.%'
  AND cfConnectingIp NOT LIKE '203.0.113.%'
  AND cfConnectingIp NOT LIKE '10.%'
  AND cfConnectingIp NOT LIKE '192.168.%'
  AND cfConnectingIp NOT LIKE '127.%'
  AND cfConnectingIp NOT LIKE '::1'
  AND cfConnectingIp NOT LIKE 'fc%'
  AND cfConnectingIp NOT LIKE 'fd%'`;

const CREDIBLE_AGENT_SQL = `siteId = ? AND cfRay IS NOT NULL AND userAgent LIKE ? AND ${ROUTABLE_SQL} AND ${PLAIN_CLIENT_SQL}`;

/**
 * A declared AI crawler seen on this site, counting only requests from
 * addresses that have not also presented a contradictory identity. Arrival is
 * the whole event; nothing is claimed about why it came.
 */
function newAiAgent(siteId) {
  const out = [];

  for (const pattern of AI_AGENT_PATTERNS) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS hits, MIN(observedAtMs) AS firstMs, MAX(observedAtMs) AS lastMs,
                COUNT(DISTINCT path) AS paths, COUNT(DISTINCT cfConnectingIp) AS ips
         FROM RequestReality WHERE ${CREDIBLE_AGENT_SQL}`
      )
      .get(siteId, `%${pattern}%`);

    if (!row || row.hits === 0) continue;

    out.push({
      detectorId: "ai_agent_arrival",
      subjectKey: pattern,
      windowStartMs: row.firstMs,
      windowEndMs: row.lastMs,
      facts: { agent: pattern, paths: row.paths, ips: row.ips },
      claims: [
        claim(
          `requests declaring ${pattern} from addresses with no contradictory identity`,
          `SELECT COUNT(*) FROM RequestReality WHERE ${CREDIBLE_AGENT_SQL}`,
          [siteId, `%${pattern}%`],
          row.hits
        ),
        claim(
          `distinct paths taken by ${pattern}`,
          `SELECT COUNT(DISTINCT path) FROM RequestReality WHERE ${CREDIBLE_AGENT_SQL}`,
          [siteId, `%${pattern}%`],
          row.paths
        )
      ]
    });
  }

  return out;
}

/** Many distinct paths from one address inside a short window. */
function automatedEnumeration(siteId, { windowMs = 60000, minPaths = 20 } = {}) {
  const rows = db
    .prepare(
      `SELECT cfConnectingIp AS ip, userAgent AS ua,
              COUNT(DISTINCT path) AS paths, COUNT(*) AS hits,
              MIN(observedAtMs) AS firstMs, MAX(observedAtMs) AS lastMs
       FROM RequestReality
       WHERE siteId = ? AND cfConnectingIp IS NOT NULL
       GROUP BY cfConnectingIp
       HAVING paths >= ? AND (lastMs - firstMs) <= ?`
    )
    .all(siteId, minPaths, windowMs);

  return rows.map((r) => ({
    detectorId: "automated_enumeration",
    subjectKey: r.ip,
    windowStartMs: r.firstMs,
    windowEndMs: r.lastMs,
    facts: {
      ua: r.ua,
      paths: r.paths,
      seconds: Math.round((r.lastMs - r.firstMs) / 1000)
    },
    claims: [
      claim(
        "distinct paths from this address",
        `SELECT COUNT(DISTINCT path) FROM RequestReality WHERE siteId = ? AND cfConnectingIp = ?`,
        [siteId, r.ip],
        r.paths
      )
    ]
  }));
}

/**
 * One address presenting contradictory identities — for instance a plain HTTP
 * client and a well-known AI crawler. A user agent is a claim; when the same
 * origin makes incompatible claims, the record says so.
 *
 * This rule exists because it caught a real case: a spoofed ChatGPT-User agent
 * sent from an address that was also sending curl.
 */
function identityInconsistency(siteId) {
  const like = AI_AGENT_PATTERNS.map(() => "userAgent LIKE ?").join(" OR ");
  const likeParams = AI_AGENT_PATTERNS.map((p) => `%${p}%`);

  const rows = db
    .prepare(
      `SELECT cfConnectingIp AS ip,
              COUNT(DISTINCT userAgent) AS identities,
              MIN(observedAtMs) AS firstMs, MAX(observedAtMs) AS lastMs
       FROM RequestReality
       WHERE siteId = ? AND cfConnectingIp IS NOT NULL
         AND EXISTS (SELECT 1 FROM RequestReality a
                     WHERE a.siteId = RequestReality.siteId
                       AND a.cfConnectingIp = RequestReality.cfConnectingIp
                       AND (${like}))
         AND EXISTS (SELECT 1 FROM RequestReality b
                     WHERE b.siteId = RequestReality.siteId
                       AND b.cfConnectingIp = RequestReality.cfConnectingIp
                       AND (b.userAgent LIKE 'curl%' OR b.userAgent LIKE 'Wget%'
                            OR b.userAgent LIKE 'Python-urllib%' OR b.userAgent LIKE '%python-requests%'))
       GROUP BY cfConnectingIp`
    )
    .all(siteId, ...likeParams);

  return rows.map((r) => {
    const claimed = db
      .prepare(
        `SELECT DISTINCT userAgent FROM RequestReality
         WHERE siteId = ? AND cfConnectingIp = ? AND (${like})`
      )
      .all(siteId, r.ip, ...likeParams)
      .map((x) => x.userAgent);

    return {
      detectorId: "identity_inconsistency",
      subjectKey: r.ip,
      windowStartMs: r.firstMs,
      windowEndMs: r.lastMs,
      facts: { identities: r.identities, claimedAgents: claimed },
      claims: [
        claim(
          "distinct declared identities from this address",
          `SELECT COUNT(DISTINCT userAgent) FROM RequestReality WHERE siteId = ? AND cfConnectingIp = ?`,
          [siteId, r.ip],
          r.identities
        )
      ]
    };
  });
}

/** A client demonstrably executed JavaScript, evidenced by reaching the beacon. */
function jsExecution(siteId) {
  const rows = db
    .prepare(
      `SELECT r.userAgent AS ua, COUNT(*) AS beacons,
              MIN(j.beaconAtMs) AS firstMs, MAX(j.beaconAtMs) AS lastMs
       FROM JsExecution j JOIN RequestReality r ON r.id = j.requestId
       WHERE j.siteId = ? AND r.cfRay IS NOT NULL
         AND ${notOperator('r')}
       GROUP BY r.userAgent`
    )
    .all(siteId);

  return rows.map((r) => ({
    detectorId: "js_execution",
    subjectKey: r.ua ?? "(none)",
    windowStartMs: r.firstMs,
    windowEndMs: r.lastMs,
    facts: { ua: r.ua, beacons: r.beacons },
    claims: [
      claim(
        "beacon requests from this client",
        `SELECT COUNT(*) FROM JsExecution j JOIN RequestReality r ON r.id = j.requestId
         WHERE j.siteId = ? AND r.cfRay IS NOT NULL AND r.userAgent IS ?
           AND ${notOperator('r')}`,
        [siteId, r.ua],
        r.beacons
      )
    ]
  }));
}

/**
 * Which of the five identical-content format variants were fetched. Reported
 * once a minimum volume exists, because a preference claim from four fetches
 * would be noise dressed as a result.
 *
 * Counts only credible traffic. The first version of this rule counted
 * everything and published a finding stating that plain text was the preferred
 * format — all 260 of those fetches were the operator load-testing the rate
 * limiter minutes earlier.
 */
function formatPreference(siteId, { minTotal = 40 } = {}) {
  const PROBE = `siteId = ? AND cfRay IS NOT NULL AND routeVariant LIKE 'probe_%' AND ${ROUTABLE_SQL} AND ${PLAIN_CLIENT_SQL}`;

  const total = one(`SELECT COUNT(*) FROM RequestReality WHERE ${PROBE}`, [siteId]);

  if (!total || total < minTotal) return [];

  const rows = db
    .prepare(
      `SELECT routeVariant AS variant, COUNT(*) AS hits
       FROM RequestReality WHERE ${PROBE}
       GROUP BY routeVariant ORDER BY hits DESC`
    )
    .all(siteId);

  const bounds = db
    .prepare(
      `SELECT MIN(observedAtMs) a, MAX(observedAtMs) b FROM RequestReality WHERE ${PROBE}`
    )
    .get(siteId);

  return [
    {
      detectorId: "format_preference",
      subjectKey: "all",
      windowStartMs: bounds.a,
      windowEndMs: bounds.b,
      facts: { total, rows },
      claims: [
        claim(
          "total format-variant fetches from credible clients",
          `SELECT COUNT(*) FROM RequestReality WHERE ${PROBE}`,
          [siteId],
          total
        ),
        claim(
          `fetches of the most-fetched variant (${rows[0].variant})`,
          `SELECT COUNT(*) FROM RequestReality WHERE ${PROBE} AND routeVariant = ?`,
          [siteId, rows[0].variant],
          rows[0].hits
        )
      ]
    }
  ];
}

export const DETECTORS = [
  robotsViolation,
  newAiAgent,
  automatedEnumeration,
  identityInconsistency,
  jsExecution,
  formatPreference
];

/** Runs every detector for a site and returns all candidates. */
export function detectAll(siteId) {
  const candidates = [];
  for (const detector of DETECTORS) {
    try {
      candidates.push(...detector(siteId));
    } catch (err) {
      console.error(`[detect] ${detector.name} failed:`, err.message);
    }
  }
  return candidates;
}
