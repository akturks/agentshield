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

// Addresses this project operates from, declared rather than inferred.
//
// The inference above — an address that has also sent curl — is a good clue and
// a poor identity. It misses every device that never runs curl, and it misses
// the same machine after its address changes. Both happened: 24 requests from a
// phone that had no reason to run curl, and 13 from this very machine after
// macOS rotated the host part of its IPv6 address, which it does daily.
//
// A declared list is the honest fix, and it is also the dangerous one: it is the
// only mechanism here that can remove real observations from a published figure.
// Three things keep it accountable. It lives in versioned code rather than in
// the database, so every change to it is in the history. Prefixes must be
// group-aligned, so none of them can quietly match more than stated. And the
// number of requests it excludes is published beside the number the heuristic
// excludes, on the lab page, so the list cannot grow without the effect showing.
//
// This is interpretation, not action. It says how to read the record; it does
// nothing to the world, and it is never cited as evidence for anything.
export const OPERATOR_ADDRESSES = [
  // Home connection. IPv6 privacy extensions rotate the host part of this
  // address about once a day, so the /64 is the stable unit, not the address.
  // Seen so far as ...b997:78fb:eb0d:b131 and ...85c7:602b:dc47:e3a3.
  "2a00:1d34:4896:b600::/64"
];

/**
 * Turns a declared address or group-aligned CIDR into one SQL LIKE pattern.
 *
 * Only prefixes that end on a group boundary are accepted — an IPv6 /64, or an
 * IPv4 /8, /16 or /24 — because those are the ones a textual prefix match
 * expresses exactly. Anything else would have to be approximated, and an
 * exclusion rule that matches more than it says is the failure this list exists
 * to prevent. A rejected entry throws at startup rather than being skipped.
 */
function toLikePattern(entry) {
  if (!entry.includes("/")) return entry;

  const [addr, bitsText] = entry.split("/");
  const bits = Number(bitsText);

  if (addr.includes(":")) {
    if (bits !== 64) {
      throw new Error(
        `OPERATOR_ADDRESSES: "${entry}" — only /64 is supported for IPv6, not /${bitsText}`
      );
    }
    const groups = addr.split(":").filter((g) => g !== "");
    if (groups.length < 4) {
      throw new Error(`OPERATOR_ADDRESSES: "${entry}" — a /64 needs its first four groups written out`);
    }
    return `${groups.slice(0, 4).join(":")}:%`;
  }

  if (![8, 16, 24].includes(bits)) {
    throw new Error(
      `OPERATOR_ADDRESSES: "${entry}" — only /8, /16 and /24 are supported for IPv4, not /${bitsText}`
    );
  }
  return `${addr.split(".").slice(0, bits / 8).join(".")}.%`;
}

const OPERATOR_PATTERNS = OPERATOR_ADDRESSES.map(toLikePattern);

/**
 * Excludes the declared operator addresses. Empty list means no clause.
 *
 * Pass null for the alias to get unqualified column references. EXTERNAL below
 * needs those: it is pasted into subqueries that alias this table, and a clause
 * naming RequestReality explicitly fails there with "no such column" — which is
 * exactly how the console broke the first time this was added.
 */
function notDeclared(alias = "RequestReality") {
  if (OPERATOR_PATTERNS.length === 0) return "1=1";
  const col = alias ? `${alias}.cfConnectingIp` : "cfConnectingIp";
  return OPERATOR_PATTERNS.map((p) => `${col} NOT LIKE '${p}'`).join(" AND ");
}

/**
 * The declared-address clause, for queries outside this module that need to
 * apply the same exclusion. Exported so it is used rather than restated.
 */
export function notDeclaredOperator(alias = "RequestReality") {
  return notDeclared(alias);
}

/**
 * Excludes the operator: any address declared above, and any address that has
 * also driven this site from a command line.
 *
 * Exported as a function of the table alias so every query can use the same
 * rule instead of restating it. Restating it is how the home page came to say
 * 89 external while the console said 170 for the same record, and the integrity
 * check now fails if this clause is written out by hand anywhere else.
 */
export function notOperator(alias = "RequestReality") {
  return `${notDeclared(alias)}
    AND ${alias}.cfConnectingIp NOT IN (
    SELECT cfConnectingIp FROM RequestReality
    WHERE cfConnectingIp IS NOT NULL AND ${PLAIN_CLIENT})`;
}

