-- What the code actually is, in the same three layers as the observatory.
--
--   REALITY        what the repository contains at a commit. Observed, INSERT-only.
--   INTERPRETATION what we concluded from it. Versioned, recomputable, disposable.
--
-- There is no ACTION layer here yet. The observatory has one because it announces
-- URLs to the world and then waits; this reads a repository and concludes things
-- about it, and does nothing to it.
--
-- Kept in its own database file for the same reason reality.db is separate from
-- agentshield.db: no foreign key crosses between them, and a scan that takes a
-- write lock must never be able to block a process serving requests.

-- ===========================================================================
-- REALITY LAYER — what was read out of the working tree.
--
-- No judgement. A row says "this token, in this file, at this line, at this
-- commit". Whether that is a defect is a question for the layer above, and one
-- that must stay answerable by re-reading these rows.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS RepoScan (
  id            TEXT PRIMARY KEY,
  commitSha     TEXT    NOT NULL,      -- git rev-parse HEAD at scan time
  commitAt      TEXT,                  -- author date of that commit, ISO8601
  dirty         INTEGER NOT NULL,      -- 1 when the working tree had uncommitted changes
  scannedAt     TEXT    NOT NULL,
  scannedAtMs   INTEGER NOT NULL,
  fileCount     INTEGER NOT NULL,
  scannerVersion TEXT   NOT NULL
);

-- One row per numeric threshold found in a comparison.
--
-- `kind` exists so later detectors can record other observations in the same
-- table without a migration, and so a detector can select only what it
-- understands rather than assuming every row is its own.
CREATE TABLE IF NOT EXISTS RepoReality (
  id            TEXT PRIMARY KEY,
  scanId        TEXT    NOT NULL REFERENCES RepoScan(id),
  kind          TEXT    NOT NULL,      -- 'threshold_comparison' for now
  filePath      TEXT    NOT NULL,      -- repo-relative
  line          INTEGER NOT NULL,
  subject       TEXT,                  -- the expression compared, verbatim
  operator      TEXT,                  -- '>=', '>', '<=', '<', '===' ...
  value         TEXT    NOT NULL,      -- the literal, as written
  sourceLine    TEXT    NOT NULL,      -- the whole line, trimmed, for the reader
  -- Where an import points, for kind='import'. NULL means the specifier resolves to
  -- no file in this repository, which is the normal case for a package: `fastify` is
  -- a dependency and not a module here. Kept apart from `value` because the specifier
  -- as written and the file it reaches are different facts, and a detector asking
  -- "does anything import this file" needs the second one without losing the first.
  resolvesTo    TEXT
);

CREATE INDEX IF NOT EXISTS RepoReality_scan_idx  ON RepoReality(scanId);
CREATE INDEX IF NOT EXISTS RepoReality_value_idx ON RepoReality(kind, value);

-- ===========================================================================
-- INTERPRETATION LAYER — versioned, disposable, rebuildable from the above.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ArchFinding (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  detectorId      TEXT NOT NULL,
  detectorVersion TEXT NOT NULL,
  status          TEXT NOT NULL,       -- pending | published | rejected
  subjectKey      TEXT,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  bodyMarkdown    TEXT NOT NULL,
  scanId          TEXT NOT NULL REFERENCES RepoScan(id),
  detectedAt      TEXT NOT NULL,
  verifiedAt      TEXT,
  publishedAt     TEXT,
  rejectedReason  TEXT
);

-- Every figure in a finding, with the command that reproduces it.
--
-- The observatory stores SQL here because its claims are counts over a request
-- table. These claims are counts over a scan, so the reproducing command is a
-- shell line the reader can run — which is the first place the two pipelines
-- genuinely differ rather than merely looking different.
CREATE TABLE IF NOT EXISTS ArchFindingClaim (
  id            TEXT PRIMARY KEY,
  findingId     TEXT NOT NULL REFERENCES ArchFinding(id),
  label         TEXT NOT NULL,
  expected      TEXT NOT NULL,
  observed      TEXT,
  ok            INTEGER,
  reproduceWith TEXT NOT NULL,
  checkedAt     TEXT
);

CREATE INDEX IF NOT EXISTS ArchFindingClaim_finding_idx ON ArchFindingClaim(findingId);
