import db from "./realityDb.js";
import { EXTERNAL, notOperator } from "./stats.js";

// Statements that have survived every chance the record gave them to be false.
//
// This is the layer the roadmap calls Knowledge, and it is built before it has
// anything to hold — deliberately. Its input is completed experiments and there
// are none, so an unguarded version of this page would be an empty container
// waiting to be filled with whatever sounded reasonable later. Building the
// guard first is cheaper than removing a plausible sentence afterwards.
//
// The guard is one idea. **Every statement prints how many opportunities the
// record gave it to be false.** "No external client has executed the script" is
// nearly worthless across five page views and is a finding across five thousand,
// and the sentence reads identically either way — so the sentence never appears
// without the number, and below a declared minimum it is not called knowledge at
// all.
//
// Everything here is negative: *no X has done Y*. That is what early knowledge
// looks like and it is the honest shape. A negative statement is also the only
// kind that a single observation can destroy, which is what makes each one worth
// keeping — every entry names the one thing that would end it, and the count of
// that thing is computed on every read. Nothing has to be remembered.

export const KNOWLEDGE_VERSION = "kno-1";

const count = (sql, params = []) => {
  const row = db.prepare(sql).get(...params);
  return row ? Number(Object.values(row)[0]) : 0;
};

const BRACKETED = `
  SELECT runId, path FROM SelfObservation WHERE errorCode IS NULL
  GROUP BY runId, path
  HAVING COUNT(DISTINCT vantage) = 3
     AND COUNT(DISTINCT CASE WHEN vantage LIKE 'origin%' THEN bodySha256 END) = 1`;

const OPENAI_AUTOMATED = `userAgent LIKE '%OAI-SearchBot%' OR userAgent LIKE '%GPTBot%'`;
const ROTATING = "45.45.237.206";
const DESCRIPTIVE = `path IN ('/robots.txt', '/sitemap.xml', '/llms.txt', '/favicon.ico')`;

/**
 * Each statement, what would end it, and how many chances the record has given
 * it to be ended.
 *
 * `minimum` is the point below which the statement is reported as untested
 * rather than as knowledge. The numbers are modest and are not power
 * calculations; they are the point below which repeating the sentence would be
 * misleading on its face.
 */
