import db from "../realityDb.js";
import { notOperator, notDeclaredOperator, probablyOperatorLanguage } from "../stats.js";
import { classify, SNAPSHOT_DATE } from "../vendors/index.js";
import { AGENT_OWNER, ownersOf } from "../vendors/sources.js";

// Deterministic rules over observed reality. A detector never interprets and
// never writes prose — it returns candidates: a subject, a time window, and the
// exact figures that support it, each paired with the query that produced it.
//
// Every figure a detector emits carries its own SQL so the verifier can
// recompute it independently before anything is published. A detector that
// returned a number without a query would be asking to be trusted, which is the
// thing this system does not do.

export const DETECTOR_VERSION = "det-8";

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

// Which declared trial vendors could explain an arrival by a given agent.
//
// An arrival finding says a client reached this site. It cannot say why, and
// there is one reason it might have come that the observation record can never
// contain: we asked it to. Asking an assistant to read a page is an action under
// Article "Action", and an action that produced an arrival must be disclosed
// beside that arrival or the finding reads as discovery.
//
// This map is consulted at detection time, in JavaScript, never inside a claim's
// SQL — a published figure may not derive from the action layer, and it does not:
// the figures stay pure counts over reality. The trial is used only to weaken or
// withhold a conclusion, which is the opposite of citing it as evidence.
const AGENT_VENDORS = {
  GPTBot: ["openai", "chatgpt", "gpt"],
  "OAI-SearchBot": ["openai", "chatgpt", "gpt"],
  "ChatGPT-User": ["openai", "chatgpt", "gpt"],
  ClaudeBot: ["anthropic", "claude"],
  "Claude-User": ["anthropic", "claude"],
  "Claude-SearchBot": ["anthropic", "claude"],
  "anthropic-ai": ["anthropic", "claude"],
  PerplexityBot: ["perplexity"],
  "Perplexity-User": ["perplexity"],
  "Google-Extended": ["google", "gemini", "bard"],
  "Applebot-Extended": ["apple"],
  Amazonbot: ["amazon", "alexa"],
  "meta-externalagent": ["meta", "llama"],
  Bytespider: ["bytedance", "doubao"],
  YouBot: ["you.com"],
  "cohere-ai": ["cohere"]
};

const allTrials = db.prepare(
  "SELECT vendor, startedAtMs, windowMs FROM Trial WHERE siteId = ?"
);

/**
 * How many requests matching this agent arrived inside a registered trial
 * window for a vendor the agent could belong to.
 *
 * A count greater than zero does not prove the trial caused the arrival — that
 * is correlation over a time window, the same inference the trials module makes
 * and refuses to store. It is enough to stop the finding claiming discovery.
 */
function promptedCount(siteId, pattern, requestTimesMs) {
  const aliases = AGENT_VENDORS[pattern];
  if (!aliases) return 0;

  const windows = allTrials
    .all(siteId)
    .filter((t) => aliases.some((a) => t.vendor.toLowerCase().includes(a)))
    .map((t) => [t.startedAtMs, t.startedAtMs + t.windowMs]);

  if (windows.length === 0) return 0;

  return requestTimesMs.filter((ms) => windows.some(([a, b]) => ms >= a && ms <= b))
    .length;
}

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
         AND ${notDeclaredOperator("r")}
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

// Addresses this project operates from, declared in stats.js. Imported rather
// than restated: the heuristic below catches an address only once it has sent
// curl, which misses a phone that never will and misses this machine every time
// its IPv6 address rotates.
const DECLARED_SQL = notDeclaredOperator();

const CREDIBLE_AGENT_SQL = `siteId = ? AND cfRay IS NOT NULL AND userAgent LIKE ? AND ${ROUTABLE_SQL} AND ${DECLARED_SQL} AND ${PLAIN_CLIENT_SQL}`;

/**
 * A declared AI crawler seen on this site, counting only requests from
 * addresses that have not also presented a contradictory identity. Arrival is
 * the whole event; nothing is claimed about why it came.
 */
