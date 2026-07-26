import db from "./db.js";

// What was concluded about a request, kept apart from the record of the request.
//
// riskScore and decision used to live on Event, beside the path and the user
// agent that produced them. The Reality Boundary exists because of what that
// costs: a verdict stored on an observation cannot be revisited, since the row
// no longer distinguishes what arrived from what was decided about it. Forty-six
// events carried both, and none of them recorded the reasons the score was built
// from or the version of the rule that built it — so none could be replayed.
//
// The inputs here are recoverable, which is the one piece of luck in this. The
// score is computed from the path and the user agent, and both are on the event.
// So a stored assessment plus its event is enough to recompute the score, once
// the reasons and the method version are written down as well.
//
// Those forty-six rows were moved into this table with reasons and methodVersion
// left NULL. They were never recorded, and filling them in with today's values
// would manufacture a basis these verdicts never had.

/**
 * Stores one conclusion about one event.
 *
 * Refuses a verdict that arrives without the reasons it was built from or the
 * version of the rule that built it, for the same reason saveAssessment refuses
 * an unsupported signal: the moment it is written, the chance to record why is
 * gone, and a score nobody can recompute is not evidence of anything.
 */
export function saveEventAssessment({
  eventId,
  riskScore,
  decision,
  reasons,
  methodVersion
}) {
  if (!eventId) {
    throw new Error("saveEventAssessment: eventId is required");
  }

  if (typeof riskScore !== "number" || typeof decision !== "string" || !decision) {
    throw new Error("saveEventAssessment: riskScore and decision are required");
  }

  if (!Array.isArray(reasons)) {
    throw new Error(
      "saveEventAssessment: reasons must be an array — a score with no reasons " +
        "cannot be recomputed, and so cannot be corrected"
    );
  }

  if (!methodVersion) {
    throw new Error(
      "saveEventAssessment: methodVersion is required — a verdict without the " +
        "version of the rule that produced it cannot be replayed against that rule"
    );
  }

  const stmt = db.prepare(`
    INSERT INTO EventAssessment (
      id, eventId, riskScore, decision, reasons, methodVersion, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const id = crypto.randomUUID();
  stmt.run(id, eventId, riskScore, decision, JSON.stringify(reasons), methodVersion);

  return id;
}

/**
 * Traffic quality over the verdicts, not over the events.
 *
 * /v1/traffic-quality used to compute these by reading `event.decision` and
 * `event.riskScore` off each Event row. Moving those off reality broke it into
 * silence rather than into an error: the fields came back undefined, so the
 * endpoint reported zero blocked, zero allowed and an average risk of zero,
 * which is a plausible-looking answer and a false one.
 *
 * Counted here in SQL so the figures come from the table that actually holds
 * them, and so a later move breaks the query loudly instead of quietly.
 */
export function verdictTotals() {
  return db
    .prepare(
      `SELECT
         COUNT(*) AS assessed,
         SUM(CASE WHEN decision = 'block' THEN 1 ELSE 0 END) AS blocked,
         SUM(CASE WHEN decision = 'allow' THEN 1 ELSE 0 END) AS allowed,
         AVG(riskScore) AS averageRisk
       FROM EventAssessment`
    )
    .get();
}

export function getAssessmentsByEvent(eventId) {
  return db
    .prepare(
      `SELECT id, eventId, riskScore, decision, reasons, methodVersion, createdAt
       FROM EventAssessment WHERE eventId = ? ORDER BY createdAt`
    )
    .all(eventId)
    .map((row) => ({
      ...row,
      reasons: row.reasons ? JSON.parse(row.reasons) : null
    }));
}
