import { randomBytes, randomUUID } from "node:crypto";
import { notOperator } from "../stats.js";
import db, { SITE_ID } from "../realityDb.js";
import { SITE_ORIGIN } from "../layout.js";

// IndexNow tells participating search indexes that a URL exists or changed.
// Bing and Yandex consume it, and Bing's index is what several assistants query
// while answering — so this is the shortest legitimate path from publishing
// something to an AI system being able to find it.
//
// Nothing here manipulates ranking or disguises anything. It announces URLs that
// are already public and already in the sitemap.
//
// Each announcement is recorded. The interval between telling an index a page
// exists and observing that index fetch it is a number this site is positioned
// to measure and nobody publishes.

const HOST = new URL(SITE_ORIGIN).host;

const getConfig = db.prepare("SELECT value FROM Config WHERE key = ?");
const setConfig = db.prepare(`
  INSERT INTO Config (key, value, updatedAt) VALUES (@key, @value, @updatedAt)
  ON CONFLICT(key) DO UPDATE SET value = @value, updatedAt = @updatedAt
`);

/** The key is stable once minted: rotating it invalidates the hosted key file. */
export function indexNowKey() {
  const existing = getConfig.get("indexnow_key");
  if (existing) return existing.value;

  const key = randomBytes(16).toString("hex");
  setConfig.run({ key: "indexnow_key", value: key, updatedAt: new Date().toISOString() });
  console.log(`[indexnow] minted key ${key}`);
  return key;
}

const recordSubmission = db.prepare(`
  INSERT INTO IndexSubmission (id, siteId, service, url, submittedAt, submittedAtMs, httpStatus, note)
  VALUES (@id, @siteId, @service, @url, @submittedAt, @submittedAtMs, @httpStatus, @note)
`);

/**
 * Announces a batch of URLs. Returns the HTTP status IndexNow replied with —
 * 200 or 202 means accepted, and anything else is recorded verbatim rather than
 * retried, because a failed announcement is also information.
 */
export async function submit(urls, { service = "indexnow" } = {}) {
  const list = [...new Set(urls)].filter((u) => u.startsWith(SITE_ORIGIN));
  if (list.length === 0) return { ok: false, status: null, count: 0, reason: "no urls" };

  const key = indexNowKey();
  const body = {
    host: HOST,
    key,
    keyLocation: `${SITE_ORIGIN}/${key}.txt`,
    urlList: list
  };

  let status = null;
  let note = null;

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });
    status = res.status;
    if (!res.ok) note = (await res.text()).slice(0, 200);
  } catch (err) {
    note = err.message.slice(0, 200);
  }

  const at = new Date();
  for (const url of list) {
    recordSubmission.run({
      id: randomUUID(),
      siteId: SITE_ID,
      service,
      url,
      submittedAt: at.toISOString(),
      submittedAtMs: at.getTime(),
      httpStatus: status,
      note
    });
  }

  return { ok: status === 200 || status === 202, status, count: list.length, note };
}

/** Announces one page. Used when a finding is published. */
export async function submitOne(path) {
  return submit([`${SITE_ORIGIN}${path}`]);
}

const submittedUrls = db.prepare(
  "SELECT DISTINCT url FROM IndexSubmission WHERE siteId = ?"
);

export function alreadySubmitted() {
  return new Set(submittedUrls.all(SITE_ID).map((r) => r.url));
}

/**
 * How long after announcing a URL it was first fetched by something other than
 * us. Empty until an index acts on the announcement — which is the point.
 */
export function submissionOutcomes() {
  return db
    .prepare(
      `SELECT s.url,
              MIN(s.submittedAt) AS submittedAt,
              MIN(s.submittedAtMs) AS submittedAtMs,
              (SELECT MIN(r.observedAt) FROM RequestReality r
               WHERE r.siteId = s.siteId
                 AND r.observedAtMs > s.submittedAtMs
                 AND ('${SITE_ORIGIN}' || r.path) = s.url
                 AND r.cfRay IS NOT NULL
                 AND ${notOperator('r')}
              ) AS firstFetchedAt
       FROM IndexSubmission s
       WHERE s.siteId = ?
       GROUP BY s.url
       ORDER BY submittedAtMs`
    )
    .all(SITE_ID);
}