/**
 * What the vendor's own published address list says about requests claiming
 * this agent, counted by request rather than by address.
 *
 * Computed here in JavaScript and never inside a claim's SQL, for the same
 * reason `promptedCount` is: a claim is re-executed against the record by the
 * verifier, and this answer depends on a committed snapshot outside it. The
 * addresses themselves stay verifiable in SQL; what the snapshot says about
 * them is reproducible because the snapshot is in the repository, dated, and
 * the matcher that reads it is published alongside.
 */
function verifyAgainstVendor(siteId, pattern) {
  const rows = db
    .prepare(
      `SELECT cfConnectingIp AS ip, COUNT(*) AS hits
       FROM RequestReality WHERE ${CREDIBLE_AGENT_SQL}
       GROUP BY cfConnectingIp`
    )
    .all(siteId, `%${pattern}%`);

  const tally = { verified: 0, vendorOther: 0, unlisted: 0, unverifiable: 0 };
  const KEY = { verified: "verified", vendor_other: "vendorOther", unlisted: "unlisted" };
  let vendor = null;
  let listUrl = null;
  let reason = null;

  for (const row of rows) {
    const result = classify(pattern, row.ip);
    tally[KEY[result.status] ?? "unverifiable"] += row.hits;
    vendor = vendor ?? result.vendor ?? null;
    listUrl = listUrl ?? result.url ?? null;
    reason = reason ?? (result.status === "unverifiable" ? result.reason : null);
  }

  return { ...tally, vendor, listUrl, reason, snapshot: SNAPSHOT_DATE };
}

/**
 * How many of this agent's requests came from an address that also presented
 * other companies' crawler identities.
 *
 * This is the check that needs nothing published by anyone. Six of the thirteen
 * identities in the 2026-07-26 scan belonged to companies that release no address
 * list, so `unlisted` could say nothing about them — and two of those, ClaudeBot
 * and CCBot, stayed published as genuine arrivals for exactly that reason while
 * the corroborated ones came down. One address cannot be several companies'
 * crawlers, and establishing that requires only the record.
 */
