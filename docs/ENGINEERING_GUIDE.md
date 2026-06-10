# AgentShield Engineering Guide v1

## Purpose

Implementation decisions must not violate ONTOLOGY.md or CONSTITUTION.md.

---

# Development Philosophy

Prefer simple implementations.

Prefer evolution over redesign.

Avoid premature abstraction.

Do not optimize for hypothetical future requirements.

---

# Replay Safety Rule

Replay output must be deterministic.

Given the same historical inputs, Replay must produce the same state.

Replay must not depend on current interpretation models.

---

# Replay Rules

Replay restores historical states.

Replay must not infer.

Replay must not summarize.

Replay must not explain.

Replay must not derive meaning.

Replay must guess nothing.

---

# Repository Rules

Repositories own data access.

Replay may compose repositories.

Repositories must not perform graph analysis.

Repositories must not perform interpretation logic.

Repositories must not perform reasoning.

---

# Architectural Priority

Reality first.

Replay second.

Graph third.

Interpretation fourth.

Reasoning last.

Do not skip layers.

---

# Current Priority

REPLAY-002

Unified Historical Timeline

Goal:

Create a canonical chronological stream of:

* Events
* Assessments
* Outcomes

without introducing Graph logic,
Interpretation logic,
or Reasoning logic.

---

# Out Of Scope

The following capabilities do not belong in Replay Infrastructure:

* AI narratives
* Story generation
* Behavior explanation
* Risk reasoning
* Trust evolution
* Reputation engines
* Graph analytics

These belong to future layers.

