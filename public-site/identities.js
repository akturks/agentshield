import db from "./realityDb.js";
import { EXTERNAL } from "./stats.js";
import { classify, SNAPSHOT_DATE } from "./vendors/index.js";
import { AI_AGENT_PATTERNS } from "./findings/detectors.js";

// One definition of "how far is this declared identity corroborated".
//
// Three pages need this figure — the home page as a headline, /lab as a table,
// and each weekly report as a slice — and by the time the third one wanted it
// there were already two implementations that could drift apart. A site whose
// front page and detail page disagree about the same number has published two
// claims and can defend neither, so the query lives here and nowhere else.
//
// This mirrors the rule that already governs `EXTERNAL` in stats.js, where an
// integrity check fails if the operator clause is restated by hand anywhere.
//
// Classification runs against a dated snapshot of each vendor's published ranges,
// never a live fetch, so any figure derived from it reproduces. Against a live
// list the same request verifies today and fails next month with no way to tell
// which answer was right.

/**
 * Declared AI-crawler identities, tallied against the vendors' own address lists.
 *
 * @param {{from?: number, to?: number}} window epoch ms, half-open [from, to).
 *   Omit both for the whole record.
 *
 * Four outcomes, and only one of them is evidence against a client:
 *  - `verified`      the address is inside the list the vendor publishes for it
 *  - `vendor_other`  a different range belonging to the same vendor
 *  - `unlisted`      the vendor publishes a list and this address is not on it
 *  - `unverifiable`  no published list exists to check against
 *
 * `unverifiable` is a gap in a vendor's publishing and never an accusation:
 * Anthropic and Common Crawl publish nothing machine-readable, so every one of
 * their agents lands there however genuine it is.
 */
export function declaredIdentities({ from = null, to = null } = {}) {
  const bounded = from !== null && to !== null;
  const clause = bounded ? "AND observedAtMs >= ? AND observedAtMs < ?" : "";
  const bounds = bounded ? [from, to] : [];

  const totals = { verified: 0, vendor_other: 0, unlisted: 0, unverifiable: 0 };
  const byAgent = [];
  let requests = 0;

  for (const pattern of AI_AGENT_PATTERNS) {
    const rows = db
      .prepare(
        `SELECT cfConnectingIp AS ip, COUNT(*) AS hits
         FROM RequestReality
         WHERE ${EXTERNAL} ${clause} AND userAgent LIKE ?
         GROUP BY cfConnectingIp`
      )
      .all(...bounds, `%${pattern}%`);

    if (rows.length === 0) continue;

    const tally = { verified: 0, vendor_other: 0, unlisted: 0, unverifiable: 0 };
    let hits = 0;

    for (const row of rows) {
      const status = classify(pattern, row.ip).status;
      tally[status] += row.hits;
      totals[status] += row.hits;
      hits += row.hits;
      requests += row.hits;
    }

    byAgent.push({ pattern, hits, addresses: rows.length, ...tally });
  }

  byAgent.sort((a, b) => b.hits - a.hits);

  return { requests, ...totals, byAgent, snapshot: SNAPSHOT_DATE };
}
