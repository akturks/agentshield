import db from "./db.js";

export function createEvent({
  identityId,
  eventType,
  path = null,
  ip = null,
  userAgent = null,
  referrer = null,
  sessionId = null,
  mouseMoves = null,
  scrollDepth = null,
  clickCount = null,
  focusEvents = null,
  readingTime = null,

  deviceFingerprint = null,
  challengeResult = null
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

mouseMoves,
scrollDepth,
clickCount,
focusEvents,
readingTime,

deviceFingerprint,
challengeResult,

createdAt,
identityId
)

VALUES (
?, ?, ?, ?, ?, ?, ?,

?, ?, ?, ?, ?,

?, ?,

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

mouseMoves,
scrollDepth,
clickCount,
focusEvents,
readingTime,

deviceFingerprint,
challengeResult,

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

let intent =
  "unknown";

if (
  behaviorType ===
  "exploration"
) {
  intent =
    "research";
}

if (
  behaviorType ===
  "engaged"
) {
  intent =
    "commercial";
}

if (
  behaviorType ===
  "bounce"
) {
  intent =
    "unknown";
}

const evidence = [];

if (events.length === 1) {
  evidence.push(
    "single_page_visit"
  );
}

if (events.length > 1) {
  evidence.push(
    "multi_page_navigation"
  );
}

if (events[0].referrer) {
  evidence.push(
    "external_referrer"
  );
}

if (
  behaviorType ===
  "engaged"
) {
  evidence.push(
    "high_session_depth"
  );
}

let trafficQuality = 50;

if (
  behaviorType ===
  "bounce"
) {
  trafficQuality = 20;
}

if (
  behaviorType ===
  "exploration"
) {
  trafficQuality = 60;
}

if (
  behaviorType ===
  "engaged"
) {
  trafficQuality = 90;
}

let trafficTier =
  "low";

if (trafficQuality >= 50) {
  trafficTier =
    "medium";
}

if (trafficQuality >= 80) {
  trafficTier =
    "high";
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
 intent,
 evidence,
 trafficQuality,
 trafficTier,

 events
};

}