// Reached the server over the public internet, from a routable address, and from
// neither a declared operator address nor one that has driven this site from a
// command line.
export const EXTERNAL = `
  cfRay IS NOT NULL
  AND cfConnectingIp IS NOT NULL
  AND cfConnectingIp NOT LIKE '203.0.113.%'
  AND cfConnectingIp NOT LIKE '192.0.2.%'
  AND cfConnectingIp NOT LIKE '198.51.100.%'
  AND cfConnectingIp NOT LIKE '10.%'
  AND cfConnectingIp NOT LIKE '192.168.%'
  AND cfConnectingIp NOT LIKE '127.%'
  AND ${notDeclared(null)}
  AND cfConnectingIp NOT IN (
    SELECT cfConnectingIp FROM RequestReality
    WHERE cfConnectingIp IS NOT NULL AND ${PLAIN_CLIENT})`;

// What each exclusion removes, reported separately so the declared list cannot
// grow without its effect being visible. See the note on OPERATOR_ADDRESSES.
const EXCLUDED_BY_DECLARATION = `
  cfRay IS NOT NULL AND cfConnectingIp IS NOT NULL AND NOT (${notDeclared(null)})`;

const EXCLUDED_BY_HEURISTIC = `
  cfRay IS NOT NULL AND cfConnectingIp IS NOT NULL AND ${notDeclared(null)}
  AND cfConnectingIp IN (
    SELECT cfConnectingIp FROM RequestReality
    WHERE cfConnectingIp IS NOT NULL AND ${PLAIN_CLIENT})`;

// Counted as external, and probably ours anyway.
//
// Three addresses in Vodafone Turkey's mobile pool send the exact Accept-Language
// header that the declared operator machine sends — a long list ending in Turkmen,
// Azeri and Bosnian that no other client on this site has ever sent. It is almost
// certainly the operator's phone. It is not excluded, for two reasons.
//
// A carrier pool address identifies a carrier, not a person. Declaring one would
// exclude whichever Vodafone customer holds it next, and the phone will have a
// different address tomorrow regardless — so the exclusion would remove real
// observations while failing at the thing it was for.
//
// The alternative, matching on the header itself, is worse. Article VII of the
// constitution says the unit of observation is a request and not a person, and no
// fingerprinting. Identifying a person by their combination of headers is that
// technique, and a codebase containing it for self-exclusion contains it for
// everything else too. Not having the capability is worth more than a 13% correction.
//
// So it is reported instead. The criterion derives from the declared addresses
// rather than naming any header value here, which keeps this honest and lets it
// follow the operator's browser settings if they change.
const OPERATOR_LANGUAGES = `
  acceptLanguage IS NOT NULL AND acceptLanguage <> '' AND acceptLanguage IN (
    SELECT DISTINCT acceptLanguage FROM RequestReality
    WHERE acceptLanguage IS NOT NULL AND acceptLanguage <> ''
      AND NOT (${notDeclared(null)}))`;

const UNRESOLVED_OPERATOR = `${EXTERNAL} AND ${OPERATOR_LANGUAGES}`;

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
  byDeclaration: db.prepare(
    `SELECT COUNT(*) AS n FROM RequestReality WHERE ${EXCLUDED_BY_DECLARATION}`
  ),
  byHeuristic: db.prepare(
    `SELECT COUNT(*) AS n FROM RequestReality WHERE ${EXCLUDED_BY_HEURISTIC}`
  ),
  unresolvedOperator: db.prepare(
    `SELECT COUNT(*) AS n FROM RequestReality WHERE ${UNRESOLVED_OPERATOR}`
  ),
  unresolvedOperatorIps: db.prepare(
    `SELECT COUNT(DISTINCT cfConnectingIp) AS n FROM RequestReality WHERE ${UNRESOLVED_OPERATOR}`
  ),
  // Filtered like every other figure here. Unfiltered, this counted two agents
  // that had executed JavaScript and both were the operator's own test clients.
  // It was never rendered, which is the only reason it was not published as a
  // result — the lab page happened to run its own filtered query instead.
  jsAgents: db.prepare(`
    SELECT COUNT(DISTINCT r.userAgent) AS n
    FROM JsExecution j JOIN RequestReality r ON r.id = j.requestId
    WHERE r.cfRay IS NOT NULL AND ${notOperator("r")}
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
    jsAgents: q.jsAgents.get().n,
    excludedByDeclaration: q.byDeclaration.get().n,
    excludedByHeuristic: q.byHeuristic.get().n,
    declaredAddresses: OPERATOR_ADDRESSES,
    unresolvedOperator: q.unresolvedOperator.get().n,
    unresolvedOperatorIps: q.unresolvedOperatorIps.get().n
  };
}
