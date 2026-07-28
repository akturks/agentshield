import db from "./realityDb.js";
import { EXTERNAL } from "./stats.js";
import { classify } from "./vendors/index.js";
import { agentOf } from "./patterns.js";

// The distance between being crawled and being answered with.
//
// Four days of this record show a company's crawler arriving on a schedule while
// the same company's assistant, asked about this site by name, returns six other
// projects called AgentShield. Both of those are true at once, and until this
// file existed the site could measure the first and had no place to put the
// second.
//
// The ladder below is deliberately split in two, and the split is the point.
//
// The rungs this site can climb by observation are computed from requests that
// arrived here. The rungs above them cannot be: whether a page sits in an index,
// or whether a model's answer drew on it, happens inside somebody else's system
// and is knowable only if that party says so. A search console reporting that a
// page is indexed is a vendor's account of its own index — the same class of
// evidence this project refuses when a model describes what it has read.
//
// So those rungs are recorded as **reports**, with who said it and when, and are
// never counted as observations. The one exception is the last rung, which is
// observable: a coined marker appearing in a model's output is evidence, because
// the string exists in exactly one place and nobody has to be believed.

export const DISCOVERY_VERSION = "dsc-1";

const first = (sql, params = []) => db.prepare(sql).get(...params) ?? null;

/**
 * The earliest corroborated arrival, and the earliest corroborated fetch of
 * something that is not a rules or index file.
 *
 * Corroboration is checked in JavaScript because the address test is a CIDR
 * match against a dated snapshot. Without it the first "arrival" on this record
 * would be the impostor that presented thirteen identities in a minute.
 */
function corroboratedFirsts() {
  const rows = db
    .prepare(
      `SELECT userAgent, cfConnectingIp AS ip, path, observedAt, observedAtMs
       FROM RequestReality WHERE ${EXTERNAL} AND userAgent IS NOT NULL
       ORDER BY observedAtMs`
    )
    .all();

  const DESCRIPTIVE = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt", "/favicon.ico"]);

  let arrival = null;
  let content = null;

  for (const r of rows) {
    const agent = agentOf(r.userAgent);
    if (!agent) continue;

    const status = classify(agent, r.ip)?.status;
    if (status !== "verified" && status !== "vendor_other") continue;

    arrival ??= { at: r.observedAt, agent, path: r.path };
    if (!content && !DESCRIPTIVE.has(r.path)) content = { at: r.observedAt, agent, path: r.path };
    if (arrival && content) break;
  }

  return { arrival, content };
}

/**
 * Things a third party told us, kept apart from things we saw.
 *
 * Each carries who reported it and when we were told, because that is all a
 * report is. Nothing here may be cited as evidence, and the page that renders it
 * says so — a vendor's statement about its own index is exactly the class this
 * project declines everywhere else.
 */
export const REPORTS = [
  {
    id: "google-index",
    rung: "Present in a search index",
    reportedBy: "Google Search Console, URL inspection of the home page",
    reportedAt: "2026-07-28",
    says: "URL is on Google — page is indexed",
    note: "A statement by the party that runs the index. It is recorded because it is the only way to know, and it is not evidence."
  },
  {
    id: "assistant-retrieval",
    rung: "Returned by an assistant asked about this site",
    reportedBy: "ChatGPT, asked on 2026-07-28 about this domain",
    reportedAt: "2026-07-28",
    says: "Returned six other projects named AgentShield; this site was not among them",
    note: "The same session cited agentshield.ai carrying utm_source=chatgpt.com, so the assistant's fetching worked. What it did not do was resolve this name to this site."
  }
];

/**
 * The ladder, rung by rung.
 *
 * `observed` rungs come from this record. `reported` rungs come from somebody
 * else and are labelled. A rung nobody has reached prints as not reached, which
 * on a four-day record is most of them.
 */
export function ladder() {
  const anyRequest = first(
    `SELECT observedAt, userAgent FROM RequestReality WHERE ${EXTERNAL} ORDER BY observedAtMs LIMIT 1`
  );
  const { arrival, content } = corroboratedFirsts();
  const markers = first(`SELECT COUNT(*) AS n FROM CanaryToken`);

  return {
    version: DISCOVERY_VERSION,
    rungs: [
      {
        id: "any-arrival",
        rung: "Reached by anything at all",
        kind: "observed",
        at: anyRequest?.observedAt ?? null,
        detail: anyRequest ? `first request, ${String(anyRequest.userAgent ?? "no user agent").slice(0, 60)}` : null
      },
      {
        id: "crawler-arrival",
        rung: "Reached by an AI crawler its vendor's address list corroborates",
        kind: "observed",
        at: arrival?.at ?? null,
        detail: arrival ? `${arrival.agent} requested ${arrival.path}` : null
      },
      {
        id: "content-read",
        rung: "A page of content fetched by a corroborated AI client",
        kind: "observed",
        at: content?.at ?? null,
        detail: content ? `${content.agent} requested ${content.path}` : null
      },
      ...REPORTS.map((r) => ({
        id: r.id,
        rung: r.rung,
        kind: "reported",
        at: r.reportedAt,
        detail: `${r.says} — ${r.reportedBy}`,
        note: r.note
      })),
      {
        id: "marker-in-output",
        rung: "A marker published here observed in a model's output",
        kind: "observed",
        at: null,
        detail: `${markers?.n ?? 0} markers published, none seen. This rung is observable rather than reported: the string exists in one place, so nobody has to be believed.`
      }
    ]
  };
}
