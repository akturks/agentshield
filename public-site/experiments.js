import { randomUUID, createHash } from "node:crypto";

import db, { SITE_ID } from "./realityDb.js";
import { EXTERNAL } from "./stats.js";
import { classify } from "./vendors/index.js";

// Questions asked of the future, with the answer's shape fixed before the asking.
//
// The failure this is built against is the one that makes an experiment worse
// than no experiment: choosing the measurement after the data is in. A result
// picked that way looks earned and is not, and nothing downstream can tell the
// difference — the figures are real, the query is real, and the only thing wrong
// is an ordering nobody recorded.
//
// So the measurement comes from a fixed registry, the parameters and windows are
// hashed at declaration, and the hash is checked before any result is computed.
// An experiment whose definition has moved refuses to produce a result rather
// than producing a quiet one.
//
// Not every experiment changes something. Some are pure waiting: a hypothesis
// says a crawler would fetch content on a longer horizon, and the only way to
// separate that from its rivals is to declare what would count and then wait.
// Requiring a change would mean altering the site in order to have an
// experiment, which is the tail wagging the instrument.
//
// There is no success. "No observable difference" is a result, and this file is
// written so that it is the easiest result to report rather than the one that
// needs explaining.

export const EXPERIMENT_VERSION = "exp-1";

const count = (sql, params = []) => {
  const row = db.prepare(sql).get(...params);
  return row ? Number(Object.values(row)[0]) : 0;
};

/**
 * The measurements an experiment may declare.
 *
 * A closed registry on purpose. An experiment that could supply its own SQL
 * could supply it late, and the pre-registration hash would then be protecting
 * a string chosen with the answer already visible.
 *
 * Every measure takes a window and returns one number. Windows are half-open —
 * `from` inclusive, `to` exclusive — so a baseline and an observation period
 * that touch cannot both count the same request.
 */
export const MEASURES = {
  requests_from_agent_to_content: {
    label: "Requests declaring this crawler, to a path that is not robots.txt, sitemap.xml or llms.txt",
    unit: "requests",
    params: ["agent pattern"],
    run: (from, to, [agent]) =>
      count(
        `SELECT COUNT(*) AS n FROM RequestReality
         WHERE ${EXTERNAL} AND observedAtMs >= ? AND observedAtMs < ?
           AND userAgent LIKE ?
           AND path NOT IN ('/robots.txt', '/sitemap.xml', '/llms.txt', '/favicon.ico')`,
        [from, to, `%${agent}%`]
      )
  },
  corroborated_requests_from_agent_to_content: {
    label:
      "Requests declaring this crawler from an address its vendor publishes, to a path that is not robots.txt, sitemap.xml or llms.txt",
    unit: "corroborated requests",
    params: ["agent name"],
    // Not SQL. The address check is a CIDR match against a dated snapshot and
    // cannot be expressed in a query — and the difference matters here more than
    // anywhere: the measure above would let anybody end this experiment by
    // sending one request under a borrowed name, which on this site has already
    // happened ninety times in a minute.
    run: (from, to, [agent]) => {
      const rows = db
        .prepare(
          `SELECT cfConnectingIp AS ip FROM RequestReality
           WHERE ${EXTERNAL} AND observedAtMs >= ? AND observedAtMs < ?
             AND userAgent LIKE ?
             AND path NOT IN ('/robots.txt', '/sitemap.xml', '/llms.txt', '/favicon.ico')`
        )
        .all(from, to, `%${agent}%`);

      return rows.filter((r) => {
        const status = classify(agent, r.ip)?.status;
        return status === "verified" || status === "vendor_other";
      }).length;
    }
  },
  requests_to_path: {
    label: "Requests to one path",
    unit: "requests",
    params: ["path"],
    run: (from, to, [path]) =>
      count(
        `SELECT COUNT(*) AS n FROM RequestReality
         WHERE ${EXTERNAL} AND observedAtMs >= ? AND observedAtMs < ? AND path = ?`,
        [from, to, path]
      )
  },
  distinct_agents_reading_path: {
    label: "Distinct declared identities that fetched one path",
    unit: "identities",
    params: ["path"],
    run: (from, to, [path]) =>
      count(
        `SELECT COUNT(DISTINCT userAgent) AS n FROM RequestReality
         WHERE ${EXTERNAL} AND observedAtMs >= ? AND observedAtMs < ? AND path = ?`,
        [from, to, path]
      )
  },
  markers_observed_in_model_output: {
    label: "Published markers observed in a language model's output",
    unit: "markers",
    params: [],
    // Stated, not queried. The sighting happens outside this system and no
    // column holds it; a query that appeared to answer this would answer
    // something else.
    run: () => 0
  }
};

const DAY_MS = 86400000;

/** The bytes that are hashed. Order is fixed so the same declaration hashes the same. */
export function preregistration({ measureId, params, baselineFromMs, baselineToMs, observationFromMs, observationToMs }) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        EXPERIMENT_VERSION,
        measureId,
        params,
        baselineFromMs,
        baselineToMs,
        observationFromMs,
        observationToMs
      ])
    )
    .digest("hex");
}

const insert = db.prepare(`
  INSERT INTO Experiment (id, siteId, hypothesisId, candidateId, question, changeMade,
    measureId, params, baselineFromMs, baselineToMs, observationFromMs, observationToMs,
    declaredAt, preregistrationSha256, engineVersion)
  VALUES (@id, @siteId, @hypothesisId, @candidateId, @question, @changeMade,
    @measureId, @params, @baselineFromMs, @baselineToMs, @observationFromMs, @observationToMs,
    @declaredAt, @preregistrationSha256, @engineVersion)
`);

