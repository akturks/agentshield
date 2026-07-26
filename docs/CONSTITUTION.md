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

Recorded 2026-07-26, from the first run of `pnpm run constitution`. Under the
Status clause these are defects in the implementation, not amendments to this
document. They are listed here so that they are visible without running anything,
and so that closing one is a deliberate act rather than a side effect.

**Reality Boundary — `Event.riskScore` and `Event.decision`.** The observation
table carries a risk score and a policy decision, written on the live request path
by `evaluatePipelineService.js`. The Reality Boundary says interpretations are not
Reality Objects; these are interpretations stored on reality. Fixing it means
moving both onto the interpretation record and migrating existing rows, which
changes the shape of the live pipeline — hence recorded rather than patched
quietly.

**Independent Validation — 17 of 36 assessments have no inputs.** Those rows kept
neither `signals` nor `evidence`, so the conclusions they contain cannot be
recomputed and therefore cannot be corrected. Nothing can repair the existing
rows; the record of how they were produced is gone. What can be fixed is the write
path, so the count stops growing.

Neither figure is to be removed from this list by adjusting the check.
