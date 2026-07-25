import { randomUUID } from "node:crypto";
import db, { SITE_ID } from "./realityDb.js";

export const CAPTURE_VERSION = "cap-1";

const insertReality = db.prepare(`
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

const insertJs = db.prepare(`
  INSERT INTO JsExecution (id, requestId, beaconAtMs, beaconHeadersJson, siteId)
  VALUES (@id, @requestId, @beaconAtMs, @beaconHeadersJson, @siteId)
`);

// A beacon counts only if it names a /probe/js response served recently and
// has not been counted before. Without both checks the identifier could be
// replayed, and JS execution is evidence that findings are built on.
const eligible = db.prepare(`
  SELECT 1 FROM RequestReality
  WHERE id = ? AND routeVariant = 'probe_js'
    AND observedAtMs > ?
`);

const alreadyCounted = db.prepare(
  "SELECT 1 FROM JsExecution WHERE requestId = ?"
);

export function recordJsExecution(requestId, headers) {
  try {
    const FIVE_MINUTES = 5 * 60 * 1000;
    if (!eligible.get(requestId, Date.now() - FIVE_MINUTES)) return;
    if (alreadyCounted.get(requestId)) return;

    insertJs.run({
      id: randomUUID(),
      requestId,
      beaconAtMs: Date.now(),
      beaconHeadersJson: JSON.stringify(headers ?? {}),
      siteId: SITE_ID
    });
  } catch (err) {
    console.error("[capture] js beacon failed:", err.message);
  }
}

function header(headers, name) {
  const value = headers[name];
  if (value === undefined) return null;
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Records every inbound request as observed fact. Registered on the public
 * process only. Nothing here may throw into the response path: a failure to
 * observe must never become a failure to serve.
 */
export default function captureHook(app) {
  app.addHook("onRequest", (req, reply, done) => {
    req.realityId = randomUUID();
    req.realityStart = process.hrtime.bigint();
    done();
  });

  app.addHook("onResponse", (req, reply, done) => {
    try {
      const headers = req.headers ?? {};
      const rawUrl = req.raw?.url ?? req.url ?? "/";
      const splitAt = rawUrl.indexOf("?");
      const elapsedNs = req.realityStart
        ? Number(process.hrtime.bigint() - req.realityStart)
        : null;

      insertReality.run({
        id: req.realityId ?? randomUUID(),
        observedAt: new Date().toISOString(),
        observedAtMs: Date.now(),
        method: req.method ?? "GET",
        scheme: header(headers, "x-forwarded-proto"),
        host: header(headers, "host"),
        path: splitAt === -1 ? rawUrl : rawUrl.slice(0, splitAt),
        query: splitAt === -1 ? null : rawUrl.slice(splitAt + 1),
        httpVersion: req.raw?.httpVersion ?? null,
        remoteAddr: req.raw?.socket?.remoteAddress ?? null,
        cfConnectingIp: header(headers, "cf-connecting-ip"),
        xForwardedFor: header(headers, "x-forwarded-for"),
        cfRay: header(headers, "cf-ray"),
        cfIpCountry: header(headers, "cf-ipcountry"),
        userAgent: header(headers, "user-agent"),
        accept: header(headers, "accept"),
        acceptLanguage: header(headers, "accept-language"),
        acceptEncoding: header(headers, "accept-encoding"),
        referer: header(headers, "referer") ?? header(headers, "referrer"),
        headersJson: JSON.stringify(headers),
        requestBodyBytes: toInt(header(headers, "content-length")),
        responseStatus: reply.statusCode ?? null,
        responseBytes: toInt(reply.getHeader?.("content-length")),
        responseTimeMs: elapsedNs === null ? null : elapsedNs / 1e6,
        contentTypeServed: reply.getHeader?.("content-type") ?? null,
        routeVariant: req.realityVariant ?? null,
        canaryToken: req.realityCanary ?? null,
        captureVersion: CAPTURE_VERSION,
        siteId: SITE_ID
      });
    } catch (err) {
      console.error("[capture] failed to record request:", err.message);
    }
    done();
  });
}
