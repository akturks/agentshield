import Database from "better-sqlite3";

const db =
  new Database(
    "./agentshield.db"
  );

export function saveAssessment({
  identityId,
  trustScore,
  confidence,
  intent,
  assessmentTimestamp
}) {
  const stmt =
    db.prepare(`
      INSERT INTO trust_assessments (
        identity_id,
        trust_score,
        confidence,
        intent,
        assessment_timestamp
      )
      VALUES (?, ?, ?, ?, ?)
    `);

  stmt.run(
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
        trust_score,
        confidence,
        intent,
        assessment_timestamp
      FROM trust_assessments
      WHERE identity_id = ?
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
      .trust_score,

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
      .trust_score;

  const oldest =
    assessments[
      assessments.length - 1
    ].trust_score;

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
        identity_id
      FROM trust_assessments
    `);

  const identities =
    stmt.all();

  return identities.map(
    ({ identity_id }) =>
      getIdentityProfile(
        identity_id
      )
  );
}
