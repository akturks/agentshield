import db from "./realityDb.js";

// Shared by the home page and the lab so both quote the same record.
//
// The headline figure is external traffic, not the raw row count. Building and
// testing this instrument generated several hundred requests against it, and a
// site claiming to measure how AI systems read the web would be lying if it
// counted its own load tests among them.
//
// Those rows are not deleted. Every page here states that records are
// INSERT-only and never updated, and quietly removing the inconvenient ones
// would make that claim false — which would cost more than a flattering number
// is worth. They are excluded from published figures and reported separately.

const PLAIN_CLIENT =
  "(userAgent LIKE 'curl%' OR userAgent LIKE 'Wget%' OR userAgent LIKE 'Python-urllib%' " +
  "OR userAgent LIKE '%python-requests%' OR userAgent LIKE 'Go-http-client%' OR userAgent LIKE 'node-fetch%')";

/**
 * Excludes traffic from any address that has also driven this site from a
 * command line — the operator, in other words.
 *
 * Exported as a function of the table alias so every query can use the same
 * rule instead of restating it. Restating it is how the home page came to say
 * 89 external while the console said 170 for the same record, and the integrity
 * check now fails if this clause is written out by hand anywhere else.
 */
export function notOperator(alias = "RequestReality") {
  return `${alias}.cfConnectingIp NOT IN (
    SELECT cfConnectingIp FROM RequestReality
    WHERE cfConnectingIp IS NOT NULL AND ${PLAIN_CLIENT})`;
}

// Reached the server over the public internet, from a routable address, and not
// from an address that has also driven this site from a command line.
export const EXTERNAL = `
  cfRay IS NOT NULL
  AND cfConnectingIp IS NOT NULL
  AND cfConnectingIp NOT LIKE '203.0.113.%'
  AND cfConnectingIp NOT LIKE '192.0.2.%'
  AND cfConnectingIp NOT LIKE '198.51.100.%'
  AND cfConnectingIp NOT LIKE '10.%'
  AND cfConnectingIp NOT LIKE '192.168.%'
  AND cfConnectingIp NOT LIKE '127.%'
  AND cfConnectingIp NOT IN (
    SELECT cfConnectingIp FROM RequestReality
    WHERE cfConnectingIp IS NOT NULL AND ${PLAIN_CLIENT})`;

const q = {
  external: db.prepare(`SELECT COUNT(*) AS n FROM RequestReality WHERE ${EXTERNAL}`),
  instrument: db.prepare(
    `SELECT COUNT(*) AS n FROM RequestReality WHERE NOT (${EXTERNAL})`
  ),
  total: db.prepare("SELECT COUNT(*) AS n FROM RequestReality"),
  since: db.prepare(`SELECT MIN(observedAt) AS t FROM RequestReality WHERE ${EXTERNAL}`),
  agents: db.prepare(
    `SELECT COUNT(DISTINCT userAgent) AS n FROM RequestReality WHERE ${EXTERNAL} AND userAgent IS NOT NULL`
  ),
  ips: db.prepare(
    `SELECT COUNT(DISTINCT cfConnectingIp) AS n FROM RequestReality WHERE ${EXTERNAL}`
  ),
  countries: db.prepare(
    `SELECT COUNT(DISTINCT cfIpCountry) AS n FROM RequestReality WHERE ${EXTERNAL} AND cfIpCountry IS NOT NULL`
  ),
  markers: db.prepare("SELECT COUNT(*) AS n FROM CanaryToken"),
  jsAgents: db.prepare(`
    SELECT COUNT(DISTINCT r.userAgent) AS n
    FROM JsExecution j JOIN RequestReality r ON r.id = j.requestId
  `)
};

export function headline() {
  return {
    external: q.external.get().n,
    instrument: q.instrument.get().n,
    total: q.total.get().n,
    since: q.since.get().t,
    agents: q.agents.get().n,
    ips: q.ips.get().n,
    countries: q.countries.get().n,
    markers: q.markers.get().n,
    jsAgents: q.jsAgents.get().n
  };
}