function fromRotatingAddress(siteId, pattern) {
  const rotators = identityRotation(siteId).map((c) => c.facts.ip);
  if (rotators.length === 0) return 0;

  const marks = rotators.map(() => "?").join(",");
  return (
    one(
      `SELECT COUNT(*) FROM RequestReality
       WHERE ${CREDIBLE_AGENT_SQL} AND cfConnectingIp IN (${marks})`,
      [siteId, `%${pattern}%`, ...rotators]
    ) ?? 0
  );
}

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

    const times = db
      .prepare(`SELECT observedAtMs AS ms FROM RequestReality WHERE ${CREDIBLE_AGENT_SQL}`)
      .all(siteId, `%${pattern}%`)
      .map((r) => r.ms);

    const prompted = promptedCount(siteId, pattern, times);
    const verification = verifyAgainstVendor(siteId, pattern);
    const rotating = fromRotatingAddress(siteId, pattern);

    // An arrival we caused is still an observation worth publishing — it is a
    // trial result. What it must not do is wear a headline implying discovery,
    // so the template changes the title rather than this rule dropping the row.
    out.push({
      detectorId: "ai_agent_arrival",
      subjectKey: pattern,
      windowStartMs: row.firstMs,
      windowEndMs: row.lastMs,
      // A partially prompted arrival is a weaker claim than an unprompted one,
      // so it stops being something the engine publishes on its own.
      //
      // An unlisted address is the stronger reason of the two. Saying that a
      // client's declared identity is unsupported by the vendor's own list is
      // the closest this site comes to an accusation, and nothing that reads as
      // an accusation publishes without a person.
      requiresReview: prompted > 0 || verification.unlisted > 0 || rotating > 0,
      // Two of these hold a new finding back. Only the first two withdraw one
      // that is already published, because only they are evidence against what
      // it says; trial overlap is disclosed in the title by design.
      contradicted: verification.unlisted > 0 || rotating > 0,
      // Why it is waiting, in the queue itself. A reviewer who has to re-derive
      // the reason from the body reads the body instead of judging it.
      reviewReason:
        rotating > 0
          ? `${rotating} of ${row.hits} request(s) came from an address that also presented other companies' crawler identities, so this agent name cannot be taken as the client`
          : verification.unlisted > 0
            ? `${verification.unlisted} of ${row.hits} request(s) came from an address ${verification.vendor ?? "the vendor"} does not publish for this crawler — the declared identity is uncorroborated`
            : `${prompted} of ${row.hits} request(s) arrived inside a trial we ran, so part of this may be our own doing`,
      facts: {
        agent: pattern,
        paths: row.paths,
        ips: row.ips,
        prompted,
        rotating,
        hits: row.hits,
        verification
      },
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
       WHERE siteId = ? AND cfConnectingIp IS NOT NULL AND ${DECLARED_SQL}
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
 * One declared identity arriving from many addresses, each of which fetches
 * almost nothing. This is the inverse of automatedEnumeration: that rule groups
 * by address and finds the client that took many paths quickly, so a retrieval
 * spread one-request-per-address is exactly what it cannot see.
 *
 * The shape is fan-out. A byte-identical user agent appears from dozens of
 * distinct addresses across several countries; nearly every address is used
 * once and discarded; between them they walk a large part of the site. No
 * single request looks unusual, which is the point of arranging them that way.
 *
 * The figures below are counts of what arrived. Whether one operator drove
 * them is not established here and the template does not assert it — a common
 * mobile user agent behind carrier NAT can produce the same shape from
 * unrelated people, which is why this detector does not publish itself.
 */
function distributedCrawl(siteId, { minIps = 10, minPaths = 10, maxPerIp = 2 } = {}) {
  const FANOUT = `siteId = ? AND cfRay IS NOT NULL AND userAgent IS NOT NULL
    AND ${ROUTABLE_SQL} AND ${DECLARED_SQL} AND ${PLAIN_CLIENT_SQL}`;

  const rows = db
    .prepare(
      `SELECT userAgent AS ua,
              COUNT(DISTINCT cfConnectingIp) AS ips,
              COUNT(DISTINCT path) AS paths,
              COUNT(DISTINCT cfIpCountry) AS countries,
              COUNT(*) AS hits,
              MIN(observedAtMs) AS firstMs, MAX(observedAtMs) AS lastMs
       FROM RequestReality
       WHERE ${FANOUT}
       GROUP BY userAgent
       HAVING ips >= ? AND paths >= ? AND CAST(hits AS REAL) / ips <= ?`
    )
    .all(siteId, minIps, minPaths, maxPerIp);

  return rows.map((r) => {
    // How many of those addresses were used exactly once. A high share is the
    // part that distinguishes rotation from a handful of busy clients.
    const singles = one(
      `SELECT COUNT(*) FROM (
         SELECT cfConnectingIp FROM RequestReality
         WHERE ${FANOUT} AND userAgent = ?
         GROUP BY cfConnectingIp HAVING COUNT(*) = 1)`,
      [siteId, r.ua]
    );

    return {
      detectorId: "distributed_crawl",
      subjectKey: r.ua,
      windowStartMs: r.firstMs,
      windowEndMs: r.lastMs,
      facts: {
        ua: r.ua,
        ips: r.ips,
        paths: r.paths,
        countries: r.countries,
        hits: r.hits,
        singles,
        hours: Math.max(1, Math.round((r.lastMs - r.firstMs) / 3600000))
      },
      claims: [
        claim(
          "distinct addresses presenting this exact user agent",
          `SELECT COUNT(DISTINCT cfConnectingIp) FROM RequestReality WHERE ${FANOUT} AND userAgent = ?`,
          [siteId, r.ua],
          r.ips
        ),
        claim(
          "distinct paths fetched by them in aggregate",
          `SELECT COUNT(DISTINCT path) FROM RequestReality WHERE ${FANOUT} AND userAgent = ?`,
          [siteId, r.ua],
          r.paths
        ),
        claim(
          "addresses that sent exactly one request",
          `SELECT COUNT(*) FROM (
             SELECT cfConnectingIp FROM RequestReality
             WHERE ${FANOUT} AND userAgent = ?
             GROUP BY cfConnectingIp HAVING COUNT(*) = 1)`,
          [siteId, r.ua],
          singles
        ),
        claim(
          "distinct countries these addresses resolved to",
          `SELECT COUNT(DISTINCT cfIpCountry) FROM RequestReality WHERE ${FANOUT} AND userAgent = ?`,
          [siteId, r.ua],
          r.countries
        )
      ]
    };
  });
}

/**
 * Which hostname each kind of client arrived on.
 *
 * This site answers on two: the apex and the www subdomain, both returning 200
 * for every path, with canonical tags on both pointing at the apex. That was
 * first read as a defect to be closed with a redirect. Measuring it first showed
 * something better — no published figure here is host-sensitive, so nothing was
 * being corrupted, and meanwhile the hostname a client arrives on says something
 * about how it found the site at all.
 *
 * The redirect was therefore not added. It would have made every future arrival
 * look identical and removed the signal along with the untidiness.
 *
 * The canonical hostname is read from the Site row rather than inferred from
 * whichever host happens to be most popular: which name we consider ours is a
 * declaration, and a detector should not derive it from the traffic it is about
 * to describe.
 */
function arrivalHost(siteId, { minAiRequests = 2 } = {}) {
  const canonical = one("SELECT hostname FROM Site WHERE id = ?", [siteId]);
  if (!canonical) return [];

  const SCOPE = `siteId = ? AND cfRay IS NOT NULL AND host IS NOT NULL
    AND ${ROUTABLE_SQL} AND ${DECLARED_SQL} AND ${PLAIN_CLIENT_SQL}`;

  const aiLike = `(${AI_AGENT_PATTERNS.map(() => "userAgent LIKE ?").join(" OR ")})`;
  const aiParams = AI_AGENT_PATTERNS.map((p) => `%${p}%`);

  const hosts = db
    .prepare(`SELECT host, COUNT(*) AS n FROM RequestReality WHERE ${SCOPE} GROUP BY host ORDER BY n DESC`)
    .all(siteId);

  if (hosts.length < 2) return [];

  const aiOnCanonical = one(
    `SELECT COUNT(*) FROM RequestReality WHERE ${SCOPE} AND host = ? AND ${aiLike}`,
    [siteId, canonical, ...aiParams]
  );

  const aiElsewhere = one(
    `SELECT COUNT(*) FROM RequestReality WHERE ${SCOPE} AND host <> ? AND ${aiLike}`,
    [siteId, canonical, ...aiParams]
  );

  // How many of those arrivals happened inside a window in which we had asked a
  // vendor to read a page here.
  //
  // The first version of this rule omitted this and reported seven AI-crawler
  // arrivals, four of which were the Claude trial the operator had run the
  // evening before — traffic this project had already published as its own. The
  // reconciliation existed in newAiAgent and simply was not applied here, which
  // is how a figure can be individually correct and collectively a fiction.
  let promptedOnCanonical = 0;
  for (const pattern of AI_AGENT_PATTERNS) {
    const times = db
      .prepare(
        `SELECT observedAtMs AS ms FROM RequestReality
         WHERE ${SCOPE} AND host = ? AND userAgent LIKE ?`
      )
      .all(siteId, canonical, `%${pattern}%`)
      .map((r) => r.ms);
    promptedOnCanonical += promptedCount(siteId, pattern, times);
  }

  const unpromptedOnCanonical = aiOnCanonical - promptedOnCanonical;

  // Unprompted arrivals are what this finding can speak about, so the threshold
  // applies to those rather than to the raw count.
  if (unpromptedOnCanonical + aiElsewhere < minAiRequests) return [];

  const otherHostRequests = one(
    `SELECT COUNT(*) FROM RequestReality WHERE ${SCOPE} AND host <> ?`,
    [siteId, canonical]
  );

  // The same requests, minus those that share the declared operator's browser
  // language profile. Those are probably our own phone, disclosed on the lab page
  // and deliberately not excluded from totals — but a claim about clients finding
  // an unadvertised hostname should not lean on our own device.
  const otherHostNotOurs = one(
    `SELECT COUNT(*) FROM RequestReality
     WHERE ${SCOPE} AND host <> ? AND NOT (${probablyOperatorLanguage()})`,
    [siteId, canonical]
  );

  const bounds = db
    .prepare(`SELECT MIN(observedAtMs) a, MAX(observedAtMs) b FROM RequestReality WHERE ${SCOPE}`)
    .get(siteId);

  return [
    {
      detectorId: "arrival_host",
      subjectKey: "all",
      windowStartMs: bounds.a,
      windowEndMs: bounds.b,
      // Held for review is not enough on its own — the reviewer sees the prose,
      // and the prose is generated from these facts, so the facts have to carry
      // what would make a reader doubt the headline.
      requiresReview: true,
      facts: {
        canonical,
        hosts,
        aiOnCanonical,
        promptedOnCanonical,
        unpromptedOnCanonical,
        aiElsewhere,
        otherHostRequests,
        otherHostNotOurs
      },
      claims: [
        claim(
          "hostnames that served external traffic",
          `SELECT COUNT(DISTINCT host) FROM RequestReality WHERE ${SCOPE}`,
          [siteId],
          hosts.length
        ),
        claim(
          "external requests on the hostname we never publish",
          `SELECT COUNT(*) FROM RequestReality WHERE ${SCOPE} AND host <> ?`,
          [siteId, canonical],
          otherHostRequests
        ),
        claim(
          "the same requests, excluding clients sharing our own browser language profile",
          `SELECT COUNT(*) FROM RequestReality
           WHERE ${SCOPE} AND host <> ? AND NOT (${probablyOperatorLanguage()})`,
          [siteId, canonical],
          otherHostNotOurs
        ),
        claim(
          `requests declaring a known AI agent, on ${canonical}`,
          `SELECT COUNT(*) FROM RequestReality WHERE ${SCOPE} AND host = ? AND ${aiLike}`,
          [siteId, canonical, ...aiParams],
          aiOnCanonical
        ),
        claim(
          "requests declaring a known AI agent, on any other hostname",
          `SELECT COUNT(*) FROM RequestReality WHERE ${SCOPE} AND host <> ? AND ${aiLike}`,
          [siteId, canonical, ...aiParams],
          aiElsewhere
        )
      ]
    }
  ];
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
       WHERE siteId = ? AND cfConnectingIp IS NOT NULL AND ${DECLARED_SQL}
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
  const PROBE = `siteId = ? AND cfRay IS NOT NULL AND routeVariant LIKE 'probe_%' AND ${ROUTABLE_SQL} AND ${DECLARED_SQL} AND ${PLAIN_CLIENT_SQL}`;

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
  distributedCrawl,
  arrivalHost,
  identityInconsistency,
  jsExecution,
  formatPreference,
  identityRotation
];

/**
 * One address presenting several vendors' crawler identities.
 *
 * Every other detector here treats a user agent as a claim about identity and
 * declines to judge it. This one does not judge it either — it counts something
 * that needs no judgement: **how many mutually exclusive corporate identities
 * arrived from a single address.** Googlebot and GPTBot are operated by
 * different companies from different networks. One address cannot be both.
 *
 * The count is the whole finding. It says nothing about who sent the requests
 * or why, because the record cannot say either, and the vendor check beside it
 * says only what the vendors publish.
 *
 * Written after a scan on 2026-07-26 arrived under thirteen crawler identities
 * in six seconds while requesting `.env`, `.git/config` and `.aws/credentials`.
 * The pipeline at the time had no rule for the shape and published three of
 * those identities as genuine arrivals.
 */
function identityRotation(siteId, { minOwners = 3 } = {}) {
  const patterns = Object.keys(AGENT_OWNER);
  const like = patterns.map(() => "userAgent LIKE ?").join(" OR ");
  const params = patterns.map((p) => `%${p}%`);

  // Counted in SQL: distinct user agent strings, which is all SQL can see. The
  // question that matters — how many separate companies — is resolved below
  // against the declared owner map, because "Googlebot desktop" and "Googlebot
  // smartphone" are two strings and one company, and a rule that could not tell
  // those apart flagged a genuine Google address on its first run.
  const rows = db
    .prepare(
      `SELECT cfConnectingIp AS ip, COUNT(DISTINCT userAgent) AS identities,
              COUNT(*) AS hits, COUNT(DISTINCT path) AS paths,
              MIN(observedAtMs) AS firstMs, MAX(observedAtMs) AS lastMs
       FROM RequestReality
       WHERE siteId = ? AND ${ROUTABLE_SQL} AND ${notDeclaredOperator()}
         AND (${like})
       GROUP BY cfConnectingIp
       HAVING identities >= 2`
    )
    .all(siteId, ...params);

  return rows.flatMap((r) => {
    // Which of those identities the vendor's own published list contradicts.
    const claimed = db
      .prepare(
        `SELECT DISTINCT userAgent AS ua FROM RequestReality
         WHERE siteId = ? AND cfConnectingIp = ? AND (${like})`
      )
      .all(siteId, r.ip, ...params)
      .map((x) => x.ua);

    const agents = [...new Set(
      claimed.flatMap((ua) => patterns.filter((p) => (ua ?? "").includes(p)))
    )];

    const owners = ownersOf(agents);
    if (owners.length < minOwners) return [];

    const unlisted = agents.filter((a) => classify(a, r.ip).status === "unlisted");
    const uncheckable = agents.filter((a) => classify(a, r.ip).status === "unverifiable");

    return [{
      detectorId: "identity_rotation",
      subjectKey: r.ip,
      windowStartMs: r.firstMs,
      windowEndMs: r.lastMs,
      // Always. The counts are solid and the shape is unambiguous, but the
      // sentence a reader will form from it is about someone's conduct, and
      // this site does not publish that without a person reading it first.
      requiresReview: true,
      reviewReason: `one address presented crawler identities belonging to ${owners.length} different companies; ${unlisted.length} of them are contradicted by the vendor's own published address list`,
      facts: {
        ip: r.ip,
        identities: r.identities,
        owners,
        hits: r.hits,
        paths: r.paths,
        agents,
        unlisted,
        uncheckable,
        snapshot: SNAPSHOT_DATE
      },
      claims: [
        claim(
          `distinct crawler identities presented by this one address`,
          `SELECT COUNT(DISTINCT userAgent) FROM RequestReality
           WHERE siteId = ? AND cfConnectingIp = ? AND (${like})`,
          [siteId, r.ip, ...params],
          r.identities
        ),
        claim(
          `requests from this address presenting a crawler identity`,
          `SELECT COUNT(*) FROM RequestReality
           WHERE siteId = ? AND cfConnectingIp = ? AND (${like})`,
          [siteId, r.ip, ...params],
          r.hits
        ),
        // The filter has to match the one the group-by used. Without `(${like})`
        // this counted every path the address took, crawler identity or not,
        // which happens to equal the grouped figure here only because all 90 of
        // its requests carried one. An address that also sent an ordinary browser
        // string would have made the two disagree and failed its own verifier.
        claim(
          `distinct paths this address requested under a crawler identity`,
          `SELECT COUNT(DISTINCT path) FROM RequestReality
           WHERE siteId = ? AND cfConnectingIp = ? AND (${like})`,
          [siteId, r.ip, ...params],
          r.paths
        )
      ]
    }];
  });
}

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
