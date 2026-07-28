import { randomUUID, createHash } from "node:crypto";

import db from "../realityDb.js";
import { PRIMARY_HOSTNAME } from "../migrate.js";

// The site reading itself back, from inside and from outside.
//
// Every other reality table here records what arrived. This one records what a
// stranger receives, which is a different question and was a different answer:
// the edge served a robots.txt telling nine AI crawlers to stay away, over an
// origin file that welcomes them by name, and the published finding about it has
// to say that when it started is unknowable — because nothing was watching the
// outside of this site.
//
// Two requests, one sweep. Both are real HTTP, so whatever the response path
// adds on the way out is present in both and cancels; only the CDN's own work
// remains in the difference.

export const SENSOR_VERSION = "self-1";

export const USER_AGENT =
  "AgentShieldSelfSensor/0.1 (+https://agentshieldaidefense.com/status)";

// The files that state this site's terms to an automated client. All three are
// small, served to anyone, and answer a question about permission rather than
// content — which is what makes a difference between the two vantages worth
// recording rather than merely interesting.
//
// Stage one was `/robots.txt` alone, because that is the file that produced the
// problem and a sensor watching everything before it works on anything produces
// noise nobody reads. It worked, so the other two follow.
//
// `/sitemap.xml` carries a `<lastmod>` derived from today's date, so its bytes
// change once a day at midnight UTC by this site's own doing. That is left in
// rather than special-cased: the change is real, and a detector that cannot
// distinguish it from a rewrite is a detector that is not ready, which is a
// better thing to learn from the record than from an exception in a list.
export const WATCHED = [
  "/robots.txt",
  "/llms.txt",
  "/sitemap.xml",
  "/",
  "/about",
  "/lab",
  "/findings",
  "/constitution"
];

const ORIGIN_BASE = `http://127.0.0.1:${process.env.PUBLIC_SITE_PORT ?? 8080}`;
const EDGE_BASE = `https://${PRIMARY_HOSTNAME}`;
const TIMEOUT_MS = 15000;

const insert = db.prepare(`
  INSERT INTO SelfObservation (id, runId, path, vantage, requestedUrl, observedAt,
    observedAtMs, httpStatus, contentType, bodyBytes, body, bodySha256, headersJson,
    elapsedMs, errorCode, errorMessage, sensorVersion)
  VALUES (@id, @runId, @path, @vantage, @requestedUrl, @observedAt,
    @observedAtMs, @httpStatus, @contentType, @bodyBytes, @body, @bodySha256, @headersJson,
    @elapsedMs, @errorCode, @errorMessage, @sensorVersion)
`);

/**
 * One request, recorded whatever happens.
 *
 * A failure is an observation. "The edge did not answer at 10:00" is a fact
 * about this site's availability to the outside, and dropping it would leave a
 * gap indistinguishable from a sweep that never ran.
 */
async function observe(url, { host } = {}) {
  const startedMs = Date.now();
  const started = process.hrtime.bigint();

  const row = {
    requestedUrl: url,
    observedAt: new Date(startedMs).toISOString(),
    observedAtMs: startedMs,
    httpStatus: null,
    contentType: null,
    bodyBytes: null,
    body: null,
    bodySha256: null,
    headersJson: null,
    errorCode: null,
    errorMessage: null
  };

  try {
    const response = await fetch(url, {
      // Not `follow`. A redirect is a difference between the two vantages worth
      // seeing rather than resolving away.
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/plain,*/*;q=0.8",
        // The origin is reached by address, so it is told which name it is being
        // asked for. Without this the two requests differ in something of ours.
        ...(host ? { host } : {})
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    row.httpStatus = response.status;
    row.contentType = response.headers.get("content-type");
    row.bodyBytes = buffer.byteLength;
    row.body = buffer.toString("utf8");
    row.bodySha256 = createHash("sha256").update(buffer).digest("hex");
    row.headersJson = JSON.stringify(Object.fromEntries(response.headers));
  } catch (error) {
    row.errorCode = error?.cause?.code ?? error?.code ?? error?.name ?? "unknown";
    row.errorMessage = String(error?.message ?? error).slice(0, 500);
  }

  row.elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  return row;
}

/**
 * One sweep: every watched path, with the edge fetch bracketed by two origin
 * fetches.
 *
 * The bracket is the whole design, and it exists because a page is not simply
 * static or dynamic. Measured on 28 July: `/lab` differs from itself on every
 * request, `/about` never does, and `/` differs only when traffic arrived in
 * between — so stability is a property of the moment rather than of the page,
 * and both a hardcoded list and a one-off measurement would be wrong.
 *
 * Fetching origin, then edge, then origin again answers it per sweep. If the two
 * origin responses match, nothing about the page moved while the edge was being
 * asked, and comparing their bytes to the edge's means something. If they do not
 * match, the page changed under the measurement, and an exact-byte comparison
 * would report the site's own counters as an intervention.
 *
 * Running all three in parallel would be worse and looks better: the two origin
 * fetches would land in the same instant, agree, and certify a window they never
 * spanned.
 */
export async function sweep({ paths = WATCHED } = {}) {
  const runId = randomUUID();
  const written = [];

  for (const path of paths) {
    const origin = await observe(`${ORIGIN_BASE}${path}`, { host: PRIMARY_HOSTNAME });
    const edge = await observe(`${EDGE_BASE}${path}`);
    const originAfter = await observe(`${ORIGIN_BASE}${path}`, { host: PRIMARY_HOSTNAME });

    for (const [vantage, row] of [
      ["origin", origin],
      ["edge", edge],
      ["origin_after", originAfter]
    ]) {
      insert.run({
        id: randomUUID(),
        runId,
        path,
        vantage,
        sensorVersion: SENSOR_VERSION,
        ...row
      });
      written.push({ path, vantage, ...row });
    }
  }

  return { runId, observations: written };
}
