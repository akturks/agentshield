import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

// A drop-in request recorder for somebody else's site.
//
// The observatory can answer "did an AI system actually read this page" for one
// domain, because that domain's server writes down every request. Nobody can
// answer it for a domain that does not. This package is that half, packaged: a
// site owner installs it, and the same questions become askable about their own
// site rather than about ours.
//
// Three rules, and they are the ones that cost something to learn.
//
// It never throws into the response path. A failure to observe must never become
// a failure to serve. Every write here is wrapped, and if the database is
// unavailable the site keeps working and the row is lost. That is the correct
// trade for an instrument installed on somebody's business.
//
// It never updates or deletes. There is no code path in this package that
// modifies a stored row.
//
// It redacts identity, not behaviour. Which headers a client sends is part of
// how it behaves and is recorded. What a Cookie or Authorization header
// *contains* identifies a person, has no measurement value, and is dropped
// before the row is written — not later, and not optionally.

export const CAPTURE_VERSION = "rec-1";

// Values that identify a person rather than describe a request.
//
// The observatory ran for three days without this and accumulated 520 stored
// cookie values carrying a per-visitor identifier it never read. Nobody decided
// to collect them; the capture was written to keep everything, and keeping
// everything is not the same as observing.
export const IDENTIFYING_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization"
]);

export function withoutIdentifiers(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers ?? {}))
    out[name] = IDENTIFYING_HEADERS.has(name.toLowerCase()) ? "[redacted]" : value;
  return out;
}

const header = (headers, name) => {
  const value = headers?.[name];
  if (value === undefined || value === null) return null;
  return Array.isArray(value) ? value.join(", ") : String(value);
};

const toInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * The address this row is keyed on.
 *
 * Order matters and the reason is not obvious. Behind a proxy the socket peer is
 * the proxy, so it identifies nothing; the client address arrives in a header.
 * `cf-connecting-ip` is set by Cloudflare and cannot be forged through it.
 * `x-forwarded-for` is appendable by anyone upstream, so its first entry is a
 * claim rather than a fact — it is used only when nothing better exists, and the
 * raw value is stored either way so a reader can see what was actually sent.
 */
function clientAddress(headers, socketAddr, { trustForwarded }) {
  const cf = header(headers, "cf-connecting-ip");
  if (cf) return cf;

  if (trustForwarded) {
    const xff = header(headers, "x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
  }

  return socketAddr ?? null;
}

/**
 * Opens the record and returns something that can write one row per request.
 *
 * @param {object} options
 * @param {string} options.file      path to the SQLite file; created if absent
 * @param {string} [options.siteId]  a label, if one database holds several sites
 * @param {boolean} [options.trustForwarded]
 *   Whether to believe `x-forwarded-for` when no CDN header is present. Leave
 *   this off unless the server really is behind a proxy you control: the header
 *   is client-settable, and an address taken from it is a claim.
 */
export function createRecorder({ file, siteId = null, trustForwarded = false }) {
  if (!file) throw new Error("createRecorder: `file` is required");

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

  const insert = db.prepare(`
    INSERT INTO RequestReality (
      id, observedAt, observedAtMs, method, scheme, host, path, query,
      httpVersion, remoteAddr, cfConnectingIp, xForwardedFor, cfRay, cfIpCountry,
      userAgent, accept, acceptLanguage, acceptEncoding, referer, headersJson,
      requestBodyBytes, responseStatus, responseBytes, responseTimeMs,
      contentTypeServed, routeVariant, canaryToken, captureVersion, siteId
    ) VALUES (
      @id, @observedAt, @observedAtMs, @method, @scheme, @host, @path, @query,
      @httpVersion, @remoteAddr, @cfConnectingIp, @xForwardedFor, @cfRay, @cfIpCountry,
      @userAgent, @accept, @acceptLanguage, @acceptEncoding, @referer, @headersJson,
      @requestBodyBytes, @responseStatus, @responseBytes, @responseTimeMs,
      @contentTypeServed, @routeVariant, @canaryToken, @captureVersion, @siteId
    )
  `);

  let dropped = 0;

  /**
   * Writes one row. Returns the row id, or null if it could not be written.
   * Never throws.
   */
  function record({
    headers = {},
    method = "GET",
    url = "/",
    httpVersion = null,
    remoteAddr = null,
    status = null,
    responseBytes = null,
    responseTimeMs = null,
    contentType = null,
    routeVariant = null,
    canaryToken = null
  } = {}) {
    try {
      const split = url.indexOf("?");
      const now = new Date();
      const id = randomUUID();

      insert.run({
        id,
        observedAt: now.toISOString(),
        observedAtMs: now.getTime(),
        method,
        scheme: header(headers, "x-forwarded-proto"),
        host: header(headers, "host"),
        path: split === -1 ? url : url.slice(0, split),
        query: split === -1 ? null : url.slice(split + 1),
        httpVersion,
        remoteAddr,
        cfConnectingIp: clientAddress(headers, remoteAddr, { trustForwarded }),
        xForwardedFor: header(headers, "x-forwarded-for"),
        cfRay: header(headers, "cf-ray"),
        cfIpCountry: header(headers, "cf-ipcountry"),
        userAgent: header(headers, "user-agent"),
        accept: header(headers, "accept"),
        acceptLanguage: header(headers, "accept-language"),
        acceptEncoding: header(headers, "accept-encoding"),
        referer: header(headers, "referer") ?? header(headers, "referrer"),
        headersJson: JSON.stringify(withoutIdentifiers(headers)),
        requestBodyBytes: toInt(header(headers, "content-length")),
        responseStatus: status,
        responseBytes: toInt(responseBytes),
        responseTimeMs,
        contentTypeServed: contentType,
        routeVariant,
        canaryToken,
        captureVersion: CAPTURE_VERSION,
        siteId
      });

      return id;
    } catch {
      // Deliberately silent per request. A site that logs a stack trace on every
      // request because its disk filled up has turned an instrument into an
      // outage. The count is available through `stats()` for anyone checking.
      dropped += 1;
      return null;
    }
  }

  const stats = () => ({
    file,
    rows: db.prepare("SELECT COUNT(*) AS n FROM RequestReality").get().n,
    first: db.prepare("SELECT MIN(observedAt) AS at FROM RequestReality").get().at,
    last: db.prepare("SELECT MAX(observedAt) AS at FROM RequestReality").get().at,
    droppedThisProcess: dropped
  });

  return { record, stats, db, close: () => db.close() };
}