/**
 * Register an experiment before it runs.
 *
 * The baseline window is the same length as the observation window and ends the
 * moment the observation begins. Equal lengths because a fourteen-day before
 * compared with a three-day after is not a comparison, and adjacency because a
 * gap between them is time nobody accounted for.
 */
export function declareExperiment({
  question,
  hypothesisId = null,
  candidateId = null,
  changeMade = null,
  measureId,
  params = [],
  days = 14,
  startMs = Date.now()
}) {
  const measure = MEASURES[measureId];
  if (!measure) throw new Error(`experiment: unknown measure "${measureId}"`);
  if (measure.params.length !== params.length)
    throw new Error(
      `experiment: ${measureId} takes ${measure.params.length} parameter(s) (${measure.params.join(", ")})`
    );

  const window = days * DAY_MS;
  const row = {
    id: randomUUID(),
    siteId: SITE_ID,
    hypothesisId,
    candidateId,
    question,
    changeMade,
    measureId,
    params: JSON.stringify(params),
    baselineFromMs: startMs - window,
    baselineToMs: startMs,
    observationFromMs: startMs,
    observationToMs: startMs + window,
    declaredAt: new Date().toISOString(),
    engineVersion: EXPERIMENT_VERSION
  };

  row.preregistrationSha256 = preregistration({
    measureId,
    params,
    baselineFromMs: row.baselineFromMs,
    baselineToMs: row.baselineToMs,
    observationFromMs: row.observationFromMs,
    observationToMs: row.observationToMs
  });

  insert.run(row);
  return row.id;
}

const all = db.prepare(`SELECT * FROM Experiment ORDER BY observationToMs`);
const byId = db.prepare(`SELECT * FROM Experiment WHERE id = ?`);

/**
 * What an experiment shows, computed from the record on every read.
 *
 * `preregistrationHolds` is checked first and a failure stops everything. If the
 * stored hash does not match the stored definition, the definition moved after
 * the declaration, and any number produced from it would be a number chosen with
 * the answer in view.
 *
 * The verdict has three values and none of them is success. A difference is
 * reported as a difference; its absence is reported as an absence, in the same
 * words, with the same weight.
 */
export function result(id) {
  const e = byId.get(id);
  if (!e) return null;

  const params = JSON.parse(e.params);
  const measure = MEASURES[e.measureId];

  const holds =
    Boolean(measure) &&
    preregistration({
      measureId: e.measureId,
      params,
      baselineFromMs: e.baselineFromMs,
      baselineToMs: e.baselineToMs,
      observationFromMs: e.observationFromMs,
      observationToMs: e.observationToMs
    }) === e.preregistrationSha256;

  const now = Date.now();
  const complete = now >= e.observationToMs;

  if (!holds)
    return {
      id: e.id,
      question: e.question,
      preregistrationHolds: false,
      verdict: "refused",
      detail:
        "The stored definition does not match the hash recorded when this was declared. No figure is computed from it."
    };

  // How much of the baseline window the record actually spans.
  //
  // A fourteen-day baseline on a record four days old reaches eleven days into a
  // period when this site did not answer. "Before: 0" is then a fact about the
  // domain not existing, and comparing an after against it would be comparing
  // against absence. The figure is still computed and the coverage is printed
  // beside it, because a baseline that quietly means nothing is worse than one
  // that says how thin it is.
  const recordStartsMs =
    count(`SELECT MIN(observedAtMs) AS n FROM RequestReality WHERE ${EXTERNAL}`) || e.baselineToMs;
  const covered = Math.max(0, e.baselineToMs - Math.max(e.baselineFromMs, recordStartsMs));
  const baselineCoverage = Math.round((covered / (e.baselineToMs - e.baselineFromMs)) * 1000) / 10;

  const before = measure.run(e.baselineFromMs, e.baselineToMs, params);
  const after = measure.run(e.observationFromMs, Math.min(now, e.observationToMs), params);

  return {
    id: e.id,
    question: e.question,
    hypothesisId: e.hypothesisId,
    candidateId: e.candidateId,
    changeMade: e.changeMade,
    measure: measure.label,
    unit: measure.unit,
    params,
    preregistrationHolds: true,
    declaredAt: e.declaredAt,
    baseline: {
      fromMs: e.baselineFromMs,
      toMs: e.baselineToMs,
      value: before,
      // Percentage of the baseline window the record covers. Below 100 the
      // "before" figure is partly a statement about time this site was not
      // observing, and any comparison has to be read through it.
      coverage: baselineCoverage
    },
    observation: {
      fromMs: e.observationFromMs,
      toMs: e.observationToMs,
      value: after,
      complete
    },
    delta: after - before,
    // Three values, none of them success. An experiment that changed nothing has
    // answered its question, and this is the wording that says so without
    // apologising for it.
    verdict: !complete
      ? "running"
      : after === before
        ? "no observable difference"
        : "difference observed",
    daysRemaining: complete ? 0 : Math.ceil((e.observationToMs - now) / DAY_MS),
    closedAt: e.closedAt,
    closingNote: e.closingNote,
    engineVersion: e.engineVersion
  };
}

/** Every experiment, with what the record currently says about it. */
export function experiments() {
  return all.all().map((e) => result(e.id));
}
