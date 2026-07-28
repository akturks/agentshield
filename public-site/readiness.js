import db from "./realityDb.js";
import { EXTERNAL } from "./stats.js";
import { weeksObserved } from "./weekly.js";
import { habits } from "./patterns.js";

// What this instrument can and cannot yet answer, computed rather than asserted.
//
// Every component here works. That is not the same as any of them having seen
// enough to say anything, and the gap between those two states is where a
// measurement system does its lying — not by reporting a wrong number, but by
// reporting a real one from a sample that cannot carry it. "GPTBot does not read
// product pages" is a defensible sentence after two hundred visits and a
// fabrication after six.
//
// So each question below declares what it needs before it may be answered, the
// record says how much of that exists, and the verdict falls out. A threshold in
// code is a claim that can be argued with; a threshold in somebody's judgement
// is one that quietly moves when the answer is wanted.
//
// The thresholds are deliberately modest. They are not statistical power
// calculations — this is not that kind of instrument yet — they are the point
// below which a sentence would be obviously indefensible.

export const READINESS_VERSION = "rdy-1";

const one = (sql, params = []) => {
  const row = db.prepare(sql).get(...params);
  return row ? Number(Object.values(row)[0]) : 0;
};

/**
 * A question, what answering it requires, and where the record stands.
 *
 * `built` is about code; `observed` is about the record. The distinction is the
 * whole point of this file: a component can be finished and useless on the same
 * day, and a status page that shows only the first number invites everyone —
 * including whoever wrote it — to forget the second.
 */
export const QUESTIONS = [
  {
    id: "arrivals",
    question: "Which clients declaring an AI crawler identity have reached this site?",
    needs: "one request",
    // Descriptive, not inferential. Listing what arrived requires nothing beyond
    // its having arrived, which is why this is the only row that can be green in
    // the first week.
    threshold: 1,
    unit: "requests",
    built: true,
    observed: () =>
      one(
        `SELECT COUNT(*) FROM RequestReality WHERE ${EXTERNAL}
         AND (userAgent LIKE '%GPTBot%' OR userAgent LIKE '%ClaudeBot%'
           OR userAgent LIKE '%Claude-User%' OR userAgent LIKE '%OAI-SearchBot%'
           OR userAgent LIKE '%ChatGPT-User%' OR userAgent LIKE '%PerplexityBot%'
           OR userAgent LIKE '%CCBot%' OR userAgent LIKE '%Bytespider%'
           OR userAgent LIKE '%Google-Extended%' OR userAgent LIKE '%Amazonbot%'
           OR userAgent LIKE '%meta-externalagent%')`
      )
  },
  {
    id: "corroboration",
    question: "How far do those declarations survive a check against the vendor's own address list?",
    needs: "one declaration from a vendor that publishes a list",
    threshold: 1,
    unit: "checkable declarations",
    built: true,
    observed: () =>
      one(
        `SELECT COUNT(*) FROM RequestReality WHERE ${EXTERNAL}
         AND (userAgent LIKE '%GPTBot%' OR userAgent LIKE '%OAI-SearchBot%'
           OR userAgent LIKE '%ChatGPT-User%' OR userAgent LIKE '%PerplexityBot%'
           OR userAgent LIKE '%Google-Extended%')`
      )
  },
  {
    id: "surface",
    question: "Is what a stranger receives the same as what this server sends?",
    // A sweep an hour, so twenty-four is a day of them. Below that, "the edge
    // agrees with the origin" describes a morning rather than a site.
    needs: "24 sweeps where the origin held still while the edge was asked",
    threshold: 24,
    unit: "bracketed sweeps",
    built: true,
    observed: () =>
      one(
        `SELECT COUNT(*) FROM (
           SELECT runId FROM SelfObservation
           WHERE path = '/robots.txt' AND errorCode IS NULL
           GROUP BY runId
           HAVING COUNT(DISTINCT vantage) = 3
              AND COUNT(DISTINCT CASE WHEN vantage LIKE 'origin%' THEN bodySha256 END) = 1)`
      )
  },
  {
    id: "behaviour",
    question: "Does any named crawler have a reading pattern on this site?",
    // Three separate days for one agent. A pattern claimed from visits inside a
    // single day is a description of that day: a crawler that arrives once, reads
    // eleven pages and leaves has shown an itinerary, not a habit.
    needs: "one crawler with 3 corroborated visits on 3 separate days",
    threshold: 1,
    unit: "crawlers whose habits are describable",
    built: true,
    // Counted through `habits()` rather than by a query of its own. The first
    // version counted days on which any user agent bearing a crawler's name
    // appeared, which is not the same question: on 26 July one address sent 90
    // requests under 13 identities in a single minute, and a day-count credits
    // every one of them. Corroboration and visit-grouping belong to the thing
    // that does them.
    observed: () => habits().filter((h) => h.describable).length
  },
  {
    id: "trend",
    question: "Is anything about this traffic moving week to week?",
    // Two points make a line through anything. Three is the first number at which
    // a direction can be wrong, which is what makes it worth stating.
    needs: "3 complete weeks",
    threshold: 3,
    unit: "complete weeks",
    built: true,
    observed: () => Math.max(weeksObserved().length - 1, 0)
  },
  {
    id: "ingestion",
    question: "Does anything published here reach a language model's output?",
    // The counter this site exists to move. One would do — a single marker
    // appearing in a model's output is not a trend and does not need to be.
    needs: "1 marker observed in a model's output",
    threshold: 1,
    unit: "markers observed",
    built: true,
    observed: () => 0
  }
];

/**
 * Where each question stands.
 *
 * Four states, and the two in the middle are the ones this exists to separate.
 * "Built and nothing seen" and "answerable" both look like a working feature
 * from the outside.
 */
export function readiness() {
  return QUESTIONS.map((q) => {
    const observed = q.observed();
    const state = !q.built
      ? "not built"
      : observed === 0
        ? "nothing observed"
        : observed >= q.threshold
          ? "answerable"
          : "observing";

    return {
      id: q.id,
      question: q.question,
      needs: q.needs,
      unit: q.unit,
      threshold: q.threshold,
      observed,
      state,
      answerable: state === "answerable"
    };
  });
}
