import db from "./db.js";

export function createOutcome({
  outcomeType,
  source,
  confidence = 1.0,
  identityId,
  sessionId = null
}) {
   if (!identityId) {
  throw new Error(
    "identityId is required"
  );
}

  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO Outcome (
      id,
      outcomeType,
      source,
      confidence,
      createdAt,
      identityId,
      sessionId
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      datetime('now'),
      ?,
      ?
    )
  `);

  stmt.run(
    id,
    outcomeType,
    source,
    confidence,
    identityId,
    sessionId
  );

  return db.prepare(`
    SELECT *
    FROM Outcome
    WHERE id = ?
  `).get(id);
}

export function getOutcomesByIdentity(
  identityId
) {
  return db.prepare(`
    SELECT *
    FROM Outcome
    WHERE identityId = ?
    ORDER BY createdAt DESC
  `).all(identityId);
}

export function getOutcomesBySession(
  sessionId
) {
  return db.prepare(`
    SELECT *
    FROM Outcome
    WHERE sessionId = ?
    ORDER BY createdAt DESC
  `).all(sessionId);
}
