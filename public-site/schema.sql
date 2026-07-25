-- Store for agentshieldaidefense.com, in three separate layers.
--
--   REALITY       what happened to us. Observed fact only, INSERT-only.
--   INTERPRETATION what we concluded from it. Versioned, recomputable, disposable.
--   ACTION        what we did to the world. Never evidence about the world.
--
-- The layers are marked below and must not be mixed. Every published figure
-- derives from REALITY; INTERPRETATION can always be thrown away and rebuilt
-- from it; ACTION only ever starts a clock whose outcome is then observed back
-- in REALITY like anything else.

-- ===========================================================================
-- REALITY LAYER — observed fact only.
--
-- Per docs/CONSTITUTION.md and ADR-0011: no score, no decision, no
-- classification. Rows are INSERT-only and never updated, so any interpretation
-- can be re-derived from them deterministically.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS RequestReality (
  id                TEXT PRIMARY KEY,
  observedAt        TEXT    NOT NULL,   -- ISO8601 UTC with milliseconds
  observedAtMs      INTEGER NOT NULL,   -- epoch ms, for time windowing
  method            TEXT    NOT NULL,
  scheme            TEXT,               -- x-forwarded-proto
  host              TEXT,               -- Host header, verbatim
  path              TEXT    NOT NULL,   -- pathname only
  query             TEXT,               -- raw query string, without '?'
  httpVersion       TEXT,
  remoteAddr        TEXT,               -- socket peer (loopback behind tunnel)
  cfConnectingIp    TEXT,               -- authoritative client IP under cloudflared
  xForwardedFor     TEXT,               -- appendable and spoofable; kept raw
  cfRay             TEXT,
  cfIpCountry       TEXT,
  userAgent         TEXT,
  accept            TEXT,
  acceptLanguage    TEXT,
  acceptEncoding    TEXT,
  referer           TEXT,
  headersJson       TEXT    NOT NULL,   -- every request header, verbatim
  requestBodyBytes  INTEGER,
  responseStatus    INTEGER,
  responseBytes     INTEGER,
  responseTimeMs    REAL,
  contentTypeServed TEXT,
  routeVariant      TEXT,               -- which instrument served this
  canaryToken       TEXT,               -- token carried by this response
  captureVersion    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rr_time ON RequestReality(observedAtMs);
CREATE INDEX IF NOT EXISTS idx_rr_ip   ON RequestReality(cfConnectingIp, observedAtMs);
CREATE INDEX IF NOT EXISTS idx_rr_ua   ON RequestReality(userAgent);
CREATE INDEX IF NOT EXISTS idx_rr_path ON RequestReality(path);

-- Coined strings published at a known instant. Their later appearance in a
-- model's output is observed evidence of ingestion, never the model's own
-- report about itself.
CREATE TABLE IF NOT EXISTS CanaryToken (
  token       TEXT PRIMARY KEY,
  page        TEXT NOT NULL,
  variant     TEXT NOT NULL,
  publishedAt TEXT NOT NULL,
  retiredAt   TEXT,
  note        TEXT,
  UNIQUE(page, variant)
);

-- A client executed JavaScript. Observed fact, not a capability claim.
CREATE TABLE IF NOT EXISTS JsExecution (
  id                TEXT PRIMARY KEY,
  requestId         TEXT    NOT NULL,   -- RequestReality.id of the page view
  beaconAtMs        INTEGER NOT NULL,
  beaconHeadersJson TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_js_request ON JsExecution(requestId);

-- ===========================================================================
-- INTERPRETATION LAYER — conclusions drawn from the reality above.
-- Versioned and disposable: deleting all of it and recomputing must reproduce it.
-- ===========================================================================

-- Observed domains. One row today; the schema is multi-site from the start
-- because the comparative measurement — many crawlers across many sites — is
-- the part nobody else can produce, and retrofitting a siteId later would mean
-- rewriting every query.
CREATE TABLE IF NOT EXISTS Site (
  id       TEXT PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  label    TEXT NOT NULL,
  addedAt  TEXT NOT NULL,
  active   INTEGER NOT NULL DEFAULT 1
);

-- A published or pending statement about what the record shows.
--
-- Findings are data rather than code so the site can produce them without a
-- person writing them. Nothing reaches `published` until every numeric claim
-- attached to it has been recomputed from RequestReality and matched, which is
-- what keeps a generated sentence from becoming an unchecked assertion.
CREATE TABLE IF NOT EXISTS Finding (
  id              TEXT PRIMARY KEY,
  siteId          TEXT NOT NULL,
  slug            TEXT NOT NULL,
  detectorId      TEXT NOT NULL,
  detectorVersion TEXT NOT NULL,
  origin          TEXT NOT NULL,          -- 'detector' | 'human'
  status          TEXT NOT NULL,          -- 'pending' | 'published' | 'rejected'
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  bodyHtml        TEXT NOT NULL,
  subjectKey      TEXT,                   -- dedupe key: what this is about
  windowStartMs   INTEGER,
  windowEndMs     INTEGER,
  detectedAt      TEXT NOT NULL,
  verifiedAt      TEXT,
  publishedAt     TEXT,
  rejectedReason  TEXT,
  UNIQUE(siteId, detectorId, subjectKey, windowStartMs)
);

CREATE INDEX IF NOT EXISTS idx_finding_status ON Finding(status, detectedAt);
CREATE INDEX IF NOT EXISTS idx_finding_slug ON Finding(slug);

-- Every number asserted by a finding, with the query that produced it. The
-- verifier re-runs each one; a single mismatch rejects the whole finding.
CREATE TABLE IF NOT EXISTS FindingClaim (
  id         TEXT PRIMARY KEY,
  findingId  TEXT NOT NULL,
  label      TEXT NOT NULL,
  sql        TEXT NOT NULL,
  params     TEXT NOT NULL,               -- JSON array
  expected   TEXT NOT NULL,
  observed   TEXT,
  ok         INTEGER,
  checkedAt  TEXT
);

CREATE INDEX IF NOT EXISTS idx_claim_finding ON FindingClaim(findingId);

-- ===========================================================================
-- ACTION LAYER — things this system did to the world.
--
-- Not reality and not interpretation. An observation is something that
-- happened to us; an action is something we caused. Keeping them in one layer
-- would eventually let an act of ours be cited as evidence about the world,
-- which is the failure this whole design exists to prevent.
--
-- Nothing in the reality layer may read from here, and no published figure may
-- be derived from an action alone. An action is only ever the *start* of a
-- clock: we announced a URL at T, and whether anyone fetched it afterwards is
-- an observation recorded separately in RequestReality.
-- ===========================================================================

-- Small key/value store: the IndexNow key, verification tokens. Configuration,
-- not evidence.
CREATE TABLE IF NOT EXISTS Config (
  key       TEXT PRIMARY KEY,
  value     TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- An announcement made by us to an external index. This records what we did,
-- never what anyone else did in response.
CREATE TABLE IF NOT EXISTS IndexSubmission (
  id           TEXT PRIMARY KEY,
  siteId       TEXT NOT NULL,
  service      TEXT NOT NULL,      -- 'indexnow'
  url          TEXT NOT NULL,
  submittedAt  TEXT NOT NULL,
  submittedAtMs INTEGER NOT NULL,
  httpStatus   INTEGER,            -- the index's reply to us, still our action
  note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_submission_url ON IndexSubmission(url, submittedAtMs);

-- A controlled trial: at a recorded instant we asked a named assistant to do
-- something with a named URL. This records only what we did and when.
--
-- What arrived afterwards is not stored here. Attributing an incoming request
-- to a trial is an inference — a request in the window may be unrelated — so
-- attribution is computed at read time from RequestReality and never written
-- down as though it were observed. The trial gives the clock a zero; the
-- reality layer supplies everything that happened after it.
CREATE TABLE IF NOT EXISTS Trial (
  id          TEXT PRIMARY KEY,
  siteId      TEXT NOT NULL,
  vendor      TEXT NOT NULL,      -- the assistant that was asked
  prompt      TEXT NOT NULL,      -- verbatim, so the trial can be repeated
  targetPath  TEXT NOT NULL,
  startedAt   TEXT NOT NULL,
  startedAtMs INTEGER NOT NULL,
  windowMs    INTEGER NOT NULL,   -- how long afterwards counts as related
  reply       TEXT,               -- what the assistant answered, if recorded
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_trial_started ON Trial(startedAtMs);
