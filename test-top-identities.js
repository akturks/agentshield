import db from "./repositories/db.js";

const rows = db.prepare(`
SELECT
identityId,
COUNT(*) as events,
AVG(readingTime) as avgReadingTime,
AVG(mouseMoves) as avgMouseMoves
FROM Event
GROUP BY identityId
ORDER BY avgReadingTime DESC
LIMIT 20
`).all();

console.log(
  JSON.stringify(
    rows,
    null,
    2
  )
);
