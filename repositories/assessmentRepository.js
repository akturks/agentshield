import db from "./db.js";

export function saveAssessment({
  identityId,
  trustScore,
  confidence,
  intent,
  signals,
  evidence,
  assessmentTimestamp
}) {

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
  assessmentTimestamp
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

 const id = crypto.randomUUID();

stmt.run(
  id,
  identityId,
  trustScore,
  confidence,
  intent,
  JSON.stringify(
    signals || []
  ),
  JSON.stringify(
    evidence || {}
  ),
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
