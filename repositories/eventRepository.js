import db from "./db.js";

export function createEvent({
  identityId,
  eventType,
  path = null,
  ip = null,
  userAgent = null,
  referrer = null,
  sessionId = null,
  riskScore = null,
  decision = null
})

 {
  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO Event (
id,
eventType,
path,
ip,
userAgent,
referrer,
sessionId,
riskScore,
decision,
createdAt,
identityId
    )
    VALUES (
?, ?, ?, ?, ?, ?, ?, ?, ?,
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
referrer,
sessionId,
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
export function getEventsBySession(
  sessionId
) {
  return db.prepare(`
    SELECT *
    FROM Event
    WHERE sessionId = ?
    ORDER BY createdAt ASC
  `).all(sessionId);
}
export function getSessionProfile(
  sessionId
) {
  const events = db.prepare(`
    SELECT *
    FROM Event
    WHERE sessionId = ?
    ORDER BY createdAt ASC
  `).all(sessionId);

  if (events.length === 0) {
    return null;
  }

let behaviorType =
  "exploration";

if (events.length === 1) {
  behaviorType =
    "bounce";
}

if (events.length > 5) {
  behaviorType =
    "engaged";
}

return {
  sessionId,
  eventCount: events.length,
  entryPage: events[0].path,
  exitPage:
    events[events.length - 1].path,
  referrer:
    events[0].referrer,

  behaviorType,

  events
};

}
