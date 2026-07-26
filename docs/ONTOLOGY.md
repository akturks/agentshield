

Historical states are the canonical asset.

Interpretations are derived artifacts.




# AgentShield Ontology v1.0

## Status

CANONICAL

Architectural decisions must not violate this document.

---

# Core Thesis

AgentShield is an independent behavioural trust and evidence platform.

It reaches that purpose by preserving historical state for digital actors: the
system preserves historical reality and enables historical state restoration.
Preservation is the mechanism, not the identity — the identity is fixed by the
*Purpose* article of `CONSTITUTION.md` and stated identically everywhere.

Trust, Risk, Reputation, Memory and other interpretations are derived from this foundation.

AgentShield does not store trust.

AgentShield stores reality and historical interpretation records.

---

# Historical State Preservation

AgentShield preserves historical states through preservation of facts and historical interpretation records.

Historical states must remain restorable.

---

# Layer Model

Reality Capture

↓

Reality Archive

↓

Replay Infrastructure

↓

Behavior Graph

↓

Interpretation Engines

↓

Reasoning

---

# Reality

Reality consists of observed facts.

Reality Objects:

* Event
* Outcome

Reality is observed.

Reality is not inferred.

Reality is not interpreted.

---

# Historical Interpretation

Assessments are not Reality Objects.

Assessments are Historical Interpretation Records.

Example:

Trust Engine v1

produced:

Trust = 62

Intent = commercial

The assessment itself is not reality.

The fact that the assessment was produced is reality.

Historical Interpretation Records preserve what was believed at a specific point in time.

---

# Reality Archive

Purpose:

Store historical artifacts.

Responsibilities:

* Persist Events
* Persist Outcomes
* Persist Historical Interpretation Records

Reality Archive preserves history.

Reality Archive does not derive meaning.

Reality Archive does not perform reasoning.

---

# Replay Infrastructure

Purpose:

Restore historical states.

Replay restores what was known.

Replay does not explain what it means.

Replay does not infer missing information.

Replay must guess nothing.

Replay restores historical world states.

---

# Historical State

A Historical State may contain:

* Identity State
* Session State
* Observed Events
* Observed Outcomes
* Historical Interpretation Records
* Correlation Contexts

A Historical State represents what was knowable at a specific point in time.

Historical State is not a narrative.

Historical State is not an interpretation.

---

# Behavior Graph

Purpose:

Discover persistent structures.

Examples:

* Trust Trajectory
* Conversion Path
* Behavior Motif
* Credential Rotation Pattern

Behavior Graph discovers structures.

Behavior Graph does not derive meaning.

Behavior Graph does not explain behavior.

Behavior Graph identifies what persists across states.

---

# Interpretation Engines

Purpose:

Derive meaning from structures.

Examples:

* Trust
* Risk
* Reputation
* Intent
* Narrative

Interpretations are versioned.

Interpretations may change.

Interpretations are replaceable.

---

# Reasoning

Purpose:

Execute decisions.

Reasoning is not a historical artifact.

Reasoning is not archived.

Reasoning is executable.

Reasoning should be reproducible from:

* Facts
* States
* Structures
* Interpretation Models

Reasoning may change over time.

Historical decisions should remain reproducible.

---

# Canonical Distinctions

Reality ≠ Interpretation

Archive ≠ Replay

Replay ≠ Interpretation

State ≠ Story

Structure ≠ Meaning

Behavior Graph ≠ Interpretation Engine

Reasoning ≠ Historical Artifact

Assessment ≠ Reality Object

---

# Canonical Definitions

Reality Archive stores what happened.

Replay Infrastructure restores what was known.

Behavior Graph discovers what persisted.

Interpretation Engines derive what it means.

Reasoning executes decisions.

---

# Canonical Principles

Store facts.

Restore states.

Discover structures.

Derive interpretations.

Execute reasoning.

---

# Long-Term Invariant

Facts may remain.

States may be restored.

Structures may be rediscovered.

Interpretations may change.

Reasoning may change.

Historical reality must remain reproducible.

Historical states must remain restorable.

Historical reality must not depend on any specific interpretation model.


---

# Knowledge Formation — Target Architecture

How an observation becomes knowledge. This chain is the project's most distinctive
claim, and it is recorded here as a **target**, not as a description of the
running system.

It is deliberately *not* in `CONSTITUTION.md`. The Constitution states what must
be true; five of the seven stages below are not true yet. Writing them into it
would make most of the document unfalsifiable, which is the exact mechanism that
produced three mutually incompatible "canonical" pipelines across these documents
in the first place. A stage graduates to the Constitution when two conditions
hold: it is reachable from the live request path, and there is a check that fails
when it is bypassed.

Status measured 2026-07-26 by tracing imports from `server.js`.

| Stage | Intended role | Implementation | Status |
|---|---|---|---|
| Observation | Receive and store what happened | `observationGenerationService.js` | **unwired** — zero imports |
| Discovery | Find structure across observations | `discoveryService.js`, `populationDiscoveryService.js` | **unwired** — zero imports |
| | | `patternDiscoveryService.js` | **unreachable** — only imported by `populationArchiveBuilderService.js`, itself unwired |
| Independent Evidence | Derive evidence that did not come from the conclusion | `evidenceDerivationService.js` | **live, but partial** — reached via `trustCalculationService` as a trust input, not as independent evidence |
| Calibration | Establish how much a signal is worth | — | **absent** — no implementation exists |
| Audit | Re-derive a conclusion from the record | — | **absent** — no implementation exists |
| Assessment | State what may be concluded | `trustAssessmentBuilderService.js` | **live** — imported by `server.js` |
| Knowledge | Promote a repeatedly confirmed assessment | `knowledgePromotionService.js` | **unwired** — zero imports |

Two stages live, three written but unreachable, two never written.

The gap between this table and the prose elsewhere in `docs/` is the honest state
of the project. Do not close it by editing the table.

## What the absent stages would have to do

**Calibration** and **Audit** are the two that carry the weight, and neither
exists. Without calibration, a signal's contribution to a trust score is a
constant someone chose. Without audit, an assessment cannot be re-derived from the
record, which means it cannot be shown to be wrong — and `pnpm run constitution`
already reports that 17 of 36 stored assessments kept no signals or evidence at
all, so for those the audit stage has nothing to work from even in principle.

Build these two before extending the chain further. Discovery and Knowledge are
the more interesting stages, but promoting an assessment to knowledge without an
audit step is promotion on trust, which the Purpose article says this platform
does not produce.
