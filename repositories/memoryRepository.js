import db from "./db.js";

export function createMemory({
  identityId,
  memoryType,
  confidence
}) {
  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO Memory (
      id,
      memoryType,
      confidence,
      createdAt,
      identityId
    )
    VALUES (
      ?,
      ?,
      ?,
      datetime('now'),
      ?
    )
  `);

  stmt.run(
    id,
    memoryType,
    confidence,
    identityId
  );

  return db.prepare(`
    SELECT *
    FROM Memory
    WHERE id = ?
  `).get(id);
}

export function getMemoriesByIdentity(
  identityId
) {
  return db.prepare(`
    SELECT *
    FROM Memory
    WHERE identityId = ?
    ORDER BY createdAt DESC
  `).all(identityId);
}
