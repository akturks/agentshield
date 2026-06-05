import Database from "better-sqlite3";

const db =
  new Database(
    "./agentshield.db"
  );

db.exec(`
CREATE TABLE IF NOT EXISTS trust_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_id TEXT NOT NULL,
  trust_score INTEGER NOT NULL,
  confidence REAL NOT NULL,
  intent TEXT NOT NULL,
  assessment_timestamp TEXT NOT NULL
)
`);

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
