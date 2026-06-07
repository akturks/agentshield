import db from "./db.js";

export function createEvent({
  identityId,
  eventType,
  path = null,
  ip = null,
  userAgent = null,
  riskScore = null,
  decision = null
}) {
  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO Event (
      id,
      eventType,
      path,
      ip,
      userAgent,
      riskScore,
      decision,
      createdAt,
      identityId
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      datetime('now'),
      ?
    )
  `);

  stmt.run(
    id,
    eventType,
    path,
    ip,
    userAgent,
    riskScore,
    decision,
    identityId
  );

  return db.prepare(`
    SELECT *
    FROM Event
    WHERE id = ?
  `).get(id);
}

export function getEventsByIdentity(identityId) {
  return db.prepare(`
    SELECT *
    FROM Event
    WHERE identityId = ?
    ORDER BY createdAt DESC
  `).all(identityId);
}
export function getAllEvents() {
  return db.prepare(`
    SELECT *
    FROM Event
    ORDER BY createdAt DESC
    LIMIT 100
  `).all();
}
