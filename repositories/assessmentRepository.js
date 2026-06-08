import db from "./db.js";

export function saveAssessment({
  identityId,
  trustScore,
  confidence,
  intent,
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
      assessmentTimestamp
    )
    VALUES (?,?, ?, ?, ?, ?)
  `);

 const id = crypto.randomUUID();

 stmt.run(
    id,
    identityId,
    trustScore,
    confidence,
    intent,
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
        assessmentTimestamp
      FROM TrustAssessments
      WHERE identIty_id = ?
      ORDER BY id DESC
    `);

  return stmt.all(
    identityId
  );
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
      FROM trustAssessments
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
