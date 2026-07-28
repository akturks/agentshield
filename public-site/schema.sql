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

-- ---------------------------------------------------------------------------
-- Solicited observation — artefacts this site went and looked at.
--
-- Still reality: the bytes below were served by somebody else's server and are
-- recorded verbatim, unjudged. But it is a different reality from the tables
-- above, and the difference is the whole reason it lives apart.
--
-- RequestReality holds what arrived here unasked. This holds what we went and
-- asked for. Counting them together would eventually produce a sentence like
-- "four hundred sites came to us", which is the exact inversion of what
-- happened. So:
--
--   * nothing here is ever joined to RequestReality;
--   * no figure about this site's own traffic may include a row from here;
--   * `domain` is stored because a survey has to be repeatable, and is never
--     published — a finding reports how many, never which.
--
-- No column holds a conclusion. Whether a body contains an injected block, or
-- contradicts the owner's own rules, is computed when the question is asked, so
-- improving the question never means rewriting what was observed.
-- ---------------------------------------------------------------------------

-- One declared run: which population, which rule drew the sample, how fast, and
-- under what name we introduced ourselves. Written before any fetch, so a run
-- can never be described after its results are known.
CREATE TABLE IF NOT EXISTS RobotsSurvey (
  id             TEXT PRIMARY KEY,
  declaredAt     TEXT    NOT NULL,
  populationId   TEXT    NOT NULL,   -- e.g. 'tranco-46ZYX'
  populationUrl  TEXT    NOT NULL,   -- where anyone can obtain the same list
  sampleRule     TEXT    NOT NULL,   -- prose, one sentence, reproducible
  sampleSize     INTEGER NOT NULL,
  userAgent      TEXT    NOT NULL,   -- exactly what we sent
  minIntervalMs  INTEGER NOT NULL,
  maxConcurrent  INTEGER NOT NULL,
  -- Where the survey was conducted from. A measurement of reachability is a
  -- measurement of reachability *from somewhere*, and the first eight domains
  -- ever fetched proved it: two answered with a reset and did not resolve in
  -- DNS at all, which is national filtering rather than anything about those
  -- sites. Unrecorded, that becomes "4% of the web serves no robots.txt".
  vantagePoint   TEXT,
  startedAt      TEXT,
  finishedAt     TEXT,
  fetchVersion   TEXT    NOT NULL
);

-- One attempt to read one domain's robots.txt. INSERT-only, like everything in
-- this layer: a domain that failed and later succeeded is two rows, because
-- "it was unreachable at 09:00" stays true after 10:00.
CREATE TABLE IF NOT EXISTS RobotsObservation (
  id            TEXT PRIMARY KEY,
  surveyId      TEXT    NOT NULL,
  domain        TEXT    NOT NULL,   -- never published
  rank          INTEGER,            -- position in the declared population
  requestedUrl  TEXT    NOT NULL,
  requestedAt   TEXT    NOT NULL,
  requestedAtMs INTEGER NOT NULL,
  finalUrl      TEXT,               -- after redirects, verbatim
  redirects     INTEGER,
  httpStatus    INTEGER,
  contentType   TEXT,
  bodyBytes     INTEGER,
  body          TEXT,               -- the evidence itself, verbatim
  bodySha256    TEXT,
  headersJson   TEXT,               -- every response header
  elapsedMs     REAL,
  errorCode     TEXT,               -- the runtime's own code, not our taxonomy
  errorMessage  TEXT,
  fetchVersion  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ro_survey ON RobotsObservation(surveyId);
CREATE INDEX IF NOT EXISTS idx_ro_domain ON RobotsObservation(domain, requestedAtMs);

-- This site's own published surface, read back from two places.
--
-- Everything else in this file records what reached the server. This records
-- what left it and what a stranger actually receives, which are not the same
-- thing and were not the same thing here: for an unknown period the edge served
-- a robots.txt with nine crawler groups and `Disallow: /` prepended, over an
-- origin file that welcomes those crawlers by name. Nothing at the origin could
-- see it, and the record could not date it, because no snapshot existed.
--
--   vantage 'origin'  fetched over the loopback address, bypassing the CDN
--   vantage 'edge'    fetched over the public hostname, through it
--
-- Both are real HTTP requests to the same running server, so the difference
-- between them is the CDN's doing and nothing of ours. Rendering the page
-- in-process instead would compare the server's output to the edge's, and the
-- gap would silently include whatever the response path adds on the way out.
--
-- No column says whether anything changed. Two rows with different hashes are
-- two observations; "it changed" is a sentence about them, computed when asked,
-- so improving how the comparison works never means rewriting what was seen.
CREATE TABLE IF NOT EXISTS SelfObservation (
  id            TEXT PRIMARY KEY,
  runId         TEXT    NOT NULL,   -- one sweep; pairs the vantages honestly
  path          TEXT    NOT NULL,
  vantage       TEXT    NOT NULL,   -- 'origin' | 'edge'
  requestedUrl  TEXT    NOT NULL,
  observedAt    TEXT    NOT NULL,
  observedAtMs  INTEGER NOT NULL,
  httpStatus    INTEGER,
  contentType   TEXT,
  bodyBytes     INTEGER,
  body          TEXT,               -- verbatim, the evidence itself
  bodySha256    TEXT,
  headersJson   TEXT,
  elapsedMs     REAL,
  errorCode     TEXT,
  errorMessage  TEXT,
  sensorVersion TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_so_path ON SelfObservation(path, observedAtMs);
CREATE INDEX IF NOT EXISTS idx_so_run  ON SelfObservation(runId);

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
