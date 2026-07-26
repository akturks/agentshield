# AgentShield Constitution v2

## Status

CANONICAL

This Constitution defines the intended behaviour of the platform.

When an implementation conflicts with this Constitution, the implementation shall
be considered defective until brought into conformance with these principles.

The specific tie-breakers under *Architectural Rule* below apply when two
principles here collide with each other. They do not create exceptions to this
clause.

---

# Purpose

AgentShield is an independent behavioural trust and evidence platform.

Its purpose is to observe behaviour, preserve evidence, and support trust
assessments grounded in verifiable information.

AgentShield does not produce reality.

AgentShield does not produce trust.

AgentShield does not produce authority.

It records what happened, keeps that record intact, and states what may be
concluded from it — separately, and revisably.

This article defines why the system exists. It is also the naming rule: this
sentence is the platform's only self-description. Any document introducing a
competing one is defective under the Status clause.

---

# Reality Boundary

Outcomes are observations.

Assessments are interpretations.

Assessments are not Outcomes.

Interpretations are not Reality Objects.

---

# Replay Boundary

Replay restores states.

Replay does not explain states.

Replay does not infer missing information.

Replay must guess nothing.

Replay output must be deterministic.

---

# State Boundary

Historical State is not a narrative.

Historical State is not an interpretation.

Historical State represents what was knowable at a specific point in time.

---

# Graph Boundary

Behavior Graph discovers structures.

Behavior Graph does not derive meaning.

Behavior Graph does not execute decisions.

---

# Interpretation Boundary

Interpretations may change.

Reality must remain stable.

Interpretation models may change.

Historical reality must remain reproducible.

---

# Reasoning Boundary

Reasoning is executable.

Reasoning is not archived.

Reasoning is not a historical artifact.

Historical decisions should remain reproducible.

---

# Independent Validation

No layer validates itself.

A conclusion must be checkable against something that did not produce it.

Evidence for an assessment may not be derived from that assessment.

An interpretation that cannot be recomputed from the record cannot be corrected,
and is therefore not admissible.

Every article in this Constitution that can be checked by a program must be
checked by one. An article with no executable check is an intention, not a rule —
and this document has already demonstrated what happens to intentions: three
mutually incompatible "canonical" pipelines were documented, none of them
matching the code, because nothing failed when they diverged.

Run the checks with `pnpm run constitution`.

---

# Adversarial Review

No significant idea is accepted merely because it was proposed.

Significant claims must be open to independent examination and criticism.

Constructive objection is the mechanism by which this system improves.

The operator is not exempt. Reviewing only external actors would miss the actual
source of error: on 25–26 July 2026, every false conclusion this project produced
originated with the operator — spoofed user agents from the operator's own
address, an assistant prompted without the prompt being logged, and the
operator's own devices counted as external traffic. Each was caught, and none was
caught by the component that produced it.

A correction is a deliverable. Withdrawing or amending a published conclusion,
with the reason stated, is the system working — not an embarrassment to be
minimised. The record of having been wrong and having said so is worth more than
an unbroken record of confident claims.

---

# Architectural Rule

When ontology and implementation conflict:

Ontology wins.

When replayability and convenience conflict:

Replayability wins.

When simplicity and premature abstraction conflict:

Simplicity wins.


---

# Known Non-Conformance

Opened 2026-07-26 from the first run of `pnpm run constitution`, and closed the
same day. Under the Status clause these were defects in the implementation rather
than amendments to this document. The history is kept because the useful part of a
conformance record is not its current colour — it is what was found, when it
started, and what closing it cost.

`pnpm run constitution` now reports six checks upheld. Two of those six did not
exist when the section below was written; both were added because writing them was
the only way to find out whether the article they enforce was true.

## Closed — Reality Boundary: `Event.riskScore` and `Event.decision`

The observation table carried a risk score and a policy decision, written on the
live request path. All 43 events had both, and none recorded the reasons the score
was built from or the version of the rule that built it, so not one of them could
be replayed.

Both columns now live in `EventAssessment`, one row per verdict, carrying its
reasons and a `methodVersion`. The 46 existing verdicts were moved rather than
deleted, with `reasons` and `methodVersion` left NULL — neither was ever recorded,
and filling them in with today's values would have manufactured a basis those
verdicts never had. `saveEventAssessment` refuses a verdict that arrives without
either, and a sixth check holds the new table to that.

Dropping the columns broke `/v1/traffic-quality`, which had been reading
`event.decision` and `event.riskScore` — into silence, not into an error: the
fields came back `undefined`, so the endpoint reported zero blocked, zero allowed
and an average risk of zero. A plausible-looking answer and a false one. It now
counts from `EventAssessment` and reports `assessedEvents` beside `totalEvents`,
because an event with no verdict is one that endpoint must not describe either way.

## Closed — Independent Validation: assessments with no inputs

This figure was wrong three times, in both directions, and the corrections are
more instructive than the number.

It first read **17 of 36**, because the check tested only for NULL and empty string
while `saveAssessment` wrote `JSON.stringify(signals || [])` — a missing input was
stored as `[]` and sailed past. Tightening it gave **33 of 36**.

That was also wrong, and this time too high. It counted 25 rows that are empty for
a legitimate reason: no rule fired. An assessment of an identity that triggered
nothing has no inputs to record and is fully determined by the baseline, so it is
recomputable and conformant. The check was comparing each column against emptiness
when the violation is a *signal without its evidence* — a comparison between the
two columns. The true figure is **8 of 36**.

Those eight are unrepairable, and they exposed a rule that could only ever be red,
whose single satisfying move would have been deleting the evidence of its own
violation. The boundary is now read from the row: an assessment carrying a method
version was written by a path that also enforces its inputs, because the same
function requires both. The verdict covers rows the current code produced; the
eight are counted and named in the same sentence, every run, and never subtracted.
The verdict is also refused while no such row exists — a guarantee that has never
been exercised is a claim, and this tool does not certify claims.

Writing the second new check found a third defect nobody had described:
`buildTrustAssessment` computed `getModelVersions()` and read `observedEventCount`,
and `saveAssessment` persisted neither. Every one of the 36 stored assessments was
missing the version of the method that made it and one of the numbers that method
consumed, so replaying any of them would have applied today's model to yesterday's
row. Two columns were added and `saveAssessment` now requires both.

The underlying write-path defect was fixed earlier: `deriveEvidence` covered one of
the five signals the trust score adjusts on, so four adjustments out of five had no
recorded basis by construction. The asymmetry that produced is worth recording —
the only signal that could *lower* trust carried its basis, and the three that
*raise* it never did, so the system could justify punishing and never justify
rewarding. `src/services/signalRules.js` now declares each signal together with
the predicate selecting the events that support it, and both derivations read that
one table.

## The rule these three corrections illustrate

A figure in this section is never to be improved by adjusting a check to agree
with the code. Making a check *stricter* and finding more is always in order.
Making one *more accurate* and finding less is in order too — but only when the
smaller number comes with the reason the larger one was wrong, and only when what
was excluded stays visible in the output. Both happened here; the 25 quiet rows and
the 8 unrepairable ones are still printed on every run.
