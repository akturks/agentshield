import db from "./realityDb.js";
import { EXTERNAL } from "./stats.js";
import { classify, SNAPSHOT_DATE } from "./vendors/index.js";
import { AGENT_OWNER } from "./vendors/sources.js";

// Reading habits, computed from visits rather than from requests.
//
// Two rules decide everything here, and both were forced by the record.
//
// A pattern needs repetition across separate visits, not many requests inside
// one. A crawler that arrives once, reads eleven pages and leaves has shown an
// itinerary; the same crawler arriving on six occasions and fetching only
// robots.txt each time has shown a habit. Counting requests conflates them, and
// the conflation always flatters: one busy afternoon becomes a behaviour.
//
// And a habit may only be attributed to an identity the vendor's own address
// list corroborates. On 26 July at 22:09 a single address made 90 requests under
// 13 crawler identities in one minute. Sessionised without a corroboration
// filter, that minute contributes a "visit" to OAI-SearchBot, to GPTBot and to
// ChatGPT-User — and the impostor's itinerary is published as their habit. The
// filter is not caution; without it the output is actively false.
//
// The cost is stated rather than worked around: Anthropic and Common Crawl
// publish no machine-readable list, so no habit can ever be attributed to their
// crawlers here. That is a gap in what can be known, and inventing a weaker test
// to fill it would be inventing the knowledge.

export const PATTERN_VERSION = "pat-1";

// A visit ends after half an hour of silence from the same identity at the same
// address. Chosen to be longer than any pause observed inside a single crawl on
// this site and shorter than the gap between any two returns — a threshold that
// splits differently on a busier site, which is why it is stated here and
// printed beside every figure derived from it.
export const VISIT_GAP_MS = 30 * 60 * 1000;

// Before a habit may be described. Three separate days rather than three visits:
// six visits in one afternoon are one occasion seen six times, and the question
// is whether the crawler does this when it comes back.
export const MIN_VISITS = 3;
export const MIN_DAYS = 3;

const AGENTS = Object.keys(AGENT_OWNER);

const requests = db.prepare(`
  SELECT userAgent, cfConnectingIp AS ip, path, observedAt, observedAtMs
  FROM RequestReality
  WHERE ${EXTERNAL} AND userAgent IS NOT NULL
  ORDER BY userAgent, cfConnectingIp, observedAtMs
`);

/** Which declared crawler name a user agent carries, or null. */
export function agentOf(userAgent) {
  const ua = String(userAgent ?? "");
  return AGENTS.find((a) => ua.includes(a)) ?? null;
}

/**
 * Group requests into visits.
 *
 * Exported and pure so the grouping can be tested on rows that are not the live
 * record — the boundary between one visit and two is where this whole file's
 * arithmetic lives, and it is not something to check by reading.
 */
export function sessionise(rows, { gapMs = VISIT_GAP_MS } = {}) {
  const visits = [];
  let current = null;

  for (const r of rows) {
    const key = `${r.userAgent}|${r.ip}`;
    if (!current || current.key !== key || r.observedAtMs - current.lastMs > gapMs) {
      current = {
        key,
        userAgent: r.userAgent,
        ip: r.ip,
        agent: agentOf(r.userAgent),
        startMs: r.observedAtMs,
        lastMs: r.observedAtMs,
        day: String(r.observedAt).slice(0, 10),
        paths: []
      };
      visits.push(current);
    }
    current.paths.push(r.path);
    current.lastMs = r.observedAtMs;
  }

  return visits;
}

const share = (part, whole) => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10);

/**
 * What each corroborated crawler identity did, per visit.
 *
 * `attributable` is the whole answer for most agents and says why not: an
 * identity whose vendor publishes nothing cannot be separated from anyone
 * sending the same string, so it gets counts and no habits.
 */
export function habits() {
  const visits = sessionise(requests.all()).filter((v) => v.agent);

  const byAgent = new Map();

  for (const v of visits) {
    // The declared agent name, not the whole user agent string. `classify` looks
    // its list up by name, and a full `Mozilla/5.0 (compatible; GPTBot/1.2…)`
    // matches nothing — every identity comes back unverifiable, every habit
    // disappears, and the output looks like a cautious instrument rather than a
    // broken call.
    const corroboration = classify(v.agent, v.ip)?.status ?? "unverifiable";
    const entry = byAgent.get(v.agent) ?? {
      agent: v.agent,
      vendor: AGENT_OWNER[v.agent],
      visits: 0,
      corroboratedVisits: [],
      uncorroboratedVisits: 0
    };

    entry.visits += 1;
    if (corroboration === "verified" || corroboration === "vendor_other")
      entry.corroboratedVisits.push(v);
    else entry.uncorroboratedVisits += 1;

    byAgent.set(v.agent, entry);
  }

  return [...byAgent.values()]
    .map((e) => {
      const list = e.corroboratedVisits;
      const days = new Set(list.map((v) => v.day));
      const addresses = new Set(list.map((v) => v.ip));

      const entryPaths = new Map();
      for (const v of list) entryPaths.set(v.paths[0], (entryPaths.get(v.paths[0]) ?? 0) + 1);

      const onlyOnePath = list.filter((v) => new Set(v.paths).size === 1);
      const soleTargets = new Map();
      for (const v of onlyOnePath) soleTargets.set(v.paths[0], (soleTargets.get(v.paths[0]) ?? 0) + 1);

      const enough = list.length >= MIN_VISITS && days.size >= MIN_DAYS;

      return {
        agent: e.agent,
        vendor: e.vendor,
        totalVisits: e.visits,
        uncorroboratedVisits: e.uncorroboratedVisits,
        corroboratedVisits: list.length,
        days: days.size,
        addresses: addresses.size,
        // Null rather than a number when the vendor publishes nothing to check
        // against. A zero here would read as "it never came".
        attributable: list.length > 0,
        describable: enough,
        needs: enough ? null : `${MIN_VISITS} corroborated visits on ${MIN_DAYS} separate days`,
        entryPaths: [...entryPaths.entries()]
          .map(([path, n]) => ({ path, visits: n, share: share(n, list.length) }))
          .sort((a, b) => b.visits - a.visits),
        singlePathVisits: onlyOnePath.length,
        singlePathShare: share(onlyOnePath.length, list.length),
        soleTargets: [...soleTargets.entries()]
          .map(([path, n]) => ({ path, visits: n, share: share(n, list.length) }))
          .sort((a, b) => b.visits - a.visits),
        medianPaths: list.length
          ? [...list.map((v) => v.paths.length)].sort((a, b) => a - b)[Math.floor(list.length / 2)]
          : 0,
        snapshot: SNAPSHOT_DATE,
        patternVersion: PATTERN_VERSION
      };
    })
    .sort((a, b) => b.corroboratedVisits - a.corroboratedVisits);
}
