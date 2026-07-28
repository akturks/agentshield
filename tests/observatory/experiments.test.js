import test from "node:test";
import assert from "node:assert/strict";

import {
  preregistration,
  declareExperiment,
  experiments,
  MEASURES,
  EXPERIMENT_VERSION
} from "../../public-site/experiments.js";

// The failure that makes an experiment worse than no experiment is choosing the
// measurement after the data is in. Nothing downstream can detect it — the
// figures are real, the query is real, and the only thing wrong is an ordering
// nobody wrote down. So the ordering is what gets tested.

const decl = {
  measureId: "requests_to_path",
  params: ["/lab"],
  baselineFromMs: 1000,
  baselineToMs: 2000,
  observationFromMs: 2000,
  observationToMs: 3000
};

test("the same declaration always hashes the same", () => {
  assert.equal(preregistration(decl), preregistration({ ...decl }));
});

test("changing any part of the declaration changes the hash", () => {
  // Each of these is a way to move the question after the answer is visible:
  // measure a different thing, measure a different subject, or move a window
  // until the numbers separate.
  const moved = [
    { ...decl, measureId: "distinct_agents_reading_path" },
    { ...decl, params: ["/findings"] },
    { ...decl, baselineFromMs: 900 },
    { ...decl, baselineToMs: 2100 },
    { ...decl, observationFromMs: 2100 },
    { ...decl, observationToMs: 4000 }
  ];

  for (const m of moved)
    assert.notEqual(preregistration(m), preregistration(decl), `${JSON.stringify(m)} hashed the same`);
});

test("the engine version is inside the hash", () => {
  // A measure whose meaning changes under the same name would otherwise leave
  // old results comparable to new ones. Bumping the version invalidates every
  // stored pre-registration, which is the correct and inconvenient behaviour.
  assert.ok(preregistration(decl).length === 64);
  assert.match(EXPERIMENT_VERSION, /^exp-\d+$/);
});

test("an unknown measure cannot be declared", () => {
  assert.throws(
    () => declareExperiment({ question: "q", measureId: "whatever_moved", params: [] }),
    /unknown measure/
  );
});

test("a measure cannot be declared with the wrong number of parameters", () => {
  assert.throws(
    () => declareExperiment({ question: "q", measureId: "requests_to_path", params: [] }),
    /takes 1 parameter/
  );
});

test("every measure is a closed, named thing rather than a query supplied late", () => {
  // An experiment that could bring its own SQL could bring it after the fact,
  // and the hash would then be protecting a string chosen with the answer in
  // view.
  for (const [id, m] of Object.entries(MEASURES)) {
    assert.ok(m.label && m.label.length > 10, `${id} has no label`);
    assert.ok(m.unit, `${id} has no unit`);
    assert.equal(typeof m.run, "function", `${id} does not compute anything`);
    assert.ok(Array.isArray(m.params), `${id} does not declare its parameters`);
  }
});

test("markers seen in a model's output is stated, never queried", () => {
  // No column holds it. A query that appeared to answer it would answer
  // something else — markers published, or requests to marker-bearing pages —
  // and would make an experiment about ingestion report movement that was not
  // ingestion.
  assert.equal(MEASURES.markers_observed_in_model_output.run(0, Date.now(), []), 0);
});

test("baseline and observation are equal in length and share a boundary", () => {
  // A fourteen-day before against a three-day after is not a comparison, and a
  // gap between the windows is time nobody accounted for.
  for (const r of experiments()) {
    if (!r.preregistrationHolds) continue;
    const before = r.baseline.toMs - r.baseline.fromMs;
    const after = r.observation.toMs - r.observation.fromMs;
    assert.equal(before, after, `${r.id} compares windows of different lengths`);
    assert.equal(r.baseline.toMs, r.observation.fromMs, `${r.id} leaves a gap between the windows`);
  }
});

test("a baseline reaching before the record says how much of it is covered", () => {
  // A fourteen-day baseline on a four-day record reaches ten days into a period
  // when this site did not answer. "Before: 0" is then a fact about the domain
  // not existing, and a comparison against it is a comparison against absence.
  for (const r of experiments()) {
    if (!r.preregistrationHolds) continue;
    assert.equal(typeof r.baseline.coverage, "number");
    assert.ok(r.baseline.coverage >= 0 && r.baseline.coverage <= 100);
  }
});

test("no verdict is a success", () => {
  // "No observable difference" is a result. A vocabulary with success in it
  // makes that the one that needs explaining, and an engine whose easiest
  // sentence is the flattering one will eventually produce it.
  const allowed = new Set(["running", "no observable difference", "difference observed", "refused"]);
  for (const r of experiments())
    assert.ok(allowed.has(r.verdict), `${r.id} produced an undeclared verdict: ${r.verdict}`);
});

test("every declared experiment still matches the hash it was declared with", () => {
  // The live check. A stored definition that has drifted from its hash must
  // refuse to produce a figure rather than producing a quiet one.
  for (const r of experiments())
    assert.equal(
      r.preregistrationHolds,
      true,
      `${r.id} has a definition that no longer matches its pre-registration`
    );
});
