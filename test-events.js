import db from "./repositories/db.js";

const events = db.prepare(`
  SELECT
    createdAt,
    eventType,
    mouseMoves,
    scrollDepth,
    clickCount,
    focusEvents,
    readingTime
  FROM Event
  ORDER BY createdAt DESC
  LIMIT 20
`).all();

console.log(
  JSON.stringify(
    events,
    null,
    2
  )
);