export const STATEMENTS = [
  {
    id: "edge-matches-origin",
    claim:
      "The bytes a stranger receives for a watched file have been the bytes this server sent.",
    endedBy: "one sweep where the origin held still and the edge delivered something else",
    minimum: 100,
    opportunities: () => count(`SELECT COUNT(*) AS n FROM (${BRACKETED})`),
    counterexamples: () =>
      count(
        `SELECT COUNT(*) AS n FROM (
           SELECT runId, path FROM SelfObservation WHERE errorCode IS NULL
           GROUP BY runId, path
           HAVING COUNT(DISTINCT vantage) = 3
              AND COUNT(DISTINCT CASE WHEN vantage LIKE 'origin%' THEN bodySha256 END) = 1
              AND COUNT(DISTINCT bodySha256) > 1)`
      ),
    unit: "bracketed sweeps"
  },
  {
    id: "openai-automated-reads-no-content",
    claim:
      "No request corroborated as one of OpenAI's automated crawlers has asked for a page of this site's content.",
    endedBy: "one such request to a path that is not robots.txt, sitemap.xml, llms.txt or favicon.ico",
    minimum: 50,
    // The rotating address is excluded here for the same reason it is excluded
    // in F-006: it presented thirteen companies' identities in a minute, and
    // counting it would answer a question about that address rather than about
    // OpenAI's crawlers.
    opportunities: () =>
      count(
        `SELECT COUNT(*) AS n FROM RequestReality
         WHERE ${EXTERNAL} AND (${OPENAI_AUTOMATED}) AND cfConnectingIp <> ?`,
        [ROTATING]
      ),
    counterexamples: () =>
      count(
        `SELECT COUNT(*) AS n FROM RequestReality
         WHERE ${EXTERNAL} AND (${OPENAI_AUTOMATED}) AND cfConnectingIp <> ?
           AND NOT (${DESCRIPTIVE})`,
        [ROTATING]
      ),
    unit: "corroborated requests"
  },
  {
    id: "no-script-execution",
    claim: "No external client has executed the script on the probe page.",
    endedBy: "one beacon request from a client that is not the operator",
    minimum: 200,
    opportunities: () =>
      count(`SELECT COUNT(*) AS n FROM RequestReality WHERE ${EXTERNAL} AND path = '/probe/js'`),
    // Filtered. The unfiltered table holds two beacons and both are operator
    // test clients — a figure that once reached a headline function on this site
    // and was never rendered only by luck.
    counterexamples: () =>
      count(
        `SELECT COUNT(*) AS n FROM JsExecution j JOIN RequestReality r ON r.id = j.requestId
         WHERE r.cfRay IS NOT NULL AND ${notOperator("r")}`
      ),
    unit: "views of the probe page"
  },
  {
    id: "no-ingestion",
    claim: "Nothing published here has been observed in a language model's output.",
    endedBy: "one published marker appearing in a model's answer",
    minimum: 1,
    opportunities: () => count(`SELECT COUNT(*) AS n FROM CanaryToken`),
    // Stated, not queried. No column holds this and none should: a sighting is
    // an observation made outside this system, and a query that appeared to
    // answer it would be answering something else.
    counterexamples: () => 0,
    unit: "markers published"
  },
  {
    id: "no-disallowed-fetch",
    claim: "No client has fetched a path this site's robots.txt asks clients to leave alone.",
    endedBy: "one request to a disallowed path",
    minimum: 500,
    opportunities: () =>
      count(`SELECT COUNT(*) AS n FROM RequestReality WHERE ${EXTERNAL}`),
    counterexamples: () =>
      count(
        `SELECT COUNT(*) AS n FROM RequestReality WHERE ${EXTERNAL}
         AND (path LIKE '/internal/%' OR path LIKE '/no-crawl/%' OR path LIKE '/private-preview/%')`
      ),
    unit: "external requests"
  },
  {
    id: "injection-contradicts-nobody",
    claim:
      "Among surveyed sites whose robots.txt carries a CDN-inserted block, none names an AI crawler in its own text that the block refuses.",
    endedBy: "one surveyed file whose own section allows a crawler the inserted block disallows",
    minimum: 100,
    opportunities: () =>
      count(`SELECT COUNT(*) AS n FROM RobotsObservation WHERE body LIKE '%Cloudflare Managed%'`),
    // Computed the same way the survey page computes it, over the stored bodies.
    // Zero today; the query is the one that would stop being zero.
    counterexamples: () =>
      count(
        `SELECT COUNT(*) AS n FROM RobotsObservation
         WHERE body LIKE '%Cloudflare Managed%' AND (
           substr(body, 1, instr(body, '# BEGIN Cloudflare Managed content') - 1)
           || substr(body, instr(body, '# BEGIN Cloudflare Managed content') + 501)
         ) LIKE '%GPTBot%'`
      ),
    unit: "surveyed files carrying a block"
  }
];

/**
 * Where each statement stands right now.
 *
 * Three states. `ended` is the one that matters: a statement the record has
 * stopped supporting disappears from the knowledge column by itself, on the next
 * page load, without anyone remembering to remove it.
 */
export function knowledge() {
  return STATEMENTS.map((s) => {
    const opportunities = s.opportunities();
    const counterexamples = s.counterexamples();

    const state =
      counterexamples > 0 ? "ended" : opportunities >= s.minimum ? "holding" : "untested";

    return {
      id: s.id,
      claim: s.claim,
      endedBy: s.endedBy,
      unit: s.unit,
      minimum: s.minimum,
      opportunities,
      counterexamples,
      state,
      version: KNOWLEDGE_VERSION
    };
  });
}
