-- The record. One row per request that reached the server, written once.
--
-- Deliberately the same shape as the observatory's own RequestReality table, so
-- a database produced here can be read by the same queries. If the columns
-- drift, every finding computed against one becomes uncomparable with the
-- other, and the point of a shared instrument is lost.
--
-- There is no UPDATE and no DELETE anywhere in this package. A measurement that
-- can be revised afterwards is not a measurement.

CREATE TABLE IF NOT EXISTS RequestReality (
  id                TEXT PRIMARY KEY,
  observedAt        TEXT    NOT NULL,   -- ISO8601 UTC with milliseconds
  observedAtMs      INTEGER NOT NULL,   -- epoch ms, for time windowing
  method            TEXT    NOT NULL,
  scheme            TEXT,               -- x-forwarded-proto, if a proxy set one
  host              TEXT,               -- Host header, verbatim
  path              TEXT    NOT NULL,   -- pathname only
  query             TEXT,               -- raw query string, without '?'
  httpVersion       TEXT,
  remoteAddr        TEXT,               -- socket peer; loopback behind a proxy
  cfConnectingIp    TEXT,               -- the client address this row is keyed on
  xForwardedFor     TEXT,               -- appendable and spoofable; kept raw
  cfRay             TEXT,               -- CDN request id, when there is a CDN
  cfIpCountry       TEXT,
  userAgent         TEXT,
  accept            TEXT,
  acceptLanguage    TEXT,
  acceptEncoding    TEXT,
  referer           TEXT,
  headersJson       TEXT    NOT NULL,   -- every request header; identifying values redacted
  requestBodyBytes  INTEGER,
  responseStatus    INTEGER,
  responseBytes     INTEGER,
  responseTimeMs    REAL,
  contentTypeServed TEXT,
  routeVariant      TEXT,               -- optional label for which handler served it
  canaryToken       TEXT,               -- optional marker carried by this response
  captureVersion    TEXT    NOT NULL,
  siteId            TEXT
);

CREATE INDEX IF NOT EXISTS idx_rr_time ON RequestReality(observedAtMs);
CREATE INDEX IF NOT EXISTS idx_rr_ip   ON RequestReality(cfConnectingIp, observedAtMs);
CREATE INDEX IF NOT EXISTS idx_rr_ua   ON RequestReality(userAgent);
CREATE INDEX IF NOT EXISTS idx_rr_path ON RequestReality(path);
CREATE INDEX IF NOT EXISTS idx_rr_site ON RequestReality(siteId, observedAtMs);
