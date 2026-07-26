import db from "./db.js";

/**
 * Refuses to store an assessment that could not be checked afterwards.
 *
 * This used to write `JSON.stringify(signals || [])` and the same for evidence,
 * which turned a missing input into a stored "[]" — a row that looks complete
 * and cannot be recomputed. Eight of the thirty-six assessments in the database
 * name a signal and record nothing it rests on, and they got there this way.
 * They are not repairable: what those signals were based on was never written
 * down anywhere.
 *
 * So the substitution is gone and the three conditions below throw instead. An
 * assessment that fires no rule is fine and common — it records an empty list
 * honestly, because nothing fired. An assessment that names a signal without
 * its evidence is refused at the point where it would become permanent.
 */
export function saveAssessment({
  identityId,
  trustScore,
  confidence,
  intent,
  signals,
  evidence,
  modelVersions,
  observedEventCount,
  assessmentTimestamp
}) {

const named =
  Array.isArray(signals)
    ? signals
    : [];

const basis =
  evidence && typeof evidence === "object"
    ? evidence
    : {};

const unsupported =
  named.filter(name => {
    const entry = basis[name];
    if (Array.isArray(entry)) return entry.length === 0;
    return entry === undefined || entry === null || entry === "";
  });

if (unsupported.length) {
  throw new Error(
    `saveAssessment: signal(s) ${unsupported.join(", ")} have no evidence — ` +
      `an assessment that cannot say what it rests on must not be stored`
  );
}

if (!modelVersions) {
  throw new Error(
    "saveAssessment: modelVersions is required — an assessment without its " +
      "method version cannot be replayed against the method that made it"
  );
}

if (typeof observedEventCount !== "number") {
  throw new Error(
    "saveAssessment: observedEventCount is required — trustDimensions is " +
      "computed from it, so a stored assessment without it cannot be recomputed"
  );
}

const stmt =
  db.prepare(`
INSERT INTO TrustAssessment (
  id,
  identityId,
  trustScore,
  confidence,
  intent,
  signals,
  evidence,
  modelVersions,
  observedEventCount,
  assessmentTimestamp
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

 const id = crypto.randomUUID();

stmt.run(
  id,
  identityId,
  trustScore,
  confidence,
  intent,
  JSON.stringify(named),
  JSON.stringify(basis),
  JSON.stringify(modelVersions),
  observedEventCount,
  assessmentTimestamp
);
}

export function getAssessmentsByIdentity(
  identityId
) {
  const stmt =
    db.prepare(`
SELECT
  trustScore,
  confidence,
  intent,
  signals,
  evidence,
  assessmentTimestamp
      FROM TrustAssessment
      WHERE identityId = ?
      ORDER BY assessmentTimestamp DESC
    `);

return stmt
  .all(identityId)
  .map(item => ({
    ...item,

    signals:
      item.signals
        ? JSON.parse(
            item.signals
          )
        : [],

    evidence:
      item.evidence
        ? JSON.parse(
            item.evidence
          )
        : {}
  }));
}

export function getIdentityProfile(
  identityId
) {
  const assessments =
    getAssessmentsByIdentity(
      identityId
    );

  if (
    assessments.length === 0
  ) {
    return null;
  }

return {
  identityId,

  currentTrustScore:
    assessments[0]
      .trustScore,

  assessmentCount:
    assessments.length,

  lastIntent:
    assessments[0]
      .intent,

  trend:
    calculateTrend(
      assessments
    )
};
}

export function calculateTrend(
  assessments
) {
  if (
    assessments.length < 2
  ) {
    return "stable";
  }

  const newest =
    assessments[0]
      .trustScore;

  const oldest =
    assessments[
      assessments.length - 1
    ].trustScore;

  if (newest > oldest) {
    return "rising";
  }

  if (newest < oldest) {
    return "declining";
  }

  return "stable";
}

export function getAllIdentityProfiles() {
  const stmt =
    db.prepare(`
      SELECT DISTINCT
        identityId
      FROM trustAssessment
    `);

  const identities =
    stmt.all();

  return identities.map(
    ({ identityId }) =>
      getIdentityProfile(
        identityId
      )
  );
}

export function getAssessmentCount() {
  const stmt =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM TrustAssessment
    `);

  return stmt.get().count;
}
