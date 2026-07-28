import { randomUUID, createHash } from "node:crypto";

import db from "../realityDb.js";
import { POPULATION, sample } from "./population.js";

// Reading other people's robots.txt, once each, and writing down exactly what
// came back.
//
// This site spends its time recording what crawlers do to it. Going out and
// fetching four hundred strangers' files makes it, briefly, the other kind of
// party — so the terms are declared before the first request rather than
// defended afterwards:
//
//   * one request per domain per run, for the one file that exists to be
//     fetched by automated clients;
//   * a user agent that names the project and links to a page explaining the
//     survey, so anyone reading their logs can find out what this was;
//   * a real interval between requests, even though no single host is ever
//     asked twice;
//   * no cookies, no JavaScript, nothing followed beyond the file itself.
//
// Nothing is judged here. The body is stored verbatim and every question about
// it is asked later, over the stored bytes.

export const FETCH_VERSION = "survey-1";

export const USER_AGENT =
  "AgentShieldObservatory/0.1 (+https://agentshieldaidefense.com/survey)";

export const MIN_INTERVAL_MS = 1500;
export const MAX_CONCURRENT = 4;
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 262144; // a robots.txt this large is itself the finding

// Where the survey runs from, and why the field exists at all.
//
// Reachability is not a property of a domain. It is a property of a domain seen
// from a place, and this place filters: of the first eight domains ever fetched,
// two answered with a connection reset and did not resolve in DNS — the
// signature of national blocking, not of a site being down. Nothing in the
// fetcher can tell those apart, and nothing should try. Recording the vantage
// point is what keeps "unreachable from Istanbul" from being published as
// "unreachable".
export const VANTAGE_POINT =
  process.env.SURVEY_VANTAGE_POINT ?? "TR, residential fixed line, no VPN or proxy";

const insertSurvey = db.prepare(`
  INSERT INTO RobotsSurvey (id, declaredAt, populationId, populationUrl, sampleRule,
    sampleSize, userAgent, minIntervalMs, maxConcurrent, vantagePoint, startedAt, fetchVersion)
  VALUES (@id, @declaredAt, @populationId, @populationUrl, @sampleRule,
    @sampleSize, @userAgent, @minIntervalMs, @maxConcurrent, @vantagePoint, @startedAt, @fetchVersion)
`);

const finishSurvey = db.prepare(`UPDATE RobotsSurvey SET finishedAt = ? WHERE id = ?`);

const insertObservation = db.prepare(`
  INSERT INTO RobotsObservation (id, surveyId, domain, rank, requestedUrl, requestedAt,
    requestedAtMs, finalUrl, redirects, httpStatus, contentType, bodyBytes, body,
    bodySha256, headersJson, elapsedMs, errorCode, errorMessage, fetchVersion)
  VALUES (@id, @surveyId, @domain, @rank, @requestedUrl, @requestedAt,
    @requestedAtMs, @finalUrl, @redirects, @httpStatus, @contentType, @bodyBytes, @body,
    @bodySha256, @headersJson, @elapsedMs, @errorCode, @errorMessage, @fetchVersion)
`);

/**
 * Declare a run before making a single request.
 *
 * The row is written first so the description of the survey cannot be adjusted
 * once its results are visible. A method chosen after the fact is not a method.
 */
export function declareSurvey({ size = POPULATION.size } = {}) {
  const id = randomUUID();
  const now = new Date().toISOString();

  insertSurvey.run({
    id,
    declaredAt: now,
    populationId: POPULATION.id,
    populationUrl: POPULATION.url,
    sampleRule: POPULATION.rule,
    sampleSize: size,
    userAgent: USER_AGENT,
    minIntervalMs: MIN_INTERVAL_MS,
    maxConcurrent: MAX_CONCURRENT,
    vantagePoint: VANTAGE_POINT,
    startedAt: now,
    fetchVersion: FETCH_VERSION
  });

  return id;
}

/**
 * One domain, one attempt.
 *
 * Redirects are followed by hand rather than by `redirect: "follow"` so the hop
 * count and the URL that actually answered are both recorded. Where a chain ends
 * matters: a robots.txt that redirects to a login page and a robots.txt that
 * redirects to the apex are different observations, and `follow` hides both
 * behind a 200.
 */
export async function fetchOne(domain) {
  const requestedUrl = `https://${domain}/robots.txt`;
  const startedMs = Date.now();
  const started = process.hrtime.bigint();

  const base = {
    requestedUrl,
    requestedAt: new Date(startedMs).toISOString(),
    requestedAtMs: startedMs,
    finalUrl: null,
    redirects: 0,
    httpStatus: null,
    contentType: null,
    bodyBytes: null,
    body: null,
    bodySha256: null,
    headersJson: null,
    errorCode: null,
    errorMessage: null
  };

  let url = requestedUrl;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: "text/plain,*/*;q=0.8" },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location && hop < MAX_REDIRECTS) {
        url = new URL(location, url).toString();
        base.redirects = hop + 1;
        continue;
      }

      // A body far past any plausible robots.txt is truncated rather than
      // refused: that it was enormous is itself an observation, and the first
      // quarter-megabyte answers every question this survey asks.
      const buffer = Buffer.from(await response.arrayBuffer());
      const kept = buffer.subarray(0, MAX_BODY_BYTES);

      base.finalUrl = url;
      base.httpStatus = response.status;
      base.contentType = response.headers.get("content-type");
      base.bodyBytes = buffer.byteLength;
      base.body = kept.toString("utf8");
      base.bodySha256 = createHash("sha256").update(buffer).digest("hex");
      base.headersJson = JSON.stringify(Object.fromEntries(response.headers));
      break;
    }
  } catch (error) {
    // Whatever the runtime called it, verbatim. Sorting failures into kinds is
    // a judgement, and it is made later where it can be revised.
    base.errorCode = error?.cause?.code ?? error?.code ?? error?.name ?? "unknown";
    base.errorMessage = String(error?.message ?? error).slice(0, 500);
  }

  base.elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  return base;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run the declared sample.
 *
 * `onProgress` is called after each observation so a long run reports itself
 * rather than going quiet for a quarter of an hour.
 */
export async function runSurvey({ surveyId, limit = Infinity, onProgress } = {}) {
  const id = surveyId ?? declareSurvey();
  const targets = sample().slice(0, limit === Infinity ? undefined : limit);

  let next = 0;
  let lastStart = 0;
  let done = 0;

  async function worker() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= targets.length) return;

      // Claim the slot before yielding. Reading `lastStart`, awaiting, and then
      // writing it lets all four workers read the same value and start together
      // — the declared interval becomes an interval between batches, and the
      // stated rate is four times the real one. Nothing awaits between these
      // two lines, so the reservation is atomic.
      const now = Date.now();
      const scheduled = Math.max(now, lastStart + MIN_INTERVAL_MS);
      lastStart = scheduled;
      if (scheduled > now) await sleep(scheduled - now);

      const target = targets[index];
      const observation = await fetchOne(target.domain);

      insertObservation.run({
        id: randomUUID(),
        surveyId: id,
        domain: target.domain,
        rank: target.rank,
        fetchVersion: FETCH_VERSION,
        ...observation
      });

      done += 1;
      onProgress?.({ done, total: targets.length, target, observation });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT, targets.length) }, worker)
  );

  finishSurvey.run(new Date().toISOString(), id);
  return { surveyId: id, observed: done };
}
