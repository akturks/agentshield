import db from "./db.js";

import {
  deriveSignals
} from "./signalRepository.js";

export function calculateTrust(identityId) {
  const events = db.prepare(`
    SELECT *
    FROM Event
    WHERE identityId = ?
  `).all(identityId);

  const signals =
    deriveSignals(events);

  let trustScore = 50;

  if (
    signals.includes(
      "admin_scanning"
    )
  ) {
    trustScore -= 20;
  }

  trustScore = Math.max(
    0,
    Math.min(100, trustScore)
  );

  return {
    trustScore,
    signals,
    eventCount: events.length
  };
}
