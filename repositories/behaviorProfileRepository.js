import db from "./db.js";

export function getBehaviorProfile(
  identityId
) {
  const events = db.prepare(`
    SELECT *
    FROM Event
    WHERE identityId = ?
  `).all(identityId);

  if (events.length === 0) {
    return null;
  }

  const avg = field =>
    Math.round(
      events.reduce(
        (sum, event) =>
          sum + (event[field] || 0),
        0
      ) / events.length
    );

  const averageReadingTime =
    avg("readingTime");

  const averageMouseMoves =
    avg("mouseMoves");

  const averageScrollDepth =
    avg("scrollDepth");

  const averageClickCount =
    avg("clickCount");

  const averageFocusEvents =
    avg("focusEvents");

  let engagementLevel =
    "low";

  if (
    averageReadingTime >= 10 ||
    averageMouseMoves >= 10
  ) {
    engagementLevel =
      "medium";
  }

  if (
    averageReadingTime >= 30 ||
    averageMouseMoves >= 30
  ) {
    engagementLevel =
      "high";
  }

  let behaviorType =
    "unknown";

  if (
    engagementLevel ===
    "high"
  ) {
    behaviorType =
      "research";
  }

  return {
    identityId,

    eventCount:
      events.length,

    averageReadingTime,

    averageMouseMoves,

    averageScrollDepth,

    averageClickCount,

    averageFocusEvents,

    engagementLevel,

    behaviorType
  };
}
