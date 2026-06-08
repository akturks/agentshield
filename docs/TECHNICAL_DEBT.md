# AgentShield Technical Debt Register

This document tracks active architectural, implementation and domain-model debt.

Resolved items are intentionally removed to keep the register focused on active work.

---

## OUTCOME-002 — Outcome Observation & Ingestion

Priority: High

Status: In Progress

### Problem

Outcome records can be stored and queried.

However, Outcome generation is not yet integrated into a complete observation pipeline.

Current state:

Reality
→ Event
→ Outcome

exists

but

Outcome observation sources are not yet standardized.

### Open Questions

* Native outcomes
* Application outcomes
* Human outcomes
* External outcomes

### Target State

Outcome becomes a first-class Reality Stream.

Reality
→ Outcome
→ Archive

---

## OUTCOME-003 — Outcome Domain Model

Priority: High

Status: In Progress

### Completed

✓ Outcome schema

✓ Outcome persistence

✓ Outcome ingestion endpoint

✓ Outcome ownership validation

### Open Questions

* Outcome attribution strategy
* Outcome context representation
* Correlation identifiers
* Future causality integration

### Notes

Outcome is a Reality Object.

Outcome represents an observed consequence.

Outcome is not an assertion.

---

## ADR-0009 — Causality Representation

Priority: Medium

Status: Open

### Problem

The system records:

Events

Outcomes

but cannot represent:

Why did an outcome occur?

### Current Position

Correlation may be introduced before causality.

Correlation is not causality.

### Future Exploration

Potential mechanisms:

* correlationId
* observationWindowId
* graph-based attribution
* causal edges

---

## ADR-0011 — Outcome and Assertion Separation

Priority: High

Status: Proposed

### Question

Should Outcome and Assertion be modeled as separate Reality Objects?

### Candidate Decision

# Outcome

Observed consequence

# Assertion

Observed judgment

### Outcome Examples

purchase_completed

subscription_renewed

chargeback_received

### Assertion Examples

fraud_confirmed

known_bot

high_value_customer

### Rationale

Reality Layer should not mix consequences and judgments.

---

## MEMORY-TAXONOMY

Priority: Medium

Status: Open

### Problem

Memory generation exists conceptually.

Memory categories do not yet exist.

### Examples

persistent_purchase_interest

repeat_buyer

historical_policy_violation

### Goal

Establish a canonical memory vocabulary.

---

## MEMORY-DECAY

Priority: Medium

Status: Open

### Problem

Memory persistence exists conceptually.

Forgetting behavior does not.

### Open Questions

* Time-based decay
* Confidence decay
* Reinforcement
* Memory retirement

---

## REPUTATION-001 — Reputation Engine

Priority: Medium

Status: Planned

### Problem

Memory exists.

Reputation aggregation does not.

### Target State

Memory
→ Reputation
→ Trust

---

## ARCH-001 — Identity and Session as Interpretation Objects

Priority: Low

Status: Open

### Question

Should Identity and Session remain canonical entities?

Or should they become derived interpretation objects built from Reality Streams?

### Notes

This investigation depends on future Reality Archive evolution.

---

## Architectural Principles

ADR-0010

Ratified

Reality is the canonical source of truth.

Replayability is a first-class requirement.

Reality is recorded.

Memory is regenerated.

Reputation is interpreted.

Trust is computed.

Risk is derived.

