import db from "./db.js";

export function calculateTrust(identityId) {
  const events = db.prepare(`
    SELECT *
    FROM Event
    WHERE identityId = ?
  `).all(identityId);

  let trustScore = 50;

  for (const event of events) {
    if (event.decision === "block") {
      trustScore -= 15;
    }

    if (event.decision === "challenge") {
      trustScore -= 5;
    }

    if (event.decision === "allow") {
      trustScore += 1;
    }

    if (
      event.path &&
      event.path.includes("/admin")
    ) {
      trustScore -= 10;
    }
  }

  trustScore = Math.max(
    0,
    Math.min(100, trustScore)
  );

  return {
    trustScore,
    eventCount: events.length
  };
}
