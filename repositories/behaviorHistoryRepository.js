import db from "./db.js";

function summarize(
  events,
  field
) {
  const values =
    events.map(
      event =>
        event[field] || 0
    );

  const total =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  return {
    average:
      Math.round(
        total /
        values.length
      ),

    min:
      Math.min(
        ...values
      ),

    max:
      Math.max(
        ...values
      )
  };
}

export function getBehaviorHistory(
  identityId
) {
  const events =
    db.prepare(`
      SELECT *
      FROM Event
      WHERE identityId = ?
      ORDER BY createdAt DESC
    `).all(identityId);

  if (
    events.length === 0
  ) {
    return null;
  }

  return {
    identityId,

    eventCount:
      events.length,

    readingTime:
      summarize(
        events,
        "readingTime"
      ),

    mouseMoves:
      summarize(
        events,
        "mouseMoves"
      ),

    scrollDepth:
      summarize(
        events,
        "scrollDepth"
      ),

    clickCount:
      summarize(
        events,
        "clickCount"
      ),

    focusEvents:
      summarize(
        events,
        "focusEvents"
      )
  };
}
