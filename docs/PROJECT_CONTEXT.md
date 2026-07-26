# AgentShield Project Context

## Identity

AgentShield is an independent behavioural trust and evidence platform.

Its purpose is to observe behaviour, preserve evidence, and support trust
assessments grounded in verifiable information. The mechanism by which it does
that is historical state preservation for digital actors: the record is kept
intact so that any interpretation drawn from it can be recomputed later.

The first sentence above is the platform's only self-description, fixed by the
*Purpose* article of `CONSTITUTION.md`. Earlier drafts of this document opened
with the mechanism instead, which left the project describing itself three
different ways across `docs/`.

---

## Current Layer Model

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

## Current Status

Reality Archive
✓ Operational

Replay Infrastructure
🟡 Active Development

Behavior Graph
⚪ Not Started

Interpretation Engines
⚪ Future

Reasoning
⚪ Future

---

## Current Reality Objects

Observed Reality:

* Event
* Outcome

Historical Interpretation Records:

* Assessment

---

## Replay Infrastructure

Completed:

✓ Outcome Replay

✓ Session Replay

✓ Identity Replay

✓ Assessment Replay

✓ Timeline Replay

---

## Current Replay Endpoints

GET /v1/replay/outcome/:outcomeId

GET /v1/replay/session/:sessionId

GET /v1/replay/identity/:identityId

GET /v1/replay/timeline/:identityId

---

## Current Backlog

REPLAY-002

Unified Historical Timeline

(Current Focus)

REPLAY-003

Correlation Replay

REPLAY-004

Historical State Snapshot

REPLAY-005

World State Reconstruction

---

## Current Architectural Direction

Reality Archive stores what happened.

Replay Infrastructure restores what was known.

Behavior Graph discovers what persisted.

Interpretation Engines derive what it means.

Reasoning executes decisions.

---

## First Behavior Graph Candidate

Trust Trajectory

Current implementation precursor:

calculateTrend()

This is considered an early graph primitive.

