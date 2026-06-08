import db from "./db.js";

export function createSession({
  id,
  identityId
}) {
  const stmt = db.prepare(`
    INSERT INTO Session (
      id,
      identityId,
      createdAt
    )
    VALUES (
      ?,
      ?,
      datetime('now')
    )
  `);

  stmt.run(
    id,
    identityId
  );

  return getSession(id);
}

export function getSession(id) {
  return db.prepare(`
    SELECT *
    FROM Session
    WHERE id = ?
    LIMIT 1
  `).get(id);
}

export function getSessionsByIdentity(
  identityId
) {
  return db.prepare(`
    SELECT *
    FROM Session
    WHERE identityId = ?
    ORDER BY createdAt DESC
  `).all(identityId);
}
